import { NextRequest, NextResponse } from "next/server";
import { doc, collection, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Search in users collection by email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "User not found. Please ensure the user has logged in at least once." },
        { status: 404 }
      );
    }

    // Get the first matching user
    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;

    // Update the role
    await setDoc(doc(db, "users", userId), {
      role: role,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: `User ${email} has been set as ${role}`,
      userId: userId,
    });
  } catch (error: any) {
    console.error("Error setting user role:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update user role" },
      { status: 500 }
    );
  }
}
