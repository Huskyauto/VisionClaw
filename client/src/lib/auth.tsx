import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AuthContextType {
  token: string | null;
  authRequired: boolean;
  isChecking: boolean;
  login: (pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  authRequired: false,
  isChecking: true,
  login: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("vc_token"));
  const [authRequired, setAuthRequired] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setAuthRequired(data.authRequired);

      if (data.authRequired && token) {
        const verify = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (verify.status === 401) {
          setToken(null);
          localStorage.removeItem("vc_token");
        }
      }
    } catch {
      setAuthRequired(false);
    } finally {
      setIsChecking(false);
    }
  }, [token]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (pin: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }
    const data = await res.json();
    setToken(data.token);
    localStorage.setItem("vc_token", data.token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("vc_token");
  }, []);

  return (
    <AuthContext.Provider value={{ token, authRequired, isChecking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
