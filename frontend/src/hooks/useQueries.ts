import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { UserProfile, QPayCredentials, QPayInvoiceConfig, PaymentRecord, InvoiceRecord, InvoiceResponse, UserRole, InvoiceCheckResult } from '../backend';
import { toast } from 'sonner';

export function useGetCallerUserProfile(registrationComplete: boolean = false) {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) {
        console.error('[useGetCallerUserProfile] Actor олдсонгүй');
        throw new Error('Actor олдсонгүй');
      }
      
      try {
        console.log('[useGetCallerUserProfile] Профайл татаж байна...');
        const profile = await actor.getCallerUserProfile();
        console.log('[useGetCallerUserProfile] Профайл татагдлаа:', profile ? 'байна' : 'null');
        return profile;
      } catch (error: any) {
        console.error('[useGetCallerUserProfile] Профайл татахад алдаа:', error);
        if (error.message?.includes('Unauthorized') || error.message?.includes('not registered')) {
          console.log('[useGetCallerUserProfile] Хэрэглэгч эрхгүй эсвэл бүртгэлгүй, null буцаана');
          return null;
        }
        return null;
      }
    },
    enabled: !!actor && !actorFetching && registrationComplete,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && registrationComplete && query.isFetched,
  };
}

export function useEnsureUserRegistration() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) {
        console.error('[useEnsureUserRegistration] Actor олдсонгүй');
        throw new Error('Actor олдсонгүй');
      }
      console.log('[useEnsureUserRegistration] Хэрэглэгчийг бүртгэж байна...');
      await actor.ensureCallerUserRole();
      console.log('[useEnsureUserRegistration] Бүртгэл дууслаа');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserRole'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      console.log('[useEnsureUserRegistration] Эрх болон профайл queries шинэчлэгдлээ');
    },
    onError: (error: Error) => {
      console.error('[useEnsureUserRegistration] Бүртгэлд алдаа гарлаа:', error);
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

export function useGetCallerUserRole(registrationComplete: boolean = false) {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserRole>({
    queryKey: ['currentUserRole'],
    queryFn: async () => {
      if (!actor) {
        console.error('[useGetCallerUserRole] Actor олдсонгүй');
        throw new Error('Actor олдсонгүй');
      }
      
      try {
        console.log('[useGetCallerUserRole] Эрх татаж байна...');
        const role = await actor.getCallerUserRole();
        console.log('[useGetCallerUserRole] Эрх татагдлаа:', role);
        return role;
      } catch (error: any) {
        console.error('[useGetCallerUserRole] Эрх татахад алдаа:', error);
        console.log('[useGetCallerUserRole] Зочин эрх өгч байна');
        return 'guest' as UserRole;
      }
    },
    enabled: !!actor && !actorFetching && registrationComplete,
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && registrationComplete && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) {
        console.error('[useSaveCallerUserProfile] Actor олдсонгүй');
        throw new Error('Actor олдсонгүй');
      }
      
      if (!profile.name || !profile.name.trim()) {
        throw new Error('Нэр шаардлагатай');
      }
      
      console.log('[useSaveCallerUserProfile] Профайл хадгалж байна:', profile);
      await actor.saveCallerUserProfile(profile);
      console.log('[useSaveCallerUserProfile] Профайл амжилттай хадгалагдлаа');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserRole'] });
      console.log('[useSaveCallerUserProfile] Queries шинэчлэгдлээ');
      toast.success('Профайл амжилттай хадгалагдлаа');
    },
    onError: (error: Error) => {
      console.error('[useSaveCallerUserProfile] Профайл хадгалахад алдаа:', error);
      toast.error(`Профайл хадгалахад алдаа: ${error.message}`);
    },
  });
}

