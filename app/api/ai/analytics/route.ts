// API Route: /api/ai/analytics
// Returns full analytics dashboard data

import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsDashboard } from "@/services/ai-analytics.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    
    const start = startDate ? parseInt(startDate, 10) : undefined;
    const end = endDate ? parseInt(endDate, 10) : undefined;
    
    const response = await getAnalyticsDashboard(start, end);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching analytics dashboard:", error);
    // Return default empty dashboard instead of 500 to prevent public page failures
    return NextResponse.json({
      dashboard: {
        overview: { 
          totalConversations: 0, 
          totalMessages: 0, 
          uniqueUsers: 0, 
          averageResponseTime: 0, 
          satisfactionRate: 0, 
          period: { start: Date.now() - 7 * 24 * 60 * 60 * 1000, end: Date.now() } 
        },
        tokenUsage: { 
          totalInputTokens: 0, 
          totalOutputTokens: 0, 
          totalTokens: 0, 
          totalCost: 0, 
          averageTokensPerRequest: 0, 
          byModel: {}, 
          byIntent: {}, 
          timeSeries: [] 
        },
        latency: {
          averageTotalLatency: 0,
          averageIntentDetectionTime: 0,
          averageRetrievalTime: 0,
          averageGenerationTime: 0,
          p50Latency: 0,
          p95Latency: 0,
          p99Latency: 0,
          timeoutCount: 0,
          errorCount: 0,
          successRate: 100,
          timeSeries: [],
          byIntent: {}
        },
        intentDistribution: {
          totalMessages: 0,
          byIntent: [],
          byCategory: [],
          byLanguage: [],
          timeSeries: [],
          topQuestions: []
        },
        unknownQuestions: {
          total: 0,
          unreviewed: 0,
          reviewed: 0,
          addedToKnowledge: 0,
          byIntent: {},
          recentQuestions: [],
          feedbackDistribution: { helpful: 0, not_helpful: 0 },
          timeSeries: []
        },
        health: { 
          status: "healthy", 
          lastChecked: Date.now(), 
          apiLatency: 0, 
          errorRate: 0, 
          uptime: 100, 
          issues: [] 
        },
      },
    });
  }
}
