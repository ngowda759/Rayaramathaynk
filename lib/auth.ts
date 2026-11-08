import {
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  User,
} from "firebase/auth";

import { auth } from "./firebase";

export async function logoutUser() {
  if (!auth) return;
  await signOut(auth);
}

export async function resetPassword(email: string) {
  if (!auth) {
    throw new Error("Firebase is not configured");
  }
  await sendPasswordResetEmail(auth, email);
}

export async function resendVerification(user: User) {
  await sendEmailVerification(user);
}
