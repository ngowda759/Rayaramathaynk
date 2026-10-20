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
import { buildSignInProfileWrite } from "./auth/sign-in-profile";

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

  // role, isApproved and isActive go only into a new profile; an existing
  // one keeps the values the staff API wrote (firestore.rules refuses any
  // client write that adds or changes them).
  await setDoc(
    userRef,
    buildSignInProfileWrite({
      account: credential.user,
      typedEmail: email,
      existingProfile: profileSnapshot.exists()
        ? profileSnapshot.data()
        : undefined,
      now: serverTimestamp(),
    }),
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
