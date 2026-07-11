import { NextRequest, NextResponse } from "next/server";
import { doc, collection, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { rateLimit, getClientIP, createRateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const clientIP = getClientIP(request);
  const rateLimitResult = rateLimit(`set-role:${clientIP}`, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  });

  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult);
  }

  // Check if Firebase is configured
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { error: "Firebase is not configured. Please set up Firebase environment variables." },
      { status: 503 }
    );
  }

  if (!db) {
    return NextResponse.json(
      { error: "Firebase services not initialized" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["devotee", "volunteer", "admin", "billing", "super_admin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be one of: " + validRoles.join(", ") },
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
