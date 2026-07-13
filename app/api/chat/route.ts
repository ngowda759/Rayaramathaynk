import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { generateFirebaseResponse, getTempleInfo } from "@/lib/ai/firebaseChat";
import { AIMessage, ChatRequest, ChatResponse } from "@/types/ai";

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || 
               request.headers.get("x-real-ip") || 
               "unknown";

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    // Parse request body
    const body: ChatRequest = await request.json();
    const { messages, sessionId, userId } = body;

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages are required and must be a non-empty array" },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "No user message found" },
        { status: 400 }
      );
    }

    // Try AI provider first, fallback to Firebase
    const provider = getAIProvider();
    let responseMessage: AIMessage;

    if (provider.isConfigured()) {
      // Use AI provider
      console.log(`[Chat API] Using AI provider: ${provider.getProviderName()}`);

      const aiMessages: AIMessage[] = messages.map((msg) => ({
        id: msg.id || crypto.randomUUID(),
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
      }));

      const responseContent = await provider.generateResponse(aiMessages, SYSTEM_PROMPT);
      const latency = Date.now() - startTime;

      responseMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseContent,
        timestamp: Date.now(),
        model: provider.getModelName(),
        latency,
      };
    } else {
      // Use Firebase-based response
      console.log("[Chat API] AI not configured, using Firebase fallback");
      
      // Get temple info from Firebase
      const templeInfo = await getTempleInfo();
      
      // Generate response using Firebase data
      responseMessage = await generateFirebaseResponse(
        lastUserMessage.content,
        templeInfo
      );
    }

    const response: ChatResponse = {
      message: responseMessage,
      sessionId: sessionId || crypto.randomUUID(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Chat API] Error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "AI service configuration error. Please contact the administrator." },
          { status: 500 }
        );
      }
      if (error.message.includes("rate") || error.message.includes("429")) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment and try again." },
          { status: 429 }
        );
      }
      if (error.message.includes("timeout")) {
        return NextResponse.json(
          { error: "Request timed out. Please try again." },
          { status: 504 }
        );
      }
    }

    return NextResponse.json(
      { error: "An error occurred while generating the response. Please try again." },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  const provider = getAIProvider();
  
  return NextResponse.json({
    status: "ok",
    provider: provider.getProviderName(),
    configured: provider.isConfigured(),
    timestamp: Date.now(),
  });
}
