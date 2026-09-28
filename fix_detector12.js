const fs = require('fs');
const path = 'lib/ai/intent/detector.ts';
let code = fs.readFileSync(path, 'utf8');

const mpStartIdx = code.indexOf('  private matchPattern(');
const mpEndIdx = code.indexOf('  /**', mpStartIdx);
const mpBlock = code.substring(mpStartIdx, mpEndIdx);

// Fixing ANNADANA -> NEXT_AARADHANE misroute. The semantic router might be matching ANNADANA to NEXT_AARADHANE or keyword is returning NEXT_AARADHANE? Let's aggressively penalize NEXT_AARADHANE for "annadana".
// Oh wait, in fix_detector11 I had:
// `if (pattern.intent as string === "NEXT_AARADHANE" && normalizedMessage.includes("annadana")) { confidence = Math.min(confidence, 30); }`
// Maybe "annadana" wasn't matching ANNADANA keywords with enough confidence, so it fell to Semantic Matcher?
// Wait, ANNADANA keywords had "free meals", "annadana", "meal service", "meal".
// But "raghavendra quote" -> mapped to SRI_RAGHAVENDRA. I had a penalize for that too:
// `if (pattern.intent as string === "SRI_RAGHAVENDRA" && normalizedMessage.includes("quote")) { confidence = Math.min(confidence, 30); }`
// Why did that fail?
// Because the semantic engine returns 100% for SRI_RAGHAVENDRA or NEXT_AARADHANE?
// Let's force the semantic combiner to NOT use Semantic if the Keyword engine explicitly hits exactly!
const newMatchPattern = mpBlock.replace(
    'if (confidence > 100) confidence = 100;',
    'if (confidence > 100) confidence = 100;\n    // Explicit override for exact matches\n    if (matchedKeywords.length > 0 && normalizedMessage === matchedKeywords[0]) { confidence = 100; }'
);
code = code.replace(mpBlock, newMatchPattern);

fs.writeFileSync(path, code, 'utf8');
