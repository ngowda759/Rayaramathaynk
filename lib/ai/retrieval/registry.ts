import { Intent, RetrievalType } from "@/lib/ai/intent/types";
import { getContextForIntent } from "./index";
import { searchArticles } from "@/lib/ai/knowledge/repository";
import { aiSettingsService } from "@/lib/ai/ai-settings";

import { RetrievalAuthority } from "./types";

export interface RetrievalResult {
  authority: RetrievalAuthority;
  source: RetrievalType;
  data: any;
  knowledgeArticles?: any[];
  sources: RetrievalType[];
}

/**
 * Standard retrieval abstraction
 * Routes to the appropriate data source based on intent
 */
export async function retrieve(
  intent: Intent,
  query: string,
  context?: any
): Promise<RetrievalResult> {
  const settings = await aiSettingsService.getAISettings();
  const behaviorSettings = settings.extendedBehavior;

  // 1. Try structured repositories first
  const { context: structuredData, sources, authority } = await getContextForIntent(intent);

  let primarySource = sources.length > 0 ? sources[0] : RetrievalType.FALLBACK;
  let knowledgeArticles: any[] = [];

  // 2. Try knowledge base if appropriate
  // We search knowledge base if it's a knowledge intent, OR if structured data is empty
  const isKnowledgeIntent = [
    Intent.TEMPLE_HISTORY,
    Intent.SRI_RAGHAVENDRA,
    Intent.MADHWA_PHILOSOPHY,
    Intent.GURU_PARAMPARA,
    Intent.BRINDAVANA,
    Intent.MANTRALAYA,
    Intent.FAQ,
  ].includes(intent);

  if (isKnowledgeIntent || Object.keys(structuredData).length === 0) {
     const results = await searchArticles(query, behaviorSettings.maxKnowledgeResults);
     knowledgeArticles = results.map(r => r.article);
     if (knowledgeArticles.length > 0) {
       if (primarySource === RetrievalType.FALLBACK) {
         primarySource = RetrievalType.KNOWLEDGE_BASE;
       }
       sources.push(RetrievalType.KNOWLEDGE_BASE);
     }
  }

  return {
    source: primarySource,
    authority,
    data: structuredData,
    knowledgeArticles,
    sources
  };
}
