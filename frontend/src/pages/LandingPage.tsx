import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Shield, Zap } from 'lucide-react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';

export default function LandingPage() {
  const { login, loginStatus } = useInternetIdentity();

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="container py-20 text-center space-y-6">
        <div className="inline-block p-3 rounded-full bg-primary/10 mb-4">
          <CreditCard className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">QPay Төлбөрийн систем</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Хялбар, хурдан, найдвартай төлбөрийн шийдэл
        </p>
        <Button size="lg" onClick={handleLogin} disabled={loginStatus === 'logging-in'} className="mt-8">
          {loginStatus === 'logging-in' ? 'Нэвтэрч байна...' : 'Эхлэх'}
        </Button>
      </section>

      {/* Features Section */}
      <section className="container py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Онцлог шинж чанарууд</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Хурдан төлбөр</CardTitle>
              <CardDescription>Хэдхэн секундын дотор төлбөрөө төлөөрэй</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                QPay-н олон төрлийн банкуудаар хурдан шуурхай төлбөр төлөх боломжтой
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Найдвартай</CardTitle>
              <CardDescription>Таны мэдээлэл аюулгүй хадгалагдана</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Internet Computer блокчэйн дээр суурилсан найдвартай систем
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Олон банк</CardTitle>
              <CardDescription>Өөрийн банкаа сонгоорой</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Монгол улсын бүх томоохон банкуудтай холбогдсон
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Хэрхэн ажилладаг вэ?</h2>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold">
              1
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Нэвтрэх</h3>
              <p className="text-muted-foreground">Internet Identity ашиглан аюулгүй нэвтэрнэ үү</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Төлбөр төлөх</h3>
              <p className="text-muted-foreground">Төлбөр товчийг дарж QPay-р төлбөрөө төлнө үү</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold">
              3
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Банк сонгох</h3>
              <p className="text-muted-foreground">Өөрийн банкаа сонгож төлбөрөө баталгаажуулна уу</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
