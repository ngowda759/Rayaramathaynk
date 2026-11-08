import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  UserCredential,
} from "firebase/auth";

import { auth, getFirebaseConfigStatus } from "@/lib/firebase";

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

class AuthService {
  private getFirebaseError(): Error {
    const status = getFirebaseConfigStatus();
    if (!status.isValid) {
      const missing = status.missingFields.join(", ");
      return new Error(`Firebase not configured. Missing: ${missing}`);
    }
    return new Error("Firebase not configured");
  }

  async register({
    name,
    email,
    phone,
    password,
  }: RegisterData): Promise<UserCredential> {
    if (!auth) throw this.getFirebaseError();
    
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(credential.user, {
      displayName: name,
    });

    await sendEmailVerification(credential.user);

    // Sync profile to Supabase backend
    try {
      const token = await credential.user.getIdToken();
      await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          name: name,
          phone: phone,
        }),
      });
    } catch (error) {
      console.error("Failed to sync user profile on register:", error);
    }

    return credential;
  }

  async login(
    email: string,
    password: string
  ): Promise<UserCredential> {
    if (!auth) throw this.getFirebaseError();
    
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Sync profile to Supabase backend
    try {
      const token = await credential.user.getIdToken();
      await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: credential.user.email,
          name: credential.user.displayName,
          profileImage: credential.user.photoURL,
        }),
      });
    } catch (error) {
      console.error("Failed to sync user profile on login:", error);
    }

    return credential;
  }

  async logout(): Promise<void> {
    if (!auth) return;
    await signOut(auth);
  }

  async forgotPassword(email: string): Promise<void> {
    if (!auth) throw this.getFirebaseError();
    await sendPasswordResetEmail(auth, email);
  }

  async getUserProfile(uid: string) {
    const user = this.currentUser();
    if (!user || user.uid !== uid) return null;

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/auth/profile", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.profile || null;
    } catch (error) {
      console.error("Failed to get user profile:", error);
      return null;
    }
  }

  currentUser() {
    return auth?.currentUser ?? null;
  }
}

export const authService = new AuthService();
