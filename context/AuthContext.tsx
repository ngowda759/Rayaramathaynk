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

import { UserProfile } from "@/types/user";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;

  register: (data: RegisterData) => Promise<void>;

  logout: () => Promise<void>;

  forgotPassword: (email: string) => Promise<void>;

  refreshProfile: () => Promise<void>;
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

    await loadProfile(user.uid);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setLoading(true);

        try {
          setUser(firebaseUser);

          if (firebaseUser) {
            await loadProfile(firebaseUser.uid);
          } else {
            setProfile(null);
          }
        } finally {
          setLoading(false);
        }
      }
    );

    return unsubscribe;
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

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        register,
        logout,
        forgotPassword,
        refreshProfile,
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
