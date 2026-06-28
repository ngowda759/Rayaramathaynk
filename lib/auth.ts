import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";

import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export async function registerUser(
  name: string,
  email: string,
  phone: string,
  password: string
) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = credential.user;

  await updateProfile(user, {
    displayName: name,
  });

  await sendEmailVerification(user);

  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
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

  return user;
}

export async function loginUser(
  email: string,
  password: string
) {
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

  return credential.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function resendVerification(user: User) {
  await sendEmailVerification(user);
}
