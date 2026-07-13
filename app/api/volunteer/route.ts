import { NextRequest, NextResponse } from "next/server";
import { submitVolunteerRequest, getVolunteerRequests, updateVolunteerRequestStatus } from "@/services/chat.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, name, phone, email, service, preferredDate } = body;

    // Validate required fields
    if (!name || !phone || !email || !service) {
      return NextResponse.json(
        { error: "Name, phone, email, and service are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[\d\s\-+()]{10,}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: "Please provide a valid phone number" },
        { status: 400 }
      );
    }

    const requestId = await submitVolunteerRequest({
      sessionId: sessionId || "",
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      service: service.trim(),
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

export async function GET() {
  try {
    const requests = await getVolunteerRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Get volunteer requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch volunteer requests" },
      { status: 500 }
    );
  }
}
