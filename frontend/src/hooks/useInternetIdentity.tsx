// frontend/src/hooks/useInternetIdentity.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { AuthClient } from "@dfinity/auth-client";
import type { Identity } from "@dfinity/agent";

type LoginStatus = "idle" | "logging-in";

type InternetIdentityContextValue = {
  authClient: AuthClient | null;
  identity: Identity | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  loginStatus: LoginStatus;
  login: () => Promise<void>;
  clear: () => Promise<void>;
};

const InternetIdentityContext =
  createContext<InternetIdentityContextValue | null>(null);

type ProviderProps = {
  children: ReactNode;
};

export const InternetIdentityProvider: React.FC<ProviderProps> = ({
  children,
}) => {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>("idle");

  // Анхдагч – AuthClient үүсгээд одоогийн session-ийг шалгах
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const client = await AuthClient.create();
        if (cancelled) return;

        setAuthClient(client);

        const authenticated = await client.isAuthenticated();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          const id = client.getIdentity();
          setIdentity(id);
        }
      } catch (e) {
        console.error("Failed to init Internet Identity", e);
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    if (!authClient) return;

    if (await authClient.isAuthenticated()) {
      // Header дээр ашиглаж буй "User is already authenticated" logic
      throw new Error("User is already authenticated");
    }

    setLoginStatus("logging-in");

    try {
      await authClient.login({
        identityProvider:
          import.meta.env.VITE_II_CANISTER_URL ?? "https://identity.ic0.app",
        onSuccess: async () => {
          const authenticated = await authClient.isAuthenticated();
          setIsAuthenticated(authenticated);

          if (authenticated) {
            const id = authClient.getIdentity();
            setIdentity(id);
          }

          setLoginStatus("idle");
        },
        onError: (err) => {
          console.error("Internet Identity login error", err);
          setLoginStatus("idle");
        },
      });
    } catch (e) {
      console.error("Internet Identity login failed", e);
      setLoginStatus("idle");
      throw e;
    }
  }, [authClient]);

  const clear = useCallback(async () => {
    if (!authClient) return;
    await authClient.logout();
    setIsAuthenticated(false);
    setIdentity(null);
  }, [authClient]);

  const value: InternetIdentityContextValue = {
    authClient,
    identity,
    isAuthenticated,
    isInitializing,
    loginStatus,
    login,
    clear,
  };

  return (
    <InternetIdentityContext.Provider value={value}>
      {children}
    </InternetIdentityContext.Provider>
  );
};

export function useInternetIdentity() {
  const ctx = useContext(InternetIdentityContext);
  if (!ctx) {
    throw new Error(
      "useInternetIdentity must be used within an InternetIdentityProvider"
    );
  }
  return ctx;
}
