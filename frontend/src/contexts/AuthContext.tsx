import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authApi, type User } from "../api/auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
  register: (
    email: string,
    password1: string,
    password2: string,
    inviteToken?: string
  ) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getUser();
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    await authApi.login(email, password);
    await refreshUser();
  };

  const demoLogin = async () => {
    await authApi.demoLogin();
    await refreshUser();
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    // Clear per-user client state so the next account doesn't inherit it.
    try {
      sessionStorage.clear();
      Object.keys(localStorage)
        .filter((k) => k.startsWith("easyecookbook_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage may be unavailable; ignore */
    }
  };

  const register = async (
    email: string,
    password1: string,
    password2: string,
    inviteToken?: string
  ) => {
    await authApi.register(email, password1, password2, inviteToken);
    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        demoLogin,
        logout,
        register,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
