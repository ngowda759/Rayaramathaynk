import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/settings";
import { generateFirebaseResponse, getTempleInfo } from "@/lib/ai/firebaseChat";
import { AIMessage, ChatRequest, ChatResponse } from "@/types/ai";

// Import hybrid response generator
import {
  generateResponse,
  detectIntent,
  logLowConfidenceQuestion,
  Intent,
} from "@/lib/ai";

// Import conversation session service
import {
  generateSessionId,
  getSession,
  createSession,
  updateSession,
  getSessionContext,
  clearSession,
} from "@/services/conversation.service";

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

// Feature flag for hybrid mode
const USE_HYBRID_MODE = process.env.AI_HYBRID_MODE !== "false"; // Default to hybrid mode

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

    // Determine response language from message
    const responseLanguage = detectedLanguage || 
      (lastUserMessage.content.includes("ಕನ್ನಡ") || /[\u0C80-\u0CFF]/.test(lastUserMessage.content) ? "kn" : "en");

    let responseMessage: AIMessage | undefined;
    let responseSource: "hybrid" | "ai" | "firebase" = "hybrid";
    let lastResult: { intent?: string; confidence?: number; source?: string } | undefined;
    let resolvedSessionId = sessionId || "";

    // Try hybrid mode first (uses structured retrieval)
    if (USE_HYBRID_MODE) {
      console.log(`[Chat API] [${requestId}] Using HYBRID mode (structured retrieval + LLM fallback)`);

      try {
        // Handle session context
        let effectiveSessionId = resolvedSessionId;
        let resolvedLanguage = responseLanguage;
        
        if (effectiveSessionId) {
          // Get existing session context
          const { session, isFollowUp, enrichedMessage } = await getSessionContext(effectiveSessionId);
          
          if (session) {
            // Use session's preferred language if available
            if (session.preferredLanguage && !detectedLanguage) {
              resolvedLanguage = session.preferredLanguage;
            }
            
            // Log follow-up detection
            if (isFollowUp) {
              console.log(`[Chat API] [${requestId}] Follow-up detected, enriching context`);
            }
          }
        } else {
          // Create new session
          effectiveSessionId = generateSessionId();
        }

        // Generate response with session ID for analytics
        const result = await generateResponse(lastUserMessage.content, effectiveSessionId);
        
        console.log(`[Chat API] [${requestId}] Hybrid response generated:`, {
          intent: result.intent,
          confidence: result.confidence,
          source: result.source,
          usesLLM: result.usesLLM,
        });

        responseMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.content,
          timestamp: Date.now(),
          detectedLanguage: result.language,
        };

        // Store result for debug info
        lastResult = result;

        // Update session with new message
        await updateSession(
          effectiveSessionId,
          lastUserMessage.content,
          result.content,
          result.intent,
          result.language
        );

        // Log low confidence responses for review
        if (result.confidence < 50) {
          await logLowConfidenceQuestion(
            lastUserMessage.content,
            effectiveSessionId,
            result.intent,
            result.confidence,
            result.source,
            result.language
          );
        }

        responseSource = "hybrid";
      } catch (hybridError) {
        logError("Hybrid generation", hybridError, { requestId });
        console.log(`[Chat API] [${requestId}] Hybrid failed, falling back to AI provider`);
        
        // Fall through to AI provider or Firebase
        responseSource = "ai";
      }
    }

    // If hybrid didn't work or is disabled, try AI provider
    if (responseSource !== "hybrid") {
      // HYBRID MODE SAFETY: If structured retrieval fails, return a safe error message
      // Do NOT fall back to LLM-only mode as it may hallucinate temple facts
      
      console.log(`[Chat API] [${requestId}] WARNING: Hybrid mode failed. Returning safe error response.`);
      console.log(`[Chat API] [${requestId}] The LLM fallback is disabled to prevent hallucinated temple facts.`);
      
      // Return a safe, structured error response
      responseMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "🙏 Namaskara! I apologize, but I'm experiencing technical difficulties at the moment.\n\nFor temple information, please:\n• Visit our website\n• Contact the temple office directly\n• Check the official announcements\n\n🙏 Sri Guru Raghavendraya Namaha.",
        timestamp: Date.now(),
      };
      responseSource = "hybrid"; // Mark as hybrid to indicate this is our safe response
      
      /*
      // OLD FALLBACK CODE - DISABLED FOR SAFETY
      // Keeping commented for reference during transition period
      
      const provider = getAIProvider();

      if (provider.isConfigured()) {
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
          // AI call failed, log and return safe error
          logError("AI provider call", aiError, { requestId, provider: provider.getProviderName() });
          
          responseMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "🙏 I apologize for the inconvenience. Please try again or contact the temple office directly.",
            timestamp: Date.now(),
          };
        }
      } else {
        // AI not configured
        responseMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "🙏 AI service is not configured. Please contact the temple office for assistance.",
          timestamp: Date.now(),
        };
      }
      */
    }

    const totalLatency = Date.now() - startTime;
    console.log(`[Chat API] [${requestId}] Total request time: ${totalLatency}ms (source: ${responseSource})`);

    // Include enhanced debug metadata if requested via query param
    const url = new URL(request.url || 'http://localhost');
    const isDebug = url.searchParams.get('debug') === 'true';
    
    const response: ChatResponse = {
      message: responseMessage!,
      sessionId: resolvedSessionId || crypto.randomUUID(),
      ...(isDebug && {
        _debug: {
          // Response metadata
          responseSource,
          intent: lastResult?.intent,
          confidence: lastResult?.confidence,
          detectionSource: lastResult?.source,
          // Timing breakdown
          latency: {
            total: totalLatency,
            repository: lastResult?.source === 'repository' ? totalLatency : undefined,
            knowledge: lastResult?.source === 'knowledge_base' ? totalLatency : undefined,
            llm: lastResult?.source === 'llm' ? totalLatency : undefined,
          },
          // Source attribution
          sources: {
            primary: responseSource,
            repository: responseSource === 'hybrid' || responseSource === 'repository' ? 'settings' : undefined,
          }
        }
      })
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
    hybridMode: USE_HYBRID_MODE,
    timestamp: Date.now(),
  });
}
