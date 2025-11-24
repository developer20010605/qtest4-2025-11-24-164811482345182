import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Loader2, QrCode, ArrowLeft, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useMakeQPayPayment, useGetInvoiceConfigForUser, useCheckPaymentStatus, useGetUserInvoice } from '../hooks/useQueries';

interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  qPay_shortUrl: string;
  urls: Array<{
    name: string;
    description: string;
    logo: string;
    link: string;
  }>;
}

interface PaymentData {
  invoiceData: string;
  token: string | null;
  invoiceId: string;
}

export default function UserDashboard() {
  const makePayment = useMakeQPayPayment();
  const { data: invoiceConfig, isLoading: configLoading } = useGetInvoiceConfigForUser();
  const { data: existingInvoice } = useGetUserInvoice();
  const checkPaymentStatus = useCheckPaymentStatus();
  
  const [invoiceData, setInvoiceData] = useState<QPayInvoiceResponse | null>(null);
  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'paid'>('pending');
  const [hasCheckedOnLoad, setHasCheckedOnLoad] = useState(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function to stop polling and reset state
  const cleanupAndRedirect = () => {
    console.log('[Cleanup] Stopping polling and resetting to homepage');
    
    // Clear polling interval immediately
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Reset all state to return to homepage view
    setInvoiceData(null);
    setPaymentToken(null);
    setPaymentError(null);
    setPaymentStatus('pending');
    setHasCheckedOnLoad(false);
    setShowQRModal(false);
  };

  // Automatic payment check on load if there's an unpaid invoice
  useEffect(() => {
    if (!hasCheckedOnLoad && existingInvoice && !existingInvoice.isPaid && paymentToken) {
      console.log('[Auto Check] Checking payment status on load for existing invoice');
      setHasCheckedOnLoad(true);
      checkPaymentStatus.mutate(
        { token: paymentToken, invoiceId: existingInvoice.invoiceId },
        {
          onSuccess: (isPaid) => {
            if (isPaid) {
              setPaymentStatus('paid');
            }
          }
        }
      );
    }
  }, [existingInvoice, paymentToken, hasCheckedOnLoad]);

  // Handle redirection after payment is confirmed
  useEffect(() => {
    if (paymentStatus === 'paid') {
      console.log('[Redirect] Payment confirmed, preparing to redirect to homepage...');
      
      // Clear polling interval immediately when payment is confirmed
      if (pollingIntervalRef.current) {
        console.log('[Redirect] Clearing polling interval immediately');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Wait 2 seconds to show success message, then redirect to homepage
      const redirectTimer = setTimeout(() => {
        console.log('[Redirect] Redirecting to homepage...');
        cleanupAndRedirect();
      }, 2000);

      return () => {
        clearTimeout(redirectTimer);
      };
    }
  }, [paymentStatus]);

  // Start polling when invoice is displayed
  useEffect(() => {
    if (invoiceData && paymentToken && paymentStatus !== 'paid') {
      console.log('[Polling] Starting 5-second payment status polling for invoice:', invoiceData.invoice_id);
      
      // Clear any existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Start polling every 5 seconds
      pollingIntervalRef.current = setInterval(() => {
        console.log('[Polling] Checking payment status...');
        setPaymentStatus('checking');
        
        checkPaymentStatus.mutate(
          { token: paymentToken, invoiceId: invoiceData.invoice_id },
          {
            onSuccess: (isPaid) => {
              if (isPaid) {
                console.log('[Polling] Payment confirmed! Stopping polling.');
                setPaymentStatus('paid');
                // Polling will be cleared by the redirect effect
              } else {
                setPaymentStatus('pending');
              }
            },
            onError: () => {
              setPaymentStatus('pending');
            }
          }
        );
      }, 5000);

      // Cleanup on unmount or when dependencies change
      return () => {
        if (pollingIntervalRef.current) {
          console.log('[Polling] Stopping payment status polling');
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [invoiceData, paymentToken, paymentStatus]);

  // Stop polling when user leaves the payment page
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        console.log('[Cleanup] Stopping payment status polling on unmount');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  const handlePay = async () => {
    setPaymentError(null);
    setPaymentStatus('pending');
    try {
      // Optimized payment flow:
      // 1. First checks for existing valid invoice (no token request)
      // 2. If existing invoice found, reuses it directly (skips token request)
      // 3. If no valid invoice, requests token and creates new invoice
      // This prevents unnecessary QPay API calls when reusing invoices
      const response: PaymentData = await makePayment.mutateAsync();
      const parsedResponse = JSON.parse(response.invoiceData);
      setInvoiceData(parsedResponse);
      setPaymentToken(response.token);
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'Төлбөр төлөхөд алдаа гарлаа');
    }
  };

  const handleBack = () => {
    // Stop polling and reset state when going back
    cleanupAndRedirect();
  };

  // Convert base64 QR image to data URL
  const getQRImageUrl = (qrImage: string) => {
    // Check if it's already a data URL
    if (qrImage.startsWith('data:')) {
      return qrImage;
    }
    // Otherwise, assume it's base64 and add the data URL prefix
    return `data:image/png;base64,${qrImage}`;
  };

  // Get display values from invoice config
  const displayAmount = invoiceConfig ? Number(invoiceConfig.amount) : 10;
  const displayDescription = invoiceConfig?.invoice_description || 'Railway эрх 12сар';

  // Invoice view - shown only after Pay button is clicked and invoice is created/retrieved
  // Hidden when payment is confirmed and redirecting
  if (invoiceData && paymentStatus !== 'paid') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card">
          <div className="container flex items-center justify-between py-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Төлбөр төлөх</h1>
            <Button variant="ghost" size="icon" onClick={() => setShowQRModal(true)}>
              <QrCode className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Payment Status Alert */}
        {paymentStatus === 'checking' && (
          <div className="container pt-4">
            <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Төлбөрийн төлөв шалгаж байна...
              </AlertDescription>
            </Alert>
          </div>
        )}

        {paymentStatus === 'pending' && (
          <div className="container pt-4">
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <Clock className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                Төлбөр хүлээгдэж байна. Төлбөр төлсний дараа автоматаар шалгагдана.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Amount Card */}
        <div className="container py-4">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Дүн:</span>
                  <span className="text-sm">{displayDescription}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Төлбөрийн дүн</span>
                  <span className="text-2xl font-bold">₮{displayAmount}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-muted-foreground">Төлөв:</span>
                  <Badge variant={paymentStatus === 'checking' ? 'default' : 'secondary'}>
                    {paymentStatus === 'checking' ? 'Шалгаж байна' : 'Хүлээгдэж байна'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Banks List */}
          <div className="space-y-2">
            {invoiceData.urls && invoiceData.urls.length > 0 ? (
              invoiceData.urls.map((bank, index) => (
                <a
                  key={index}
                  href={bank.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="hover:bg-accent transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 shrink-0 bg-white rounded-lg flex items-center justify-center overflow-hidden">
                          <img
                            src={bank.logo}
                            alt={bank.name}
                            className="w-10 h-10 object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base">{bank.name}</h3>
                          {bank.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {bank.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Төлбөрийн сувгууд олдсонгүй
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* QR Code Modal */}
        <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">QR код</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center p-4">
              <img
                src={getQRImageUrl(invoiceData.qr_image)}
                alt="Төлбөрийн QR код"
                className="w-full max-w-sm"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Success view - shown briefly when payment is confirmed before redirecting
  if (paymentStatus === 'paid') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="container max-w-md">
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200 text-lg">
              Төлбөр амжилттай төлөгдлөө! Та нүүр хуудас руу шилжиж байна...
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Initial view - no invoice shown until Pay button is clicked
  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Хэрэглэгчийн самбар</h1>
        <p className="text-muted-foreground">Төлбөр төлөх</p>
      </div>

      <div className="max-w-md mx-auto">
        {paymentError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{paymentError}</AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Төлбөр төлөх
            </CardTitle>
            <CardDescription>QPay-ээр төлбөр төлөх</CardDescription>
          </CardHeader>
          <CardContent>
            {configLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Уншиж байна...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Дүн:</span>
                    <span className="text-2xl font-bold">₮{displayAmount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{displayDescription}</p>
                </div>
                <Button onClick={handlePay} disabled={makePayment.isPending} className="w-full" size="lg">
                  {makePayment.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Уншиж байна...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Төлөх
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
