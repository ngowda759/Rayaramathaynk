import { AIProvider, AIMessage } from "@/types/ai";

interface ProviderConfig {
  name: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

// List of known placeholder/invalid API key patterns
const PLACEHOLDER_KEY_PATTERNS = [
  "your-",
  "your_api_key",
  "your_openai",
  "sk-",
  "placeholder",
  "dummy",
  "test",
  "fake",
  "invalid",
  "undefined",
  "null",
  "example",
  "sample",
];

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  const lowerKey = key.toLowerCase();
  return PLACEHOLDER_KEY_PATTERNS.some(pattern => lowerKey.includes(pattern));
}

function getProviderConfig(): ProviderConfig {
  const provider = process.env.AI_PROVIDER || "openai";
  
  switch (provider) {
    case "openai":
      return {
        name: "OpenAI",
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        baseUrl: "https://api.openai.com/v1",
      };
    case "openrouter":
      return {
        name: "OpenRouter",
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        baseUrl: "https://openrouter.ai/api/v1",
      };
    case "gemini":
      return {
        name: "Gemini",
        apiKey: process.env.GOOGLE_GENERATIVE_API_KEY,
        model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      };
    case "claude":
      return {
        name: "Claude",
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.CLAUDE_MODEL || "claude-3-haiku-20240307",
        baseUrl: "https://api.anthropic.com/v1",
      };
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

function formatMessagesForProvider(messages: AIMessage[], provider: string): unknown[] {
  if (provider === "claude") {
    return messages.map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : msg.role,
      content: msg.content,
    }));
  }
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

async function generateOpenAIResponse(
  messages: AIMessage[],
  systemPrompt: string,
  config: ProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(`${config.name} API key is not configured`);
  }
  const formattedMessages = formatMessagesForProvider(messages, "openai");
  const allMessages = [
    { role: "system", content: systemPrompt },
    ...formattedMessages,
  ];
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `${config.name} API error: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }
  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

async function* generateOpenAIStreamResponse(
  messages: AIMessage[],
  systemPrompt: string,
  config: ProviderConfig
): AsyncGenerator<string> {
  if (!config.apiKey) {
    throw new Error(`${config.name} API key is not configured`);
  }
  const formattedMessages = formatMessagesForProvider(messages, "openai");
  const allMessages = [
    { role: "system", content: systemPrompt },
    ...formattedMessages,
  ];
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `${config.name} API error: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;
      const data = trimmedLine.slice(5);
      try {
        const json = JSON.parse(data);
        if (json.error) continue;
        const content = json.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }
}

async function generateClaudeResponse(
  messages: AIMessage[],
  systemPrompt: string,
  config: ProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(`${config.name} API key is not configured`);
  }
  const formattedMessages = formatMessagesForProvider(messages, "claude");
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt,
      messages: formattedMessages,
      max_tokens: 2000,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `${config.name} API error: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }
  const data = await response.json();
  return data.content[0]?.text || "";
}

async function generateGeminiResponse(
  messages: AIMessage[],
  systemPrompt: string,
  config: ProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(`${config.name} API key is not configured`);
  }
  const contents = messages.slice(-10).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
  const response = await fetch(
    `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    }
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `${config.name} API error: ${response.status} - ${errorData.error?.message || response.statusText}`
    );
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export class AIChatProvider implements AIProvider {
  name: string;
  private config: ProviderConfig;

  constructor() {
    this.config = getProviderConfig();
    this.name = this.config.name;
  }

  async generateResponse(messages: AIMessage[], systemPrompt: string): Promise<string> {
    const startTime = Date.now();
    try {
      let response: string;
      switch (this.config.name) {
        case "OpenAI":
        case "OpenRouter":
          response = await generateOpenAIResponse(messages, systemPrompt, this.config);
          break;
        case "Claude":
          response = await generateClaudeResponse(messages, systemPrompt, this.config);
          break;
        case "Gemini":
          response = await generateGeminiResponse(messages, systemPrompt, this.config);
          break;
        default:
          throw new Error(`Unsupported provider: ${this.config.name}`);
      }
      const latency = Date.now() - startTime;
      console.log(`[AI] ${this.config.name} response generated in ${latency}ms`);
      return response;
    } catch (error) {
      console.error("[AI] Error generating response:", error);
      throw error;
    }
  }

  async *generateStreamResponse(
    messages: AIMessage[],
    systemPrompt: string
  ): AsyncGenerator<string> {
    if (this.config.name !== "OpenAI" && this.config.name !== "OpenRouter") {
      const response = await this.generateResponse(messages, systemPrompt);
      yield response;
      return;
    }
    try {
      for await (const chunk of generateOpenAIStreamResponse(
        messages,
        systemPrompt,
        this.config
      )) {
        yield chunk;
      }
    } catch (error) {
      console.error("[AI] Error in streaming response:", error);
      throw error;
    }
  }

  isConfigured(): boolean {
    // Check if API key exists AND is not a placeholder
    return !!this.config.apiKey && !isPlaceholderKey(this.config.apiKey);
  }

  getProviderName(): string {
    return this.config.name;
  }

  getModelName(): string {
    return this.config.model || "unknown";
  }
}

let providerInstance: AIChatProvider | null = null;

export function getAIProvider(): AIChatProvider {
  if (!providerInstance) {
    providerInstance = new AIChatProvider();
  }
  return providerInstance;
}
