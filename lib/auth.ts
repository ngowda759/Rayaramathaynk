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
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db, isFirebaseConfigured } from "./firebase";

export async function registerUser(
  name: string,
  email: string,
  phone: string,
  password: string
) {
  if (!auth || !db) {
    throw new Error("Firebase is not configured");
  }

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
  if (!auth || !db) {
    throw new Error("Firebase is not configured");
  }

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

  return credential.user;
}

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
