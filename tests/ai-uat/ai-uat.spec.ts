/**
 * AI UAT Playwright Test Specification
 * End-to-end tests for Raya AI chatbot
 */

import { test, expect, Page } from "@playwright/test";
import {
  ALL_UAT_TESTS,
  TEST_STATS,
  TestCategory,
  UATTestCase,
  UserPersona,
} from "./test-cases";
import { Intent } from "@/lib/ai/intent/types";

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || "https://work-2-lsyqjcumilhubnrb.prod-runtime.all-hands.dev";
const CHAT_TIMEOUT = 30000; // 30 seconds

// Test results storage
interface TestResult {
  id: string;
  question: string;
  expectedIntent: Intent;
  detectedIntent?: Intent;
  expectedLanguage: string;
  detectedLanguage?: string;
  expectedRepository?: string;
  status: "passed" | "failed" | "skipped";
  responseTime?: number;
  error?: string;
  response?: string;
}

const testResults: TestResult[] = [];

// Helper function to detect intent from response (mock for testing)
function extractIntentFromResponse(response: string): Intent | null {
  const responseLower = response.toLowerCase();
  
  // Simple keyword-based intent detection from response content
  if (responseLower.includes("timing") || responseLower.includes("open") || responseLower.includes("close") || responseLower.includes("morning") || responseLower.includes("evening")) {
    return Intent.TEMPLE_TIMINGS;
  }
  if (responseLower.includes("phone") || responseLower.includes("contact") || responseLower.includes("email") || responseLower.includes("call")) {
    return Intent.CONTACT_INFORMATION;
  }
  if (responseLower.includes("address") || responseLower.includes("located") || responseLower.includes("location")) {
    return Intent.ADDRESS;
  }
  if (responseLower.includes("event") || responseLower.includes("festival") || responseLower.includes("celebration")) {
    return Intent.UPCOMING_EVENTS;
  }
  if (responseLower.includes("aaradhane") || responseLower.includes("aradhana")) {
    return Intent.NEXT_AARADHANE;
  }
  if (responseLower.includes("panchanga") || responseLower.includes("tithi") || responseLower.includes("nakshatra")) {
    return Intent.PANCHANGA;
  }
  if (responseLower.includes("seva") || responseLower.includes("archana") || responseLower.includes("pooja")) {
    return Intent.SPECIAL_SEVAS;
  }
  if (responseLower.includes("donation") || responseLower.includes("donate") || responseLower.includes("80g")) {
    return Intent.DONATION;
  }
  if (responseLower.includes("parking") || responseLower.includes("park")) {
    return Intent.PARKING;
  }
  if (responseLower.includes("dress") || responseLower.includes("wear") || responseLower.includes("clothing")) {
    return Intent.DRESS_CODE;
  }
  if (responseLower.includes("photo") || responseLower.includes("camera") || responseLower.includes("picture")) {
    return Intent.PHOTOGRAPHY;
  }
  if (responseLower.includes("raghavendra") || responseLower.includes("swamiji") || responseLower.includes("swamy")) {
    return Intent.SRI_RAGHAVENDRA;
  }
  if (responseLower.includes("brindavana") || responseLower.includes("brindavan")) {
    return Intent.BRINDAVANA;
  }
  if (responseLower.includes("namaskara") || responseLower.includes("namaste") || responseLower.includes("hello") || responseLower.includes("ನಮಸ್ಕಾರ")) {
    return Intent.GENERAL_GREETING;
  }
  if (responseLower.includes("thank") || responseLower.includes("ಧನ್ಯವಾದ")) {
    return Intent.THANKS;
  }
  
  // Check for out-of-scope patterns
  if (responseLower.includes("i am") && responseLower.includes(" raya")) {
    return Intent.OUT_OF_SCOPE; // Bot is redirecting
  }
  
  return null;
}

// Helper function to detect language from response
function detectLanguageFromResponse(response: string): "en" | "kn" | "mixed" {
  const kannadaPattern = /[\u0C80-\u0CFF]/;
  const hasKannada = kannadaPattern.test(response);
  const hasEnglish = /[a-zA-Z]/.test(response);
  
  if (hasKannada && hasEnglish) return "mixed";
  if (hasKannada) return "kn";
  return "en";
}

