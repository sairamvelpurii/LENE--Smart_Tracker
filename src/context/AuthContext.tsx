import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "../types";
import {
  getSessionUserId,
  loginUser,
  loadUsers,
  registerUser,
  setSessionUserId,
} from "../lib/authStore";

interface AuthValue {
  user: User | null;
  login: (email: string, password: string) => void;
  register: (email: string, password: string, name: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const id = getSessionUserId();
    if (!id) return null;
    const u = loadUsers().find((x) => x.id === id);
    return u ?? null;
  });

  const login = useCallback((email: string, password: string) => {
    const u = loginUser(email, password);
    setSessionUserId(u.id);
    setUser(u);
  }, []);

  const register = useCallback(
    (email: string, password: string, name: string) => {
      const u = registerUser(email, password, name);
      setSessionUserId(u.id);
      setUser(u);
    },
    [],
  );

  const logout = useCallback(() => {
    setSessionUserId(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, register, logout }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
