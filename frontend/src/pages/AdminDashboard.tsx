import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Loader2, Save, AlertCircle, Receipt, RefreshCw } from 'lucide-react';
import { 
  useGetQPayCredentials, 
  useSaveQPayCredentials, 
  useGetQPayInvoiceConfig,
  useSaveQPayInvoiceConfig,
  useGetAllInvoices
} from '../hooks/useQueries';
import type { QPayCredentials, QPayInvoiceConfig } from '../backend';
import { formatTimestamp } from '../lib/utils';

export default function AdminDashboard() {
  const { data: credentials, isLoading: credentialsLoading, error: credentialsError } = useGetQPayCredentials();
  const { data: invoiceConfig, isLoading: configLoading, error: configError, refetch: refetchConfig } = useGetQPayInvoiceConfig();
  const { data: invoices, isLoading: invoicesLoading, error: invoicesError, refetch: refetchInvoices } = useGetAllInvoices();
  const saveCredentials = useSaveQPayCredentials();
  const saveInvoiceConfig = useSaveQPayInvoiceConfig();

  const [credentialsForm, setCredentialsForm] = useState<QPayCredentials>({
    client_username: '',
    client_password: '',
    client_invoice: '',
  });

  const [invoiceConfigForm, setInvoiceConfigForm] = useState<QPayInvoiceConfig>({
    sender_invoice_no: '12345678',
    invoice_receiver_code: 'terminal',
    invoice_description: 'Railway эрх 12сар',
    amount: BigInt(10),
  });

  const [isCredentialsFormDirty, setIsCredentialsFormDirty] = useState(false);
  const [isConfigFormDirty, setIsConfigFormDirty] = useState(false);

  // Update credentials form when data loads
  useEffect(() => {
    if (credentials && !isCredentialsFormDirty) {
      setCredentialsForm(credentials);
    }
  }, [credentials, isCredentialsFormDirty]);

  // Update invoice config form when data loads
  useEffect(() => {
    if (invoiceConfig && !isConfigFormDirty) {
      setInvoiceConfigForm(invoiceConfig);
    }
  }, [invoiceConfig, isConfigFormDirty]);

  // Refetch config and invoices when component mounts to ensure fresh data
  useEffect(() => {
    console.log('[Admin Dashboard] Component mounted - refetching data');
    refetchConfig();
    refetchInvoices();
  }, [refetchConfig, refetchInvoices]);

  const handleCredentialsInputChange = (field: keyof QPayCredentials, value: string) => {
    setCredentialsForm((prev) => ({ ...prev, [field]: value }));
    setIsCredentialsFormDirty(true);
  };

  const handleInvoiceConfigInputChange = (field: keyof QPayInvoiceConfig, value: string | bigint) => {
    setInvoiceConfigForm((prev) => ({ ...prev, [field]: value }));
    setIsConfigFormDirty(true);
  };

  const handleSaveCredentials = () => {
    saveCredentials.mutate(credentialsForm, {
      onSuccess: () => {
        setIsCredentialsFormDirty(false);
      },
    });
  };

  const handleSaveInvoiceConfig = () => {
    console.log('[Admin Dashboard] Saving invoice config:', invoiceConfigForm);
    saveInvoiceConfig.mutate(invoiceConfigForm, {
      onSuccess: () => {
        console.log('[Admin Dashboard] Invoice config saved successfully');
        setIsConfigFormDirty(false);
        // Refetch invoices to show updated data
        refetchInvoices();
      },
    });
  };

  const handleRefreshInvoices = () => {
    console.log('[Admin Dashboard] Manual refresh triggered');
    refetchConfig();
    refetchInvoices();
  };

  // Log invoice data for debugging
  useEffect(() => {
    if (invoices) {
      console.log('[Admin Dashboard] Total invoices loaded:', invoices.length);
      console.log('[Admin Dashboard] Current invoice config amount:', invoiceConfig?.amount.toString());
      invoices.forEach(([id, inv]) => {
        console.log(`[Admin Dashboard] Invoice ${id}: stored amount = ${inv.amount.toString()}`);
      });
    }
  }, [invoices, invoiceConfig]);

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Админ самбар</h1>
        <p className="text-muted-foreground">Системийн тохиргоо болон төлбөрийн мэдээлэл</p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            QPay тохиргоо
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Төлбөрүүд
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          {/* QPay Credentials */}
          <Card>
            <CardHeader>
              <CardTitle>QPay холболтын мэдээлэл</CardTitle>
              <CardDescription>QPay-н холболтын мэдээллийг оруулна уу</CardDescription>
            </CardHeader>
            <CardContent>
              {credentialsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Уншиж байна...</span>
                </div>
              ) : credentialsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Тохиргоо татахад алдаа гарлаа. Та дахин нэвтэрнэ үү.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {!credentials && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        QPay тохиргоо хийгдээгүй байна. Доорх мэдээллийг оруулна уу.
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="username">Хэрэглэгчийн нэр</Label>
                    <Input
                      id="username"
                      value={credentialsForm.client_username}
                      onChange={(e) => handleCredentialsInputChange('client_username', e.target.value)}
                      placeholder="client_username оруулна уу"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Нууц үг</Label>
                    <Input
                      id="password"
                      type="password"
                      value={credentialsForm.client_password}
                      onChange={(e) => handleCredentialsInputChange('client_password', e.target.value)}
                      placeholder="client_password оруулна уу"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice">Нэхэмжлэхийн код</Label>
                    <Input
                      id="invoice"
                      value={credentialsForm.client_invoice}
                      onChange={(e) => handleCredentialsInputChange('client_invoice', e.target.value)}
                      placeholder="client_invoice оруулна уу"
                    />
                  </div>
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={saveCredentials.isPending || !isCredentialsFormDirty}
                    className="w-full"
                  >
                    {saveCredentials.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Хадгалж байна...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Хадгалах
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Нэхэмжлэхийн тохиргоо</CardTitle>
              <CardDescription>Нэхэмжлэхийн үндсэн мэдээллийг тохируулна уу</CardDescription>
            </CardHeader>
            <CardContent>
              {configLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Уншиж байна...</span>
                </div>
              ) : configError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Тохиргоо татахад алдаа гарлаа. Та дахин нэвтэрнэ үү.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sender_invoice_no">Илгээгчийн нэхэмжлэхийн дугаар</Label>
                    <Input
                      id="sender_invoice_no"
                      value={invoiceConfigForm.sender_invoice_no}
                      onChange={(e) => handleInvoiceConfigInputChange('sender_invoice_no', e.target.value)}
                      placeholder="12345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_receiver_code">Хүлээн авагчийн код</Label>
                    <Input
                      id="invoice_receiver_code"
                      value={invoiceConfigForm.invoice_receiver_code}
                      onChange={(e) => handleInvoiceConfigInputChange('invoice_receiver_code', e.target.value)}
                      placeholder="terminal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_description">Тайлбар</Label>
                    <Input
                      id="invoice_description"
                      value={invoiceConfigForm.invoice_description}
                      onChange={(e) => handleInvoiceConfigInputChange('invoice_description', e.target.value)}
                      placeholder="Railway эрх 12сар"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Дүн</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={invoiceConfigForm.amount.toString()}
                      onChange={(e) => handleInvoiceConfigInputChange('amount', BigInt(e.target.value || '0'))}
                      placeholder="10"
                    />
                  </div>
                  <Button
                    onClick={handleSaveInvoiceConfig}
                    disabled={saveInvoiceConfig.isPending || !isConfigFormDirty}
                    className="w-full"
                  >
                    {saveInvoiceConfig.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Хадгалж байна...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Хадгалах
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Бүх төлбөрүүд</CardTitle>
                  <CardDescription>
                    Хэрэглэгчдийн төлбөрийн түүх
                    {invoices && invoices.length > 0 && (
                      <span className="ml-2 text-sm font-medium">
                        (Нийт: {invoices.length})
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshInvoices}
                  disabled={invoicesLoading || configLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${invoicesLoading || configLoading ? 'animate-spin' : ''}`} />
                  Шинэчлэх
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invoicesLoading || configLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Уншиж байна...</span>
                </div>
              ) : invoicesError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Төлбөрийн мэдээлэл татахад алдаа гарлаа. Та дахин нэвтэрнэ үү.
                  </AlertDescription>
                </Alert>
              ) : invoices && invoices.length > 0 ? (
                <div className="space-y-4">
                  {invoiceConfig && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Одоогийн тохируулсан дүн: <strong>₮{invoiceConfig.amount.toString()}</strong>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          Доорх жагсаалтад нэхэмжлэх бүрийн үүсгэсэн үеийн дүн харагдана
                        </span>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Хэрэглэгч</TableHead>
                          <TableHead>Дүн</TableHead>
                          <TableHead>Төлөв</TableHead>
                          <TableHead>Огноо</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map(([invoiceId, invoice]) => {
                          return (
                            <TableRow key={invoiceId}>
                              <TableCell className="font-mono text-xs">
                                {invoice.user.toString().slice(0, 20)}...
                              </TableCell>
                              <TableCell className="font-medium">₮{invoice.amount.toString()}</TableCell>
                              <TableCell>
                                <Badge variant={invoice.isPaid ? 'default' : 'secondary'}>
                                  {invoice.isPaid ? 'Төлсөн' : 'Хүлээгдэж буй'}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatTimestamp(invoice.createdAt)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Төлбөр олдсонгүй</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Хэрэглэгчид төлбөр төлсний дараа энд харагдана
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
