"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { User, onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import {
  authService,
  RegisterData,
} from "@/services/auth.service";

import { UserProfile, UserRole, normalizeRole, NormalizedRole } from "@/types/user";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  normalizedRole: NormalizedRole;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;

  register: (data: RegisterData) => Promise<void>;

  logout: () => Promise<void>;

  forgotPassword: (email: string) => Promise<void>;

  refreshProfile: () => Promise<void>;
  
  // Permission helpers
  canAccessAdmin: boolean;
  canAccessSettings: boolean;
  canAccessFinance: boolean;
  canManageUsers: boolean;
  canAccessBilling: boolean;
  canAccessAdministration: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    try {
      const data = await authService.getUserProfile(uid);

      setProfile(data as UserProfile | null);
    } catch (error) {
      console.error("Failed to load user profile:", error);
      setProfile(null);
    }
  }

  async function refreshProfile() {
    if (!user) return;
    setLoading(true);
    await loadProfile(user.uid);
    setLoading(false);
  }

  useEffect(() => {
    // Skip Firebase auth if not properly configured
    if (!auth) {
      console.log("Firebase auth not configured - skipping auth listener");
      // Use setTimeout to avoid synchronous state update during effect
      setTimeout(() => setLoading(false), 0);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          // Use setTimeout to avoid synchronous state update during effect
          setTimeout(() => setLoading(true), 0);

          try {
            setUser(firebaseUser);

            if (firebaseUser) {
              await loadProfile(firebaseUser.uid);
            } else {
              setProfile(null);
            }
          } catch (err) {
            console.error("Auth state change error:", err);
            setProfile(null);
          } finally {
            setTimeout(() => setLoading(false), 0);
          }
        }
      );
    } catch (err) {
      console.error("Firebase auth initialization error:", err);
      setTimeout(() => setLoading(false), 0);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  async function login(
    email: string,
    password: string
  ) {
    await authService.login(email, password);
  }

  async function register(data: RegisterData) {
    await authService.register(data);
  }

  async function logout() {
    await authService.logout();
    setProfile(null);
  }

  async function forgotPassword(email: string) {
    await authService.forgotPassword(email);
  }

  // Role-based permissions
  const normalizedRole = profile?.role ? normalizeRole(profile.role as UserRole) : "devotee";
  
  // Super Admin: Access to everything
  // Temple Admin: All except Finance and Administration
  // Billing: Only Finance module
  const canAccessAdmin = normalizedRole !== "devotee" && normalizedRole !== "volunteer";
  const canAccessSettings = normalizedRole === "super_admin" || normalizedRole === "admin";
  const canAccessFinance = normalizedRole === "super_admin" || normalizedRole === "billing";
  const canManageUsers = normalizedRole === "super_admin";
  const canAccessBilling = normalizedRole === "super_admin" || normalizedRole === "billing";
  const canAccessAdministration = normalizedRole === "super_admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        normalizedRole,
        loading,
        login,
        register,
        logout,
        forgotPassword,
        refreshProfile,
        canAccessAdmin,
        canAccessSettings,
        canAccessFinance,
        canManageUsers,
        canAccessBilling,
        canAccessAdministration,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthContext must be used within AuthProvider"
    );
  }

  return context;
}
