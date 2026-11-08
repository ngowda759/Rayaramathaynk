"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { setAuthTokenGetter } from "@/lib/api/auth-token";
import {
  authService,
  RegisterData,
} from "@/services/auth.service";

import { UserProfile, UserRole, normalizeRole, NormalizedRole } from "@/types/user";
import { mapFirestoreRole } from "@/lib/seva/permissions";
import type { SevaRole } from "@/types/seva";

export interface AuthUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
  getIdToken: () => Promise<string>;
  rawUser?: unknown;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  normalizedRole: NormalizedRole;
  /**
   * The Seva Entry role read from the user profile role (C-62): temple_admin and legacy admin -> temple_admin; billing,
   * priest, staff and everything else -> null. Only hides and routes in the browser; the seva API decides access.
   */
  sevaRole: SevaRole | null;
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

function formatAuthUser(supaUser: any, token?: string): AuthUser {
  const email = supaUser.email ?? null;
  const name =
    supaUser.user_metadata?.name ||
    supaUser.user_metadata?.full_name ||
    supaUser.user_metadata?.displayName ||
    (email ? email.split("@")[0] : null);

  return {
    id: supaUser.id,
    uid: supaUser.id,
    email,
    displayName: name,
    photoURL: supaUser.user_metadata?.avatar_url || supaUser.user_metadata?.picture || supaUser.photoURL || null,
    emailVerified: !!supaUser.email_confirmed_at,
    getIdToken: async () => {
      try {
        const supabase = createClient();
        const session = (await supabase.auth.getSession()).data.session;
        return session?.access_token || token || "";
      } catch {
        return token || "";
      }
    },
    rawUser: supaUser,
  };
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    try {
      const data = await authService.getUserProfile(uid);
      setProfile(data as UserProfile | null);
    } catch (error) {
      console.error("[AuthContext] Failed to load user profile:", error);
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
    let isMounted = true;
    const supabase = createClient();

    // Register the browser access-token provider used by `lib/api/fetch.ts`.
    // Attaches the signed-in user's Supabase access token to every `/api/**` request.
    setAuthTokenGetter(async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        return session?.access_token || null;
      } catch {
        return null;
      }
    });

    // 1. Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        const authUser = formatAuthUser(session.user, session.access_token);
        setUser(authUser);
        await loadProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    }).catch((err) => {
      console.error("[AuthContext] Failed to get Supabase session:", err);
      if (isMounted) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    // 2. Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          const authUser = formatAuthUser(session.user, session.access_token);
          setUser(authUser);
          await loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // 3. Compatibility fallback: Firebase Auth listener for rollback and zero-lockout
    let unsubscribeFirebase: (() => void) | undefined;
    (async () => {
      try {
        const { auth } = await import("@/lib/firebase");
        const { onAuthStateChanged } = await import("firebase/auth");
        if (auth && typeof onAuthStateChanged === "function") {
          unsubscribeFirebase = onAuthStateChanged(auth, async (fbUser: any) => {
            if (!isMounted) return;
            const currentSupa = (await supabase.auth.getSession()).data?.session;
            if (!currentSupa?.user && fbUser) {
              setUser({
                id: fbUser.uid,
                uid: fbUser.uid,
                email: fbUser.email ?? null,
                displayName: fbUser.displayName ?? null,
                emailVerified: fbUser.emailVerified ?? false,
                getIdToken: typeof fbUser.getIdToken === "function" ? () => fbUser.getIdToken() : async () => "",
                rawUser: fbUser,
              });
              await loadProfile(fbUser.uid);
              setLoading(false);
            }
          });
        }
      } catch {
        // Firebase optional
      }
    })();

    return () => {
      isMounted = false;
      setAuthTokenGetter(null);
      subscription?.unsubscribe();
      if (unsubscribeFirebase) unsubscribeFirebase();
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
    setUser(null);
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
  const sevaRole = mapFirestoreRole(profile?.role);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        normalizedRole,
        sevaRole,
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