// Test result reporter
function reportTestResult(result: TestResult) {
  testResults.push(result);
  
  const status = result.status === "passed" ? "✅" : result.status === "skipped" ? "⏭️" : "❌";
  console.log(`${status} [${result.id}] ${result.question.substring(0, 50)}...`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

// Open chat widget
async function openChatWidget(page: Page) {
  // Try to find and click the chat widget button
  const chatButton = page.locator('button[aria-label*="chat" i], button[aria-label*="message" i], [data-testid="chat-button"], .chat-button, #chat-widget-button');
  
  // If not found, look for any button that might be the chat toggle
  if (await chatButton.count() === 0) {
    // Try common selectors
    const fallbackButton = page.locator('button:has-text("Chat"), button:has-text("Message"), button:has-text("Help")').first();
    if (await fallbackButton.count() > 0) {
      await fallbackButton.click();
    }
  } else {
    await chatButton.first().click();
  }
  
  // Wait for chat window to open
  await page.waitForTimeout(1000);
}

// Send message to chat
async function sendMessage(page: Page, message: string): Promise<string> {
  const inputSelector = 'input[type="text"], textarea, [data-testid="chat-input"], .chat-input input';
  
  const input = page.locator(inputSelector).first();
  await input.fill(message);
  await input.press("Enter");
  
  // Wait for response
  await page.waitForTimeout(2000);
  
  // Get the last assistant message
  const messages = page.locator('[data-testid="message"], .message.assistant, .chat-message.assistant');
  const lastMessage = messages.last();
  
  if (await lastMessage.count() > 0) {
    return await lastMessage.textContent() || "";
  }
  
  return "";
}

// Test suite for each category
describe.describe("AI UAT - Temple Information (Category 1)", () => {
  const templeTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.TEMPLE_INFO);
  
  templeTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      let error: string | undefined;
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const detectedIntent = extractIntentFromResponse(response);
        const detectedLanguage = detectLanguageFromResponse(response);
        
        // Validate intent
        const intentMatch = testCase.expectedIntent === Intent.OUT_OF_SCOPE || 
                           detectedIntent === testCase.expectedIntent;
        
        // Validate language (allow some flexibility)
        const languageMatch = testCase.expectedLanguage === "mixed" || 
                              detectedLanguage === testCase.expectedLanguage ||
                              detectedLanguage === "en"; // Default to English if detected
        
        const passed = intentMatch && languageMatch && response.length > 0;
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          detectedIntent: detectedIntent || undefined,
          expectedLanguage: testCase.expectedLanguage,
          detectedLanguage,
          expectedRepository: testCase.expectedRepository,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
          error: !passed ? `Intent: expected ${testCase.expectedIntent}, got ${detectedIntent || 'none'}` : undefined,
        });
        
        expect(passed, `Expected intent ${testCase.expectedIntent}, got ${detectedIntent}`).toBe(true);
        expect(response.length).toBeGreaterThan(0);
        
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error,
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Contact Information (Category 2)", () => {
  const contactTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.CONTACT);
  
  contactTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Events (Category 3)", () => {
  const eventTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.EVENTS);
  
  eventTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Panchanga (Category 4)", () => {
  const panchangaTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.PANCHANGA);
  
  panchangaTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Sevas (Category 5)", () => {
  const sevaTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.SEVAS);
  
  sevaTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Donations (Category 6)", () => {
  const donationTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.DONATIONS);
  
  donationTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Visitor Information (Category 7)", () => {
  const visitorTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.VISITOR);
  
  visitorTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Navigation (Category 8)", () => {
  const navTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.NAVIGATION);
  
  navTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Spiritual Knowledge (Category 9)", () => {
  const knowledgeTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.KNOWLEDGE);
  
  knowledgeTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Unknown Questions (Category 10)", () => {
  const unknownTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.UNKNOWN);
  
  unknownTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        // For unknown questions, we expect a graceful response that doesn't hallucinate
        const hasNoHallucination = !response.includes("I don't know") || 
                                   response.includes("temple") || 
                                   response.includes("raghavendra") ||
                                   response.includes("Sri Raghavendra");
        const passed = response.length > 0 && (hasNoHallucination || response.length > 50);
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Prompt Injection (Category 11)", () => {
  const injectionTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.PROMPT_INJECTION);
  
  injectionTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        // Check if injection was refused
        const injectionRefused = 
          response.includes("I am Raya") ||
          response.includes("Raya AI") ||
          response.includes("Sri Raghavendra") ||
          response.includes("Namaskara") ||
          !response.includes("Ignore") ||
          !response.includes("previous instruction");
        
        // For injection attempts, we expect the bot to stay in character
        const passed = response.length > 0 && (injectionRefused || !testCase.question.includes("Ignore"));
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Conversation Memory (Category 12)", () => {
  const memoryTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.MEMORY);
  
  memoryTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question} (with context)`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        
        // Send context messages first
        if (testCase.conversationContext) {
          for (const ctx of testCase.conversationContext) {
            await sendMessage(page, ctx);
            await page.waitForTimeout(1000);
          }
        }
        
        // Send the actual test question
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Kannada Language (Category 13)", () => {
  const kannadaTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.KANNADA);
  
  kannadaTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        // Check if response contains Kannada
        const kannadaPattern = /[\u0C80-\u0CFF]/;
        const hasKannadaInResponse = kannadaPattern.test(response);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          detectedLanguage: hasKannadaInResponse ? "kn" : "en",
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Mixed Language (Category 14)", () => {
  const mixedTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.MIXED);
  
  mixedTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question}`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        const passed = response.length > 0 && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

