import { NextRequest, NextResponse } from "next/server";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  // Check if Firebase is configured
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { error: "Firebase is not configured. Please set up Firebase environment variables." },
      { status: 503 }
    );
  }

  if (!auth || !db) {
    return NextResponse.json(
      { error: "Firebase services not initialized" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });

    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name: name,
      email: email,
      phone: "",
      role: "super_admin",
      templeId: "main",
      profileImage: "",
      isApproved: true,
      isActive: true,
      emailVerified: false,
      lastLogin: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await signOut(auth);

    return NextResponse.json({
      success: true,
      message: "Super Admin created: administrator@rayaramathaynk.com",
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create admin" },
      { status: 500 }
    );
  }
}