export function useIsCallerAdmin() {
  const { actor, isFetching } = useActor();

  return useQuery<boolean>({
    queryKey: ['isAdmin'],
    queryFn: async () => {
      if (!actor) return false;
      try {
        return await actor.isCallerAdmin();
      } catch (error: any) {
        console.error('Админ эрх шалгахад алдаа:', error);
        return false;
      }
    },
    enabled: !!actor && !isFetching,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetQPayCredentials() {
  const { actor, isFetching } = useActor();

  return useQuery<QPayCredentials | null>({
    queryKey: ['qpayCredentials'],
    queryFn: async () => {
      if (!actor) return null;
      try {
        return await actor.getQPayCredentials();
      } catch (error: any) {
        console.error('QPay нэвтрэх мэдээлэл татахад алдаа:', error);
        if (error.message?.includes('Unauthorized')) {
          toast.error('Дахин нэвтэрнэ үү');
          return null;
        }
        return null;
      }
    },
    enabled: !!actor && !isFetching,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });
}

export function useSaveQPayCredentials() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: QPayCredentials) => {
      if (!actor) throw new Error('Actor олдсонгүй');
      return actor.saveQPayCredentials(credentials);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qpayCredentials'] });
      toast.success('QPay нэвтрэх мэдээлэл амжилттай хадгалагдлаа');
    },
    onError: (error: Error) => {
      console.error('QPay нэвтрэх мэдээлэл хадгалахад алдаа:', error);
      if (error.message?.includes('Unauthorized')) {
        toast.error('Дахин нэвтэрнэ үү');
      } else {
        toast.error(`Хадгалахад алдаа: ${error.message}`);
      }
    },
  });
}

export function useGetQPayInvoiceConfig() {
  const { actor, isFetching } = useActor();

  return useQuery<QPayInvoiceConfig>({
    queryKey: ['qpayInvoiceConfig'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor олдсонгүй');
      try {
        const config = await actor.getQPayInvoiceConfig();
        console.log('[useGetQPayInvoiceConfig] Тохиргоо татагдлаа:', config);
        return config;
      } catch (error: any) {
        console.error('QPay нэхэмжлэхийн тохиргоо татахад алдаа:', error);
        if (error.message?.includes('Unauthorized')) {
          toast.error('Дахин нэвтэрнэ үү');
        }
        throw error;
      }
    },
    enabled: !!actor && !isFetching,
    retry: 1,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useSaveQPayInvoiceConfig() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: QPayInvoiceConfig) => {
      if (!actor) throw new Error('Actor олдсонгүй');
      console.log('[useSaveQPayInvoiceConfig] Тохиргоо хадгалж байна:', config);
      return actor.saveQPayInvoiceConfig(config);
    },
    onSuccess: () => {
      console.log('[useSaveQPayInvoiceConfig] Тохиргоо хадгалагдлаа, queries шинэчилж байна');
      queryClient.invalidateQueries({ queryKey: ['qpayInvoiceConfig'] });
      queryClient.invalidateQueries({ queryKey: ['userInvoiceConfig'] });
      queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
      toast.success('Нэхэмжлэхийн тохиргоо амжилттай хадгалагдлаа');
    },
    onError: (error: Error) => {
      console.error('QPay нэхэмжлэхийн тохиргоо хадгалахад алдаа:', error);
      if (error.message?.includes('Unauthorized')) {
        toast.error('Дахин нэвтэрнэ үү');
      } else {
        toast.error(`Хадгалахад алдаа: ${error.message}`);
      }
    },
  });
}

