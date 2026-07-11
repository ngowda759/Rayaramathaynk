import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  UserCredential,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db, getFirebaseConfigStatus } from "@/lib/firebase";

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
    if (!auth || !db) throw this.getFirebaseError();
    
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(credential.user, {
      displayName: name,
    });

    await sendEmailVerification(credential.user);

    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name,
      email,
      phone,
      role: "devotee",
      templeId: "main",
      profileImage: "",
      isApproved: false,
      isActive: true,
      emailVerified: false,
      lastLogin: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return credential;
  }

  async login(
    email: string,
    password: string
  ): Promise<UserCredential> {
    if (!auth || !db) throw this.getFirebaseError();
    
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const userRef = doc(db, "users", credential.user.uid);
    const profileSnapshot = await getDoc(userRef);
    const existingProfile = profileSnapshot.exists()
      ? profileSnapshot.data()
      : undefined;

    await setDoc(
      userRef,
      {
        uid: credential.user.uid,
        name:
          existingProfile?.name ??
          credential.user.displayName ??
          credential.user.email?.split("@")[0] ??
          "",
        email: existingProfile?.email ?? credential.user.email ?? email,
        phone: existingProfile?.phone ?? "",
        role: existingProfile?.role ?? "devotee",
        templeId: existingProfile?.templeId ?? "main",
        profileImage: existingProfile?.profileImage ?? "",
        isApproved: existingProfile?.isApproved ?? false,
        isActive: existingProfile?.isActive ?? true,
        emailVerified: credential.user.emailVerified,
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(profileSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );

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
    if (!db) throw this.getFirebaseError();
    const snapshot = await getDoc(doc(db, "users", uid));

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  }

  currentUser() {
    return auth?.currentUser ?? null;
  }
}

export const authService = new AuthService();
