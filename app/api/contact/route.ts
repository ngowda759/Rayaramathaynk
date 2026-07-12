import { NextRequest, NextResponse } from "next/server";

interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body: ContactRequest = await request.json();
    
    // Validation
    if (!body.name || body.name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    
    if (!body.email || body.email.trim() === "") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    
    if (!validateEmail(body.email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    
    if (!body.message || body.message.trim() === "") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    
    // Sanitize inputs
    const sanitizedData = {
      name: body.name.trim().slice(0, 100),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.trim().slice(0, 20) || "",
      message: body.message.trim().slice(0, 2000),
      submittedAt: new Date().toISOString(),
    };
    
    // In production, this would send an email or store in database
    console.log("[Contact API] New contact request:", sanitizedData);
    
    return NextResponse.json({ 
      message: "Thank you for your message. We will get back to you soon.",
      id: `contact_${Date.now()}`
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Error processing contact form:", error);
    return NextResponse.json({ error: "Failed to process contact form" }, { status: 500 });
  }
}