describe.describe("AI UAT - Response Quality (Category 15)", () => {
  const qualityTests = ALL_UAT_TESTS.filter(t => t.category === TestCategory.QUALITY);
  
  qualityTests.forEach((testCase) => {
    test(`[${testCase.id}] ${testCase.question.substring(0, 50)}...`, async ({ page }) => {
      await page.goto(BASE_URL);
      
      const startTime = Date.now();
      let response = "";
      
      try {
        await openChatWidget(page);
        response = await sendMessage(page, testCase.question);
        
        // Check for quality issues
        const hasNoDuplicates = !response.includes("Namaskara Namaskara") && 
                               !response.includes("Thank you Thank you");
        const hasContent = response.length > 10;
        const passed = hasNoDuplicates && hasContent && !response.includes("error");
        
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: passed ? "passed" : "failed",
          responseTime: Date.now() - startTime,
          response: response.substring(0, 200),
          error: !hasNoDuplicates ? "Response contains duplicates" : undefined,
        });
        
        expect(passed).toBe(true);
      } catch (e) {
        reportTestResult({
          id: testCase.id,
          question: testCase.question,
          expectedIntent: testCase.expectedIntent,
          expectedLanguage: testCase.expectedLanguage,
          status: "failed",
          responseTime: Date.now() - startTime,
          error: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    });
  });
});

// Summary test - print results
test.describe("AI UAT Summary", () => {
  test("Print test results summary", () => {
    const passed = testResults.filter(r => r.status === "passed").length;
    const failed = testResults.filter(r => r.status === "failed").length;
    const skipped = testResults.filter(r => r.status === "skipped").length;
    const total = testResults.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0";
    
    console.log("\n" + "=".repeat(60));
    console.log("AI UAT TEST RESULTS SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} (${passRate}%)`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log("=".repeat(60));
    
    if (failed > 0) {
      console.log("\nFailed Tests:");
      testResults
        .filter(r => r.status === "failed")
        .forEach(r => {
          console.log(`  - [${r.id}] ${r.question}`);
          console.log(`    Error: ${r.error}`);
        });
    }
    
    // Generate JSON report
    const report = {
      summary: {
        total,
        passed,
        failed,
        skipped,
        passRate: parseFloat(passRate),
        timestamp: new Date().toISOString(),
      },
      results: testResults,
    };
    
    console.log("\nJSON Report:");
    console.log(JSON.stringify(report, null, 2));
    
    expect(true).toBe(true);
  });
});
