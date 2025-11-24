import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';
import { useGetCallerUserProfile, useGetCallerUserRole } from '../hooks/useQueries';
import { LogIn, LogOut, Loader2, Shield, User } from 'lucide-react';

export default function Header() {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const { data: userProfile } = useGetCallerUserProfile();
  const { data: userRole } = useGetCallerUserRole();

  const isAuthenticated = !!identity;
  const disabled = loginStatus === 'logging-in';

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
    } else {
      try {
        await login();
      } catch (error: any) {
        console.error('Login error:', error);
        if (error.message === 'User is already authenticated') {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  return (
    <header className="border-b bg-card">
      <div className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">Q</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">QPay Төлбөр</h1>
            {isAuthenticated && userProfile && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">Сайн байна уу, {userProfile.name}</p>
                {userRole === 'admin' && (
                  <Badge variant="default" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    Админ
                  </Badge>
                )}
                {userRole === 'user' && (
                  <Badge variant="secondary" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    Хэрэглэгч
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <Button onClick={handleAuth} disabled={disabled} variant={isAuthenticated ? 'outline' : 'default'}>
          {disabled ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Нэвтэрч байна...
            </>
          ) : isAuthenticated ? (
            <>
              <LogOut className="mr-2 h-4 w-4" />
              Гарах
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Нэвтрэх
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
