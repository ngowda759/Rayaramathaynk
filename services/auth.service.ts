import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  UserCredential,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

class AuthService {
  async register({
    name,
    email,
    password,
  }: RegisterData): Promise<UserCredential> {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: name,
      });
    }

    return credential;
  }

  async login(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async logout(): Promise<void> {
    return signOut(auth);
  }

  async forgotPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(auth, email);
  }

  currentUser() {
    return auth.currentUser;
  }
}

export const authService = new AuthService();