export function useGetUserPayments() {
  const { actor, isFetching } = useActor();

  return useQuery<PaymentRecord[]>({
    queryKey: ['userPayments'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getUserPayments();
      } catch (error: any) {
        console.error('Төлбөрийн түүх татахад алдаа:', error);
        if (error.message?.includes('Unauthorized')) {
          toast.error('Дахин нэвтэрнэ үү');
        }
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    retry: 1,
    staleTime: 1 * 60 * 1000,
  });
}

export function useGetAllPayments() {
  const { actor, isFetching } = useActor();

  return useQuery<PaymentRecord[]>({
    queryKey: ['allPayments'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        return await actor.getAllPayments();
      } catch (error: any) {
        console.error('Бүх төлбөр татахад алдаа:', error);
        if (error.message?.includes('Unauthorized')) {
          toast.error('Дахин нэвтэрнэ үү');
        }
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    retry: 1,
    staleTime: 1 * 60 * 1000,
  });
}

export function useGetAllInvoices() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<[string, InvoiceRecord]>>({
    queryKey: ['allInvoices'],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const result = await actor.getAllInvoices();
        console.log('[useGetAllInvoices] Backend-с нэхэмжлэх татагдлаа:', result.length, 'ширхэг');
        result.forEach(([id, inv]) => {
          console.log(`[useGetAllInvoices] Нэхэмжлэх ${id}: дүн = ${inv.amount.toString()}`);
        });
        return result;
      } catch (error: any) {
        console.error('Бүх нэхэмжлэх татахад алдаа:', error);
        if (error.message?.includes('Unauthorized')) {
          toast.error('Дахин нэвтэрнэ үү');
        }
        return [];
      }
    },
    enabled: !!actor && !isFetching,
    retry: 1,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useRecordPayment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, status }: { amount: bigint; status: string }) => {
      if (!actor) throw new Error('Actor олдсонгүй');
      return actor.recordPayment(amount, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPayments'] });
      queryClient.invalidateQueries({ queryKey: ['allPayments'] });
    },
    onError: (error: Error) => {
      console.error('Төлбөр бүртгэхэд алдаа:', error);
    },
  });
}

