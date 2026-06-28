"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import {
  loginUser,
  logoutUser,
  registerUser,
  resetPassword,
} from "@/lib/auth";

import { UserProfile } from "@/types/user";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;

  register: (
    name: string,
    email: string,
    phone: string,
    password: string
  ) => Promise<void>;

  logout: () => Promise<void>;

  forgotPassword: (email: string) => Promise<void>;

  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  const [userProfile, setUserProfile] =
    useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const snapshot = await getDoc(doc(db, "users", uid));

    if (snapshot.exists()) {
      setUserProfile(snapshot.data() as UserProfile);
    } else {
      setUserProfile(null);
    }
  }

  async function refreshProfile() {
    if (!user) return;

    await loadProfile(user.uid);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function login(email: string, password: string) {
    await loginUser(email, password);
  }

  async function register(
    name: string,
    email: string,
    phone: string,
    password: string
  ) {
    await registerUser(name, email, phone, password);
  }

  async function logout() {
    await logoutUser();
  }

  async function forgotPassword(email: string) {
    await resetPassword(email);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
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
    throw new Error("useAuthContext must be used within AuthProvider");
  }

  return context;
}
