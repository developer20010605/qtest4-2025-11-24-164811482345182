import { useEffect, useState } from 'react';
import { useInternetIdentity } from './hooks/useInternetIdentity';
import { useGetCallerUserProfile, useGetCallerUserRole, useEnsureUserRegistration } from './hooks/useQueries';
import { useActor } from './hooks/useActor';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import Header from './components/Header';
import Footer from './components/Footer';
import ProfileSetupModal from './components/ProfileSetupModal';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { identity, isInitializing: identityInitializing } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();
  
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registrationAttempted, setRegistrationAttempted] = useState(false);
  
  const ensureRegistration = useEnsureUserRegistration();
  
  const { data: userRole, isLoading: roleLoading, isFetched: roleFetched } = useGetCallerUserRole(registrationComplete);
  const { data: userProfile, isLoading: profileLoading, isFetched: profileFetched } = useGetCallerUserProfile(registrationComplete);

  const isAuthenticated = !!identity;
  const isActorReady = !!actor && !actorFetching;
  
  const showProfileSetup = isAuthenticated && registrationComplete && !profileLoading && profileFetched && userProfile === null;

  useEffect(() => {
    if (isAuthenticated && isActorReady && !registrationAttempted && !ensureRegistration.isPending) {
      console.log('[App] Хэрэглэгч нэвтэрсэн, бүртгэл шалгаж байна...');
      setRegistrationAttempted(true);
      ensureRegistration.mutate(undefined, {
        onSuccess: () => {
          console.log('[App] Бүртгэл амжилттай');
          setRegistrationComplete(true);
        },
        onError: (error) => {
          console.error('[App] Бүртгэл амжилтгүй:', error);
          setTimeout(() => {
            console.log('[App] Дахин оролдож байна...');
            setRegistrationAttempted(false);
          }, 2000);
        }
      });
    }
  }, [isAuthenticated, isActorReady, registrationAttempted, ensureRegistration]);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[App] Хэрэглэгч гарсан, бүртгэлийг цэвэрлэж байна');
      setRegistrationComplete(false);
      setRegistrationAttempted(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && roleFetched && userRole) {
      console.log('[App] Хэрэглэгчийн эрх:', userRole);
    }
  }, [isAuthenticated, roleFetched, userRole]);

  const isLoadingUserData = isAuthenticated && (
    !isActorReady ||
    !registrationComplete || 
    profileLoading || 
    roleLoading || 
    !roleFetched
  );

  if (identityInitializing || actorFetching || isLoadingUserData) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Ачааллаж байна...</p>
          </div>
        </div>
        <Toaster />
      </ThemeProvider>
    );
  }

  const isAdmin = userRole === 'admin';
  const isUser = userRole === 'user';

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          {!isAuthenticated ? (
            <LandingPage />
          ) : isAdmin ? (
            <AdminDashboard />
          ) : isUser ? (
            <UserDashboard />
          ) : (
            <div className="container py-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Хандалт хүлээгдэж байна</h2>
                <p className="text-muted-foreground">
                  Таны хандалтын түвшин тодорхойгүй байна. Администратортай холбогдоно уу.
                </p>
              </div>
            </div>
          )}
        </main>
        <Footer />
        <ProfileSetupModal open={showProfileSetup} />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
