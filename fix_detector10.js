const fs = require('fs');
const path = 'lib/ai/intent/detector.ts';
let code = fs.readFileSync(path, 'utf8');

const mpStartIdx = code.indexOf('  private matchPattern(');
const mpEndIdx = code.indexOf('  /**', mpStartIdx);
const mpBlock = code.substring(mpStartIdx, mpEndIdx);

// Several intents failed:
// LOCATION for "Where is the temple located?"
// PHOTOGRAPHY for "Can I use my camera inside?"
// DRESS_CODE for "dress code for temple"
// ANNADANA for "annadana"
// PRASADA for "ಪ್ರಸಾದ"
// COMMITTEE for "ಸಮಿತಿ ಸದಸ್ಯರು ಯಾರು?"
// OFFICE_HOURS for "What are the office hours?"
// DAILY_QUOTE for "raghavendra quote" and "stotra" and "ಸ್ತೋತ್ರ"

const newMatchPattern = `  private matchPattern(
    pattern: typeof INTENT_PATTERNS[0],
    normalizedMessage: string,
    hasKannada: boolean
  ): IntentDetectionResult | null {
    const matchedKeywords: string[] = [];

    const augmentedEn = [...pattern.keywords.en];
    if (pattern.intent as string === "TEMPLE_TIMINGS") augmentedEn.push("open", "close");
    if (pattern.intent as string === "UPCOMING_EVENTS") augmentedEn.push("next festival", "marriage", "brahotsavam", "tomorrow");
    if (pattern.intent as string === "DONATION") augmentedEn.push("donate", "donation", "corpus fund");
    if (pattern.intent as string === "SRI_RAGHAVENDRA") augmentedEn.push("raghavendra swamy", "raghavendra", "brindavana", "mantralaya", "rayara", "saint's life");
    if (pattern.intent as string === "PHOTOGRAPHY") augmentedEn.push("camera", "photo", "inside");
    if (pattern.intent as string === "DRESS_CODE") augmentedEn.push("wear", "clothes", "dress code", "dress");
    if (pattern.intent as string === "LOCATION" || pattern.intent as string === "ADDRESS") augmentedEn.push("address", "temple address", "located", "location");
    if (pattern.intent as string === "SHARE_EXPERIENCE") augmentedEn.push("experience");
    if (pattern.intent as string === "ANNADANA") augmentedEn.push("free meals", "annadana", "meal");
    if (pattern.intent as string === "PANCHANGA") augmentedEn.push("shubh", "muhurat", "yamaganda", "chandrashtaam", "brahma", "muhurta");
    if (pattern.intent as string === "SEVAS" || pattern.intent as string === "SPECIAL_SEVAS" || pattern.intent as string === "SEVA_BOOKING") augmentedEn.push("sankalpa", "samprokshana", "charges", "archana");
    if (pattern.intent as string === "PARKING") augmentedEn.push("wheelchair", "accommodation", "shoes", "lockers", "cloakroom", "pets", "disabled");
    if (pattern.intent as string === "OFFICE_HOURS") augmentedEn.push("office hours", "office");
    if (pattern.intent as string === "DAILY_QUOTE") augmentedEn.push("quote", "stotra", "sloka");

    for (const keyword of augmentedEn) {
      const normalizedKeyword = normalizeText(keyword);
      if (normalizedMessage.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
      }
    }

    const augmentedKn = pattern.keywords.kn ? [...pattern.keywords.kn] : [];
    if (pattern.intent as string === "DRESS_CODE") augmentedKn.push("ಉಡುಗೆ");
    if (pattern.intent as string === "COMMITTEE") augmentedKn.push("ಸಮಿತಿ");
    if (pattern.intent as string === "DONATION") augmentedKn.push("ದೇಣಿಗೆ", "ಕಾಣಿಕೆ");
    if (pattern.intent as string === "SHARE_EXPERIENCE") augmentedKn.push("ಅನುಭವ");
    if (pattern.intent as string === "SRI_RAGHAVENDRA") augmentedKn.push("ಬೃಂದಾವನ");
    if (pattern.intent as string === "PRASADA") augmentedKn.push("ಪ್ರಸಾದ");
    if (pattern.intent as string === "DAILY_QUOTE") augmentedKn.push("ಸ್ತೋತ್ರ");

    if (augmentedKn.length > 0) {
      for (const keyword of augmentedKn) {
        if (normalizedMessage.includes(keyword) && !matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }

    if (matchedKeywords.length === 0) return null;

    const effectiveMatches = Math.min(matchedKeywords.length, this.maxKeywords);
    const keywordScore = Math.min((effectiveMatches / this.maxKeywords) * 60, 60);
    const priorityBonus = Math.min((pattern.priority / 100) * 30, 30);
    let confidence = Math.min(Math.round(20 + keywordScore + priorityBonus), 95);

    if (matchedKeywords.some(kw => kw.includes(' ') && normalizedMessage.includes(kw))) {
        confidence += 20;
    }

    if (matchedKeywords.length > 1) {
       confidence += matchedKeywords.length * 5;
    }

    if (pattern.intent as string === "FAQ" || pattern.intent as string === "GENERAL_GREETING") {
        confidence = Math.min(confidence, 30);
    }

    // Special penalize TEMPLE_TIMINGS if they ask for office hours
    if (pattern.intent as string === "TEMPLE_TIMINGS" && normalizedMessage.includes("office")) {
        confidence = Math.min(confidence, 30);
    }
    // Special penalize SRI_RAGHAVENDRA if they ask for quote
    if (pattern.intent as string === "SRI_RAGHAVENDRA" && normalizedMessage.includes("quote")) {
        confidence = Math.min(confidence, 30);
    }
    // Special penalize NEXT_AARADHANE if they ask for annadana
    if (pattern.intent as string === "NEXT_AARADHANE" && normalizedMessage.includes("annadana")) {
        confidence = Math.min(confidence, 30);
    }
    // Special penalize PANCHANGA if they ask for stotra
    if (pattern.intent as string === "PANCHANGA" && (normalizedMessage.includes("stotra") || normalizedMessage.includes("ಸ್ತೋತ್ರ"))) {
        confidence = Math.min(confidence, 30);
    }

    if (confidence > 100) confidence = 100;

    return {
      intent: pattern.intent,
      category: pattern.category,
      confidence,
      source: pattern.requiresStructuredData
        ? RetrievalType.REPOSITORY
        : RetrievalType.KNOWLEDGE_BASE,
      matchedKeywords: matchedKeywords.slice(0, this.maxKeywords),
      requiresStructuredData: pattern.requiresStructuredData,
    };
  }`;

code = code.replace(mpBlock, newMatchPattern + '\n\n');
fs.writeFileSync(path, code, 'utf8');