export function useGetInvoiceConfigForUser() {
  const { actor, isFetching } = useActor();

  return useQuery<QPayInvoiceConfig | null>({
    queryKey: ['userInvoiceConfig'],
    queryFn: async () => {
      if (!actor) return null;
      try {
        const config = await actor.getQPayInvoiceConfig();
        console.log('[useGetInvoiceConfigForUser] Хэрэглэгчийн тохиргоо татагдлаа:', config);
        return config;
      } catch (error: any) {
        console.error('Нэхэмжлэхийн тохиргоо татахад алдаа:', error);
        return {
          sender_invoice_no: '12345678',
          invoice_receiver_code: 'terminal',
          invoice_description: 'Railway эрх 12сар',
          amount: BigInt(10),
        };
      }
    },
    enabled: !!actor && !isFetching,
    retry: 1,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useGetUserInvoice() {
  const { actor, isFetching } = useActor();

  return useQuery<InvoiceRecord | null>({
    queryKey: ['userInvoice'],
    queryFn: async () => {
      if (!actor) return null;
      try {
        return await actor.getUserInvoice();
      } catch (error: any) {
        console.error('Хэрэглэгчийн нэхэмжлэх татахад алдаа:', error);
        return null;
      }
    },
    enabled: !!actor && !isFetching,
    retry: 1,
    staleTime: 0,
  });
}

export function useMakeQPayPayment() {
  const { actor } = useActor();
  const recordPayment = useRecordPayment();
  const storeInvoice = useStoreUserInvoice();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor олдсонгүй');

      console.log('[Төлбөрийн урсгал] 0-р алхам: Оновчтой төлбөрийн урсгал эхэлж байна...');

      console.log('[Төлбөрийн урсгал] 1-р алхам: Одоо байгаа нэхэмжлэх шалгаж байна...');
      toast.info('Нэхэмжлэх шалгаж байна...');
      
      const invoiceCheck: InvoiceCheckResult = await actor.checkForValidInvoice();
      console.log('[Төлбөрийн урсгал] Нэхэмжлэх шалгалтын үр дүн:', {
        hasValidInvoice: invoiceCheck.hasValidInvoice,
        hasData: !!invoiceCheck.invoiceData,
        amount: invoiceCheck.amount?.toString()
      });

      let invoiceResponse: InvoiceResponse;
      let token: string | null = null;

      if (invoiceCheck.hasValidInvoice && invoiceCheck.invoiceData && invoiceCheck.amount !== undefined) {
        console.log('[Төлбөрийн урсгал] ♻️ ОДОО БАЙГАА нэхэмжлэх олдлоо - token хүсэлтгүйгээр дахин ашиглаж байна');
        console.log('[Төлбөрийн урсгал] Дахин ашиглаж буй нэхэмжлэхэд token хүсэлт илгээгээгүй.');
        
        invoiceResponse = {
          invoiceData: invoiceCheck.invoiceData,
          isNewInvoice: false,
          amount: invoiceCheck.amount
        };
        
        console.log('[Төлбөрийн урсгал] Хадгалагдсан дүнтэй нэхэмжлэх дахин ашиглаж байна:', invoiceCheck.amount.toString());
        
        console.log('[Төлбөрийн урсгал] Төлбөрийн төлөв шалгахад зориулж token хүсэж байна...');
        const tokenResponse = await actor.makeQPayTokenRequest();
        try {
          const tokenData = JSON.parse(tokenResponse);
          token = tokenData.access_token;
          console.log('[Төлбөрийн урсгал] Төлөв шалгахад зориулсан token авлаа');
        } catch (e) {
          console.error('[Төлбөрийн урсгал] Төлөв шалгах token задлахад алдаа:', e);
        }
      } else {
        console.log('[Төлбөрийн урсгал] Хүчинтэй нэхэмжлэх олдсонгүй - шинэ нэхэмжлэх үүсгэж байна');
        console.log('[Төлбөрийн урсгал] 2-р алхам: QPay token хүсэж байна...');
        toast.info('QPay token хүсэж байна...');
        
        const tokenResponse = await actor.makeQPayTokenRequest();
        console.log('[Төлбөрийн урсгал] Token хариу ирлээ');

        try {
          const tokenData = JSON.parse(tokenResponse);
          token = tokenData.access_token;
          if (!token) throw new Error('Token олдсонгүй');
          console.log('[Төлбөрийн урсгал] Token амжилттай задлагдлаа');
        } catch (e) {
          console.error('[Төлбөрийн урсгал] Token хариу задлахад алдаа:', e);
          throw new Error('Token задлахад алдаа гарлаа');
        }

        console.log('[Төлбөрийн урсгал] 3-р алхам: Token-тэй шинэ нэхэмжлэх үүсгэж байна...');
        toast.info('Шинэ нэхэмжлэх үүсгэж байна...');
        invoiceResponse = await actor.getValidOrCreateInvoice(token);
        console.log('[Төлбөрийн урсгал] Шинэ нэхэмжлэх үүсгэгдлээ:', {
          isNewInvoice: invoiceResponse.isNewInvoice,
          amount: invoiceResponse.amount.toString()
        });
      }

      const invoiceData = JSON.parse(invoiceResponse.invoiceData);
      console.log('[Төлбөрийн урсгал] Задласан нэхэмжлэхийн өгөгдөл:', {
        invoice_id: invoiceData.invoice_id,
        amount: invoiceData.amount
      });
      
      if (invoiceResponse.isNewInvoice && invoiceData.invoice_id) {
        console.log('[Төлбөрийн урсгал] ✅ ШИНЭ нэхэмжлэх үүсгэгдсэн - backend-д хадгалж байна');
        console.log('[Төлбөрийн урсгал] Нэхэмжлэхийн ID:', invoiceData.invoice_id);
        console.log('[Төлбөрийн урсгал] Дүнтэй хадгалж байна:', invoiceResponse.amount.toString());
        await storeInvoice.mutateAsync({
          invoiceId: invoiceData.invoice_id,
          invoiceData: invoiceResponse.invoiceData,
          amount: invoiceResponse.amount,
        });
        console.log('[Төлбөрийн урсгал] ✅ Нэхэмжлэх түүхэн дүнтэй амжилттай хадгалагдлаа');
        queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
        queryClient.invalidateQueries({ queryKey: ['userInvoice'] });
      } else {
        console.log('[Төлбөрийн урсгал] ♻️ ОДОО БАЙГАА нэхэмжлэх дахин ашиглагдсан - дахин хадгалахгүй');
        console.log('[Төлбөрийн урсгал] Одоо байгаа нэхэмжлэх хадгалагдсан дүнтэй:', invoiceResponse.amount.toString());
        console.log('[Төлбөрийн урсгал] Энэ нь админы нэхэмжлэхийн жагсаалтад давхардсан бичлэг үүсэхээс сэргийлнэ');
      }

      try {
        console.log('[Төлбөрийн урсгал] Төлбөр дүнтэй бүртгэж байна:', invoiceResponse.amount.toString());
        recordPayment.mutate({ amount: invoiceResponse.amount, status: 'pending' });
      } catch (error) {
        console.error('[Төлбөрийн урсгал] Төлбөр бүртгэхэд алдаа:', error);
        recordPayment.mutate({ amount: BigInt(10), status: 'pending' });
      }

      console.log('[Төлбөрийн урсгал] ✅ Төлбөрийн урсгал амжилттай дууслаа');
      return {
        invoiceData: invoiceResponse.invoiceData,
        token: token,
        invoiceId: invoiceData.invoice_id
      };
    },
    onSuccess: (response) => {
      console.log('[Төлбөрийн урсгал] Амжилттай callback - хариу ирлээ');
      toast.success('Төлбөрийн хүсэлт амжилттай үүсгэгдлээ!');
      queryClient.invalidateQueries({ queryKey: ['userInvoiceConfig'] });
    },
    onError: (error: Error) => {
      console.error('[Төлбөрийн урсгал] ❌ Төлбөрийн урсгалд алдаа:', error);
      if (error.message?.includes('Unauthorized')) {
        toast.error('Дахин нэвтэрнэ үү');
      } else if (error.message?.includes('QPay credentials not found')) {
        toast.error('QPay нэвтрэх мэдээлэл олдсонгүй. Администратортай холбогдоно уу.');
      } else {
        toast.error(`Төлбөр амжилтгүй: ${error.message}`);
      }
    },
  });
}

