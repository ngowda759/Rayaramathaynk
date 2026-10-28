import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { getVolunteerRequests, submitVolunteerRequest } from "@/services/chat.server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, name, phone, email, service, preferredDate } = body;

    if (!name || !phone || !email || !service) {
      return NextResponse.json(
        { error: "Name, phone, email, and service are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Please provide a valid email address" }, { status: 400 });
    }

    const phoneRegex = /^[\d\s\-+()]{10,}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json({ error: "Please provide a valid phone number" }, { status: 400 });
    }

    const requestId = await submitVolunteerRequest({
      sessionId: sessionId || "",
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: String(email).trim().toLowerCase(),
      service: String(service).trim(),
      preferredDate: preferredDate?.trim(),
    });

    return NextResponse.json({
      success: true,
      id: requestId,
      message: "Thank you for your interest in volunteering! Our team will contact you soon.",
    });
  } catch (error) {
    console.error("Volunteer request error:", error);
    return NextResponse.json(
      { error: "Failed to submit volunteer request. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // The volunteer request list carries personal contact details, so it is admin-only.
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;
  try {
    const requests = await getVolunteerRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Get volunteer requests error:", error);
    return NextResponse.json({ error: "Failed to fetch volunteer requests" }, { status: 500 });
  }
}
