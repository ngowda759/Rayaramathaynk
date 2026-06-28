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
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

class AuthService {
  async register({
    name,
    email,
    phone,
    password,
  }: RegisterData): Promise<UserCredential> {
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
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateDoc(doc(db, "users", credential.user.uid), {
      lastLogin: serverTimestamp(),
      emailVerified: credential.user.emailVerified,
      updatedAt: serverTimestamp(),
    });

    return credential;
  }

  async logout(): Promise<void> {
    await signOut(auth);
  }

  async forgotPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  async getUserProfile(uid: string) {
    const snapshot = await getDoc(doc(db, "users", uid));

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data();
  }

  currentUser() {
    return auth.currentUser;
  }
}

export const authService = new AuthService();