export function useStoreUserInvoice() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, invoiceData, amount }: { invoiceId: string; invoiceData: string; amount: bigint }) => {
      if (!actor) throw new Error('Actor олдсонгүй');
      console.log('[Нэхэмжлэх хадгалах] Нэхэмжлэх хадгалж байна:', invoiceId, 'дүнтэй:', amount.toString());
      return actor.storeUserInvoice(invoiceId, invoiceData, amount);
    },
    onSuccess: () => {
      console.log('[Нэхэмжлэх хадгалах] ✅ Нэхэмжлэх түүхэн дүнтэй амжилттай хадгалагдлаа');
      queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['userInvoice'] });
    },
    onError: (error: Error) => {
      console.error('[Нэхэмжлэх хадгалах] ❌ Нэхэмжлэх хадгалахад алдаа:', error);
    },
  });
}

export function useCheckPaymentStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ token, invoiceId }: { token: string; invoiceId: string }) => {
      if (!actor) throw new Error('Actor олдсонгүй');
      console.log('[Төлбөрийн төлөв] Нэхэмжлэхийн төлбөрийн төлөв шалгаж байна:', invoiceId);
      const isPaid = await actor.checkPaymentStatus(token, invoiceId);
      console.log('[Төлбөрийн төлөв] Төлбөрийн төлөв:', isPaid ? 'ТӨЛСӨН' : 'ХҮЛЭЭГДЭЖ БУЙ');
      return isPaid;
    },
    onSuccess: (isPaid) => {
      if (isPaid) {
        console.log('[Төлбөрийн төлөв] Төлбөр баталгаажлаа! Queries шинэчилж байна...');
        queryClient.invalidateQueries({ queryKey: ['userInvoice'] });
        queryClient.invalidateQueries({ queryKey: ['allInvoices'] });
        queryClient.invalidateQueries({ queryKey: ['userPayments'] });
        queryClient.invalidateQueries({ queryKey: ['allPayments'] });
        toast.success('Төлбөр амжилттай төлөгдлөө!');
      }
    },
    onError: (error: Error) => {
      console.error('[Төлбөрийн төлөв] Төлбөрийн төлөв шалгахад алдаа:', error);
    },
  });
}
