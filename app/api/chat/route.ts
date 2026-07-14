import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/settings";
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

// Enhanced error logging helper
function logError(context: string, error: unknown, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const errorInfo: Record<string, unknown> = {
    timestamp,
    context,
    errorType: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...details,
  };
  console.error(`[Chat API] Error in ${context}:`, JSON.stringify(errorInfo, null, 2));
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || 
               request.headers.get("x-real-ip") || 
               "unknown";

    console.log(`[Chat API] [${requestId}] Received request from IP: ${ip}`);

    // Check rate limit
    if (!checkRateLimit(ip)) {
      console.log(`[Chat API] [${requestId}] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    // Parse request body
    let body: ChatRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      logError("JSON parsing", parseError, { requestId });
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { messages, sessionId, userId, detectedLanguage } = body;

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log(`[Chat API] [${requestId}] Invalid messages:`, { hasMessages: !!messages, isArray: Array.isArray(messages), length: messages?.length });
      return NextResponse.json(
        { error: "Messages are required and must be a non-empty array" },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      console.log(`[Chat API] [${requestId}] No user message found in messages`);
      return NextResponse.json(
        { error: "No user message found" },
        { status: 400 }
      );
    }

    console.log(`[Chat API] [${requestId}] Processing message: "${lastUserMessage.content.substring(0, 50)}..."`);

    // Try AI provider first, fallback to Firebase
    const provider = getAIProvider();
    let responseMessage: AIMessage;
    let responseSource: "ai" | "firebase" = "ai";

    if (provider.isConfigured()) {
      // Use AI provider with configurable system prompt
      console.log(`[Chat API] [${requestId}] Using AI provider: ${provider.getProviderName()} (model: ${provider.getModelName()})`);

      try {
        const aiMessages: AIMessage[] = messages.map((msg) => ({
          id: msg.id || crypto.randomUUID(),
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: msg.timestamp || Date.now(),
        }));

        // Get system prompt from Firebase (or defaults)
        const systemPrompt = await getSystemPrompt();
        console.log(`[Chat API] [${requestId}] System prompt length: ${systemPrompt.length} chars`);

        const responseContent = await provider.generateResponse(aiMessages, systemPrompt);
        const latency = Date.now() - startTime;

        console.log(`[Chat API] [${requestId}] AI response generated in ${latency}ms (${responseContent.length} chars)`);

        responseMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: responseContent,
          timestamp: Date.now(),
          model: provider.getModelName(),
          latency,
        };
      } catch (aiError) {
        // AI call failed, log and fallback to Firebase
        logError("AI provider call", aiError, { requestId, provider: provider.getProviderName() });
        console.log(`[Chat API] [${requestId}] Falling back to Firebase due to AI error`);
        
        // Get temple info from Firebase
        const templeInfo = await getTempleInfo();
        
        // Generate response using Firebase data
        responseMessage = await generateFirebaseResponse(
          lastUserMessage.content,
          templeInfo,
          detectedLanguage || "en"
        );
        responseSource = "firebase";
      }
    } else {
      // AI not configured, use Firebase-based response
      console.log(`[Chat API] [${requestId}] AI not configured (placeholder key or missing config), using Firebase fallback`);
      
      // Get temple info from Firebase
      const templeInfo = await getTempleInfo();
      
      // Generate response using Firebase data
      responseMessage = await generateFirebaseResponse(
        lastUserMessage.content,
        templeInfo,
        detectedLanguage || "en"
      );
      responseSource = "firebase";
    }

    const totalLatency = Date.now() - startTime;
    console.log(`[Chat API] [${requestId}] Total request time: ${totalLatency}ms (source: ${responseSource})`);

    const response: ChatResponse = {
      message: responseMessage,
      sessionId: sessionId || crypto.randomUUID(),
    };

    return NextResponse.json(response);
  } catch (error) {
    logError("Request processing", error, { requestId, startTime });

    // Handle specific error types with specific messages
    if (error instanceof Error) {
      if (error.message.includes("API key") || error.message.includes("401") || error.message.includes("403")) {
        console.error(`[Chat API] [${requestId}] Authentication error - check API key configuration`);
        return NextResponse.json(
          { error: "AI service authentication failed. Please contact the administrator." },
          { status: 500 }
        );
      }
      if (error.message.includes("rate") || error.message.includes("429")) {
        console.error(`[Chat API] [${requestId}] Rate limit error`);
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment and try again." },
          { status: 429 }
        );
      }
      if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
        console.error(`[Chat API] [${requestId}] Timeout error`);
        return NextResponse.json(
          { error: "Request timed out. Please try again." },
          { status: 504 }
        );
      }
      if (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("ENOTFOUND")) {
        console.error(`[Chat API] [${requestId}] Network error`);
        return NextResponse.json(
          { error: "Network error. Please check your connection and try again." },
          { status: 503 }
        );
      }
    }

    // Generic error
    console.error(`[Chat API] [${requestId}] Unhandled error, returning generic response`);
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
    model: provider.getModelName(),
    timestamp: Date.now(),
  });
}
