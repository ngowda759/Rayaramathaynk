jest.mock("server-only", () => { return {}; }, { virtual: true });
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { getLatencyMetrics, getIntentDistribution, getUnknownQuestions, recordUnknownQuestion, markUnknownQuestionReviewed } from '../../services/ai-analytics.service';
import { logUnknownQuestion, logLowConfidenceQuestion, logFailedKnowledgeLookup } from '../../lib/ai/unknown-logger';
import { aiSettingsRepository } from '../../lib/ai/ai-settings/repository';
import { Intent } from '../../lib/ai/intent/types';
import { createClient } from '../../lib/supabase/client';
import { createAdminClient } from '../../lib/supabase/admin';

jest.mock('../../lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

jest.mock('../../lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null)
  }),
}));

// Mock NextRequest globally for this test
jest.mock('next/server', () => ({
  NextRequest: class {
    headers: any;
    constructor(url: string, init?: any) {
      this.headers = init?.headers || new Headers();
    }
  }
}));

describe('BOT-004 Behavioral Verification', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
    };
    (createClient as any).mockReturnValue(mockSupabase);
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  describe('Latency Records', () => {
    it('getLatencyMetrics reads from ai_latency_records', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          gte: jest.fn().mockReturnValueOnce({
            lte: jest.fn().mockReturnValueOnce({
              order: jest.fn().mockReturnValueOnce({
                limit: jest.fn().mockReturnValueOnce({
                  data: [{ id: '1', total_latency: 100, timestamp: '2023-01-15T00:00:00.000Z' }],
                  error: null
                })
              })
            })
          })
        })
      });
      await getLatencyMetrics({ startDate: '2023-01-01', endDate: '2023-01-31' });
      expect(mockSupabase.from).toHaveBeenCalledWith('ai_latency_records');
    });
  });

  describe('Intent Distribution', () => {
    it('getIntentDistribution reads from ai_intent_distribution', async () => {
       mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          gte: jest.fn().mockReturnValueOnce({
            lte: jest.fn().mockReturnValueOnce({
              order: jest.fn().mockReturnValueOnce({
                limit: jest.fn().mockReturnValueOnce({
                  data: [{ id: '1', intent: 'FAQ', timestamp: '2023-01-15T00:00:00.000Z' }],
                  error: null
                })
              })
            })
          })
        })
      });
      await getIntentDistribution({ startDate: '2023-01-01', endDate: '2023-01-31' });
      expect(mockSupabase.from).toHaveBeenCalledWith('ai_intent_distribution');
    });
  });

  describe('Unknown Questions Logger (unknown_questions)', () => {
    it('logUnknownQuestion writes to unknown_questions', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'test-id' }, error: null });
      await logUnknownQuestion('test question', 'session-123', Intent.UNKNOWN, 0, 'en');
      expect(mockSupabase.from).toHaveBeenCalledWith('unknown_questions');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            question: 'test question',
            detected_intent: Intent.UNKNOWN,
            status: 'pending'
          })
        ])
      );
    });

    it('logLowConfidenceQuestion uses unknown_questions logger below threshold', async () => {
       mockSupabase.single.mockResolvedValueOnce({ data: { id: 'test-id' }, error: null });
       await logLowConfidenceQuestion('test question', 'session-123', Intent.FAQ, 20, 'knowledge_base' as any, 'en');
       expect(mockSupabase.from).toHaveBeenCalledWith('unknown_questions');
    });

    it('logLowConfidenceQuestion does not log above threshold', async () => {
       await logLowConfidenceQuestion('test question', 'session-123', Intent.FAQ, 80, 'knowledge_base' as any, 'en');
       expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('logFailedKnowledgeLookup logs to unknown_questions', async () => {
       mockSupabase.single.mockResolvedValueOnce({ data: { id: 'test-id' }, error: null });
       await logFailedKnowledgeLookup('test question', 'session-123', 'en');
       expect(mockSupabase.from).toHaveBeenCalledWith('unknown_questions');
    });
  });

  describe('AI Settings Repository Unknown Questions', () => {
     it('logUnknownQuestion writes to unknown_questions', async () => {
         mockSupabase.insert.mockResolvedValueOnce({ error: null });
         await aiSettingsRepository.logUnknownQuestion('test question', 'unknown', 0, 'en', 'session-123');
         expect(mockSupabase.from).toHaveBeenCalledWith('unknown_questions');
     });

     it('checkAndIncrementUnknownQuestion reads unknown_questions', async () => {
         mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
         await aiSettingsRepository.checkAndIncrementUnknownQuestion('test question');
         expect(mockSupabase.from).toHaveBeenCalledWith('unknown_questions');
     });

     it('getUnknownQuestions reads unknown_questions', async () => {
         mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnValueOnce({
                order: jest.fn().mockResolvedValueOnce({ data: [], error: null })
            })
         });
         await aiSettingsRepository.getUnknownQuestions();
         expect(mockSupabase.from).toHaveBeenCalledWith('unknown_questions');
     });
  });
});

describe('Settings Server Actions Authorization', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalEnv) process.env.NODE_ENV = originalEnv as any;
  });

  it('prevents unauthorized access in production', async () => {
     process.env.NODE_ENV = 'production';
     const { createSettingsAction } = await import('../../app/actions/settings');

     await expect(createSettingsAction({ templeName: 'test', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' }))
       .rejects.toThrow('Unauthorized');
  });

  it('allows authorized access in test/dev', async () => {
     process.env.NODE_ENV = 'test';
     const mockSupabase = createAdminClient() as any;
     mockSupabase.single.mockResolvedValueOnce({ data: { id: 'settings-123' }, error: null });

     const { createSettingsAction } = await import('../../app/actions/settings');
     const result = await createSettingsAction({ templeName: 'test', contactEmail: '', contactPhone: '', address: '', footerText: '', welcomeMessage: '' });
     expect(result).toBe('settings-123');
  });
});
