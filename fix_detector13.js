const fs = require('fs');
const path = 'lib/ai/intent/detector.ts';
let code = fs.readFileSync(path, 'utf8');

const mpStartIdx = code.indexOf('  private combineResults(');
const mpEndIdx = code.indexOf('  /**', mpStartIdx);
const mpBlock = code.substring(mpStartIdx, mpEndIdx);

// The issue is in `combineResults`.
// "raghavendra quote" -> Keyword: DAILY_QUOTE (100%), Semantic: SRI_RAGHAVENDRA (100%).
// Why does SRI_RAGHAVENDRA win?
// Because:
/*
    if (semanticResult.confidence === 100 && semanticResult.source === RetrievalType.SEMANTIC_MATCH) {
      return semanticResult;
    }
*/
// If the semantic matcher returns exactly 100, it unconditionally overrides keywords (unless keyword was < 45 for FAQ).
// But for "annadana", Semantic returns NEXT_AARADHANE 100%. For "raghavendra quote", Semantic returns SRI_RAGHAVENDRA 100%.
// We MUST let Keyword win if it's 100%!

const newCombineResults = `  private combineResults(
    keywordResult: IntentDetectionResult,
    semanticResult: IntentDetectionResult
  ): IntentDetectionResult {

    if (keywordResult.intent !== Intent.UNKNOWN && keywordResult.matchedKeywords && keywordResult.matchedKeywords.length > 0) {
        if (semanticResult.confidence === 100 && keywordResult.confidence < 45 && semanticResult.intent !== Intent.FAQ) {
            return semanticResult;
        }

        if (keywordResult.confidence === 100) {
             return keywordResult;
        }

        let finalConf = keywordResult.confidence;
        if (finalConf <= semanticResult.confidence && semanticResult.intent !== Intent.FAQ) {
            finalConf = Math.min(semanticResult.confidence + 5, 100);
        }
        return { ...keywordResult, confidence: Math.max(finalConf, 85) };
    }

    if (semanticResult.confidence === 100 && semanticResult.source === RetrievalType.SEMANTIC_MATCH) {
      return semanticResult;
    }

    if (semanticResult.intent === Intent.FAQ && keywordResult.intent !== Intent.UNKNOWN && keywordResult.confidence > 0) {
        return keywordResult;
    }

    return keywordResult.confidence >= semanticResult.confidence
      ? keywordResult
      : semanticResult;
  }`;

code = code.replace(mpBlock, newCombineResults + '\n\n');
fs.writeFileSync(path, code, 'utf8');
