// Knowledge Base Seed Data
// Initial knowledge articles for Raya AI

import { KnowledgeArticle, KnowledgeCategory } from "./types";

/**
 * Generate a slug from title
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Create a knowledge article with defaults
 */
function createArticle(
  title: string,
  category: KnowledgeCategory,
  keywords: string[],
  content: string,
  kannadaTitle?: string,
  kannadaContent?: string,
  language: "en" | "kn" | "mixed" = "en"
): KnowledgeArticle {
  const now = new Date();
  const slug = slugify(title);
  return {
    id: `seed-${slug}`, // Use slug-based ID for seed articles
    slug,
    title,
    kannadaTitle,
    category,
    keywords,
    content,
    kannadaContent,
    language,
    approved: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Initial seed articles
 */
export const SEED_ARTICLES: Omit<KnowledgeArticle, "id">[] = [
  // ==================== TEMPLE HISTORY ====================
  createArticle(
    "About Sri Raghavendra Swamy Matha",
    "temple_history",
    ["about", "history", "matha", "established", "founded", "origin"],
    `Sri Raghavendra Swamy Matha is a spiritual institution dedicated to the worship and teachings of Sri Raghavendra Swamy, a renowned saint and philosopher of the Dvaita tradition.

**Location:** Yelahanka New Town, Bengaluru, Karnataka, India

**Purpose:** The Matha serves as a center for:
- Daily worship and rituals
- Spiritual teachings and discourses
- Community service and welfare
- Preservation of Madhwa philosophy
- Cultural and religious activities

**Welcome:** The Matha welcomes all devotees irrespective of caste, religion, or background. Everyone is invited to participate in the spiritual activities and seek the blessings of Sri Guru Raghavendra Swamy.`,
    "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠವು ದ್ವೈತ ಸಂಪ್ರದಾಯದ ಪ್ರಸಿದ್ಧ ಸಂತ ಮತ್ತು ತತ್ತ್ವಜ್ಞಾನಿಯಾದ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ಆರಾಧನೆ ಮತ್ತು ಉಪದೇಶಗಳಿಗೆ ಅರ್ಪಿತವಾದ ಆಧ್ಯಾತ್ಮಿಕ ಕೇಂದ್ರವಾಗಿದೆ.

**ಸ್ಥಳ:** ಯಲಹಂಕ ನ್ಯೂ ಟೌನ್, ಬೆಂಗಳೂರು, ಕರ್ನಾಟಕ, ಭಾರತ

**ಉದ್ದೇಶ:** ಮಠವು ಕೇಂದ್ರವಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ:
- ದೈನಂದಿನ ಆರಾಧನೆ ಮತ್ತು ವಿಧಿವಿಧಾನಗಳು
- ಆಧ್ಯಾತ್ಮಿಕ ಉಪದೇಶಗಳು ಮತ್ತು ಪ್ರವಚನಗಳು
- ಸಮುದಾಯ ಸೇವೆ ಮತ್ತು ಕಲ್ಯಾಣ
- ಮಾಧ್ವ ತತ್ತ್ವಶಾಸ್ತ್ರದ ಸಂರಕ್ಷಣೆ
- ಸಾಂಸ್ಕೃತಿಕ ಮತ್ತು ಧಾರ್ಮಿಕ ಚಟುವಟಿಕೆಗಳು

**ಸ್ವಾಗತ:** ಮಠವು ಜಾತಿ, ಧರ್ಮ ಅಥವಾ ಹಿನ್ನೆಲೆಯನ್ನು ಲೆಕ್ಕಿಸದೆ ಎಲ್ಲಾ ಭಕ್ತರನ್ನು ಸ್ವಾಗತಿಸುತ್ತದೆ. ಎಲ್ಲರನ್ನೂ ಆಧ್ಯಾತ್ಮಿಕ ಚಟುವಟಿಕೆಗಳಲ್ಲಿ ಭಾಗವಹಿಸಲು ಮತ್ತು ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ಅನುಗ್ರಹವನ್ನು ಪಡೆಯಲು ಆಹ್ವಾನಿಸಲಾಗಿದೆ.`
  ),

  createArticle(
    "Temple Establishment",
    "temple_history",
    ["when", "established", "history", "origin", "founded"],
    `Sri Raghavendra Swamy Matha at Yelahanka was established to serve devotees in the northern part of Bengaluru.

The Matha follows the traditions and teachings of Sri Raghavendra Swamy, continuing the legacy of service to devotees that began centuries ago in Mantralaya.

Devotees can visit the Matha for daily poojas, special sevas, and during the annual Aaradhane Mahotsava.`,
    "ಮಠ ಸ್ಥಾಪನೆ",
    `ಯಲಹಂಕದ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠವನ್ನು ಬೆಂಗಳೂರಿನ ಉತ್ತರ ಭಾಗದ ಭಕ್ತರಿಗೆ ಸೇವೆ ಸಲ್ಲಿಸಲು ಸ್ಥಾಪಿಸಲಾಯಿತು.

ಮಠವು ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ಸಂಪ್ರದಾಯಗಳು ಮತ್ತು ಉಪದೇಶಗಳನ್ನು ಅನುಸರಿಸುತ್ತದೆ, ಶತಮಾನಗಳ ಹಿಂದೆ ಮಂತ್ರಾಲಯದಲ್ಲಿ ಪ್ರಾರಂಭವಾದ ಭಕ್ತರಿಗೆ ಸೇವೆ ಸಲ್ಲಿಸುವ ಪರಂಪರೆಯನ್ನು ಮುಂದುವರಿಸುತ್ತದೆ.

ಭಕ್ತರು ದೈನಂದಿನ ಪೂಜೆಗಳು, ವಿಶೇಷ ಸೇವೆಗಳು ಮತ್ತು ವಾರ್ಷಿಕ ಆರಾಧನೆ ಮಹೋತ್ಸವದ ಸಮಯದಲ್ಲಿ ಮಠಕ್ಕೆ ಭೇಟಿ ನೀಡಬಹುದು.`
  ),

  // ==================== MADHWA PHILOSOPHY ====================
  createArticle(
    "Madhwa Philosophy - Dvaita Vedanta",
    "madhwa_philosophy",
    ["madhwa", "madhvacharya", "dvaita", "vedanta", "philosophy", "dualism", "ಮಾಧ್ವ", "ದ್ವೈತ"],
    `Madhwa Philosophy, also known as Dvaita Vedanta, is one of the three major schools of Vedanta philosophy established by Sri Madhvacharya (1238–1317 CE).

**About Madhvacharya:**
Sri Madhvacharya (Madhava Vidyaranya) was born in 1238 CE in Uddike village in Karnataka. He was a great scholar who established the Dvaita (dualistic) school of Vedanta.

**Core Teachings:**
1. **Dualism:** God (Brahma/Vishnu), souls (Jeevatma), and matter (Jada) are eternally distinct.
2. **God is Supreme:** Lord Vishnu is the supreme reality and ultimate goal of liberation.
3. **Soul's Individuality:** Souls remain eternally distinct from God, even in liberation.
4. **Devotion (Bhakti):** Liberation is achieved through surrender to God and devotion.
5. **Works and Grace:** Both individual effort and divine grace are necessary for salvation.

**Key Texts:**
- Brahmasutras (Brahmasutra Bhashya)
- Mahabharata Tatparya Nirnaya
- Bhagavata Purana ( commentaries)
- Brahma Sutra Bhashya

**Difference from Other Schools:**
- Advaita: Claims soul = God (non-dualism) - Madhva rejected this
- Vishishtadvaita: Soul is part of God - Madhva rejected this
- Dvaita: Soul ≠ God, eternally distinct - Madhva's view

Sri Raghavendra Swamy was a follower of Madhwa philosophy and continued this tradition at Mantralaya.

The temple follows Madhwa traditions including:
- Daily Dvaita recitations
- Madhwa festivals and celebrations
- Propagation of Dvaita teachings
- Services aligned with Madhwa principles`,
    "ಮಾಧ್ವ ತತ್ತ್ವಶಾಸ್ತ್ರ - ದ್ವೈತ ವೇದಾಂತ",
    `ಮಾಧ್ವ ತತ್ತ್ವಶಾಸ್ತ್ರ, ದ್ವೈತ ವೇದಾಂತ ಎಂದೂ ಕರೆಯಲ್ಪಡುತ್ತದೆ, ಇದು ಶ್ರೀ ಮಾಧವಾಚಾರ್ಯರಿಂದ (೧೨೩೮-೧೩೧೭ ಕ್ರಿ.ಶ.) ಸ್ಥಾಪಿತವಾದ ವೇದಾಂತ ತತ್ತ್ವಶಾಸ್ತ್ರದ ಮೂರು ಪ್ರಮುಖ ಶಾಲೆಗಳಲ್ಲಿ ಒಂದಾಗಿದೆ.

**ಮಾಧವಾಚಾರ್ಯರ ಬಗ್ಗೆ:**
ಶ್ರೀ ಮಾಧವಾಚಾರ್ಯರು (ಮಾಧವ ವಿದ್ಯಾರಂಗ) ಕರ್ನಾಟಕದ ಊಡಿಕೆ ಗ್ರಾಮದಲ್ಲಿ ೧೨೩೮ ರಲ್ಲಿ ಜನಿಸಿದರು. ಅವರು ದ್ವೈತ (ದ್ವಂದ್ವ) ವೇದಾಂತ ಶಾಲೆಯನ್ನು ಸ್ಥಾಪಿಸಿದ ಮಹಾನ್ ವಿದ್ವಾಂಸರಾಗಿದ್ದರು.

**ಮುಖ್ಯ ಉಪದೇಶಗಳು:**
೧. **ದ್ವಂದ್ವವಾದ:** ದೇವರು (ಬ್ರಹ್ಮ/ವಿಷ್ಣು), ಆತ್ಮಗಳು (ಜೀವಾತ್ಮ) ಮತ್ತು ಜಡ ಪದಾರ್ಥಗಳು ಶಾಶ್ವತವಾಗಿ ಭಿನ್ನವಾಗಿವೆ.
೨. **ದೇವರು ಸರ್ವೋಚ್ಚ:** ಪ್ರಭು ವಿಷ್ಣು ಸರ್ವೋನ್ನತ ವಾಸ್ತವಿಕತೆ ಮತ್ತು ಮೋಕ್ಷದ ಅಂತಿಮ ಗುರಿಯಾಗಿದ್ದಾರೆ.
೩. **ಆತ್ಮದ ವೈಶಿಷ್ಟ್ಯ:** ಮೋಕ್ಷದಲ್ಲಿಯೂ ಆತ್ಮಗಳು ದೇವರಿಂದ ಶಾಶ್ವತವಾಗಿ ಭಿನ್ನವಾಗಿರುತ್ತವೆ.
೪. **ಭಕ್ತಿ:** ದೇವರಿಗೆ ಸಮರ್ಪಣೆ ಮತ್ತು ಭಕ್ತಿಯಿಂದ ಮೋಕ್ಷ ಪಡೆಯಲಾಗುತ್ತದೆ.
೫. **ಕರ್ಮ ಮತ್ತು ಕೃಪೆ:** ರಕ್ಷಣೆಗೆ ವೈಯಕ್ತಿಕ ಪ್ರಯತ್ನ ಮತ್ತು ದೈವಿಕ ಕೃಪೆ ಎರಡೂ ಅವಶ್ಯಕ.

**ಮುಖ್ಯ ಗ್ರಂಥಗಳು:**
- ಬ್ರಹ್ಮಸೂತ್ರಗಳು (ಬ್ರಹ್ಮಸೂತ್ರ ಭಾಷ್ಯ)
- ಮಹಾಭಾರತ ತತ್ತ್ವ ನಿರ್ಣಯ
- ಭಾಗವತ ಪುರಾಣ (ಟಿಪ್ಪಣಿಗಳು)
- ಬ್ರಹ್ಮ ಸೂತ್ರ ಭಾಷ್ಯ

ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರು ಮಾಧ್ವ ತತ್ತ್ವಶಾಸ್ತ್ರದ ಅನುಯಾಯಿಯಾಗಿದ್ದರು ಮತ್ತು ಮಂತ್ರಾಲಯದಲ್ಲಿ ಈ ಸಂಪ್ರದಾಯವನ್ನು ಮುಂದುವರಿಸಿದರು.

ದೇವಸ್ಥಾನವು ಮಾಧ್ವ ಸಂಪ್ರದಾಯಗಳನ್ನು ಅನುಸರಿಸುತ್ತದೆ.`
  ),

  createArticle(
    "Madhvacharya - Life and Teachings",
    "madhwa_philosophy",
    ["madhavacharya", "life", "biography", "guru", "ಮಾಧವಾಚಾರ್ಯ"],
    `Sri Madhvacharya (1238–1317 CE) was the founder of Dvaita Vedanta philosophy and the spiritual preceptor lineage followed by Sri Raghavendra Swamy.

**Birth and Early Life:**
- Born in 1238 CE in Uddike village, near Dwaraka, Karnataka
- His birth name was Vasudeva
- Displayed exceptional scholarly abilities from childhood

**Spiritual Journey:**
- Became a disciple of Sri Adikesava Teertha
- Received the title "Madhva" from his guru
- Traveled across India debating with scholars

**Major Works:**
1. **Commentaries on Vedanta:** Brahmasutra Bhashya, Bhagavata Bhashya
2. **Philosophical Treatises:** Anu Vyakhya, Nyaya Vivarana
3. **Theological Works:** Vishnu Tattva Nirnaya, Mahabharata Tatparya Nirnaya

**Teachings:**
- God (Brahma) is the efficient and material cause of the universe
- Souls are infinite in number, eternally distinct from God
- Matter is real, not illusory
- Liberation is release from worldly bondage and attainment of God
- Bhakti (devotion) is the means to liberation

**Legacy:**
Madhvacharya established the Madhwa Matha at Dwaraka and left behind a lineage of guru-parampara that continues to this day. Sri Raghavendra Swamy was part of this parampara.

The teachings of Madhvacharya are preserved and practiced at Sri Raghavendra Swamy Matha.`,
    "ಮಾಧವಾಚಾರ್ಯ - ಜೀವನ ಮತ್ತು ಉಪದೇಶಗಳು",
    `ಶ್ರೀ ಮಾಧವಾಚಾರ್ಯರು (೧೨೩೮-೧೩೧೭ ಕ್ರಿ.ಶ.) ದ್ವೈತ ವೇದಾಂತ ತತ್ತ್ವಶಾಸ್ತ್ರದ ಪ್ರತಿಷ್ಠಾಪಕರು ಮತ್ತು ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ಆಧ್ಯಾತ್ಮಿಕ ಗುರುವಂಶದ ಮುಖಂಡರಾಗಿದ್ದರು.

**ಜನನ ಮತ್ತು ಆರಂಭಿಕ ಜೀವನ:**
- ೧೨೩೮ ರಲ್ಲಿ ಕರ್ನಾಟಕದ ದ್ವಾರಕೆಯ ಬಳಿ ಇರುವ ಊಡಿಕೆ ಗ್ರಾಮದಲ್ಲಿ ಜನಿಸಿದರು
- ಅವರ ಹುಟ್ಟು ಹೆಸರು ವಾಸುದೇವ
- �childhoodದಿಂದಲೂ ಅಸಾಧಾರಣ ವಿದ್ವತ್ತು ಪ್ರದರ್ಶಿಸಿದರು

**ಆಧ್ಯಾತ್ಮಿಕ ಪ್ರಯಾಣ:**
- ಶ್ರೀ ಆದಿಕೇಶವ ತೀರ್ಥರ ಶಿಷ್ಯರಾದರು
- ಗುರುವಿನಿಂದ "ಮಾಧ್ವ" ಬಿರುದನ್ನು ಪಡೆದರು
- ವಿದ್ವಾಂಸರೊಂದಿಗೆ ಭಾರತದಾದ್ಯಂತ ಚರ್ಚೆ ನಡೆಸಿದರು

**ಮುಖ್ಯ ಕೃತಿಗಳು:**
೧. **ವೇದಾಂತ ಟಿಪ್ಪಣಿಗಳು:** ಬ್ರಹ್ಮಸೂತ್ರ ಭಾಷ್ಯ, ಭಾಗವತ ಭಾಷ್ಯ
೨. **ತಾರ್ಕಿಕ ಗ್ರಂಥಗಳು:** ಅನು ವ್ಯಾಖ್ಯಾನ, ನ್ಯಾಯ ವಿವರಣೆ
೩. **ಧಾರ್ಮಿಕ ಕೃತಿಗಳು:** ವಿಷ್ಣು ತತ್ತ್ವ ನಿರ್ಣಯ, ಮಹಾಭಾರತ ತತ್ತ್ವ ನಿರ್ಣಯ

**ಉಪದೇಶಗಳು:**
- ದೇವರು (ಬ್ರಹ್ಮ) ಬ್ರಹ್ಮಾಂಡದ ಕಾರ್ಯಕಾರಣ ಮತ್ತು ವಸ್ತು ಕಾರಣ
- ಆತ್ಮಗಳು ಅಸಂಖ್ಯಾತ, ದೇವರಿಂದ ಶಾಶ್ವತವಾಗಿ ಭಿನ್ನ
- ಜಡ ವಸ್ತು ನಿಜ, ಮಿಥ್ಯೆ ಅಲ್ಲ
- ಮೋಕ್ಷ ಜಗತ್ತಿನ ಬಂಧನದಿಂದ ಬಿಡುಗಡೆ ಮತ್ತು ದೇವರನ್ನು ಪಡೆಯುವುದು
- ಭಕ್ತಿ ಮೋಕ್ಷದ ಸಾಧನ

**ಪರಂಪರೆ:**
ಮಾಧವಾಚಾರ್ಯರು ದ್ವಾರಕೆಯಲ್ಲಿ ಮಾಧ್ವ ಮಠವನ್ನು ಸ್ಥಾಪಿಸಿದರು ಮತ್ತು ಇಂದಿಗೂ ಮುಂದುವರಿಯುವ ಗುರು-ಪರಂಪರೆಯನ್ನು ಬಿಟ್ಟು ಹೋದರು. ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರು ಈ ಪರಂಪರೆಯ ಭಾಗವಾಗಿದ್ದರು.

ಮಾಧವಾಚಾರ್ಯರ ಉಪದೇಶಗಳನ್ನು ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದಲ್ಲಿ ಕಾಪಾಡಲಾಗಿದೆ ಮತ್ತು ಅಭ್ಯಾಸ ಮಾಡಲಾಗುತ್ತದೆ.`
  ),

  // ==================== BRINDAVANA ====================
  createArticle(
    "Brindavana - Sacred Final Resting Place",
    "brindavana",
    ["brindavana", "brindavan", "tomb", "samadhi", "resting place", "mantralaya", "ಬೃಂದಾವನ"],
    `The Brindavana (Brindavan) of Sri Raghavendra Swamy is located at Mantralaya in Raichur district, Karnataka. This is the sacred final resting place where Swamiji attained Samadhi in 1672 CE.

**About the Brindavana:**
- Located at Mantralaya, Karnataka
- The samadhi (tomb) is covered with a grand structure
- Thousands of devotees visit daily, especially on Thursdays
- The Brindavana is considered the most sacred spot for Raghavendra Swamy devotees

**Mantralaya:**
- Small town in Raichur district, Karnataka
- Located on the banks of the river Krishna
- Major pilgrimage center for Raghavendra Swamy devotees
- Connected by road and rail

**Significance:**
- The Brindavana is believed to have miraculous powers
- Devotees seek blessings for health, wealth, and spiritual progress
- It is customary to visit Mantralaya at least once in a lifetime
- The Aaradhane Mahotsava is conducted here annually

**Visiting the Brindavana:**
- Open all days, best time is early morning or evening
- Special poojas are conducted on Fridays and Thursdays
- Annadanam (free food) is served to all visitors
- Accommodation is available near the temple

**Brindavana at Yelahanka Matha:**
Sri Raghavendra Swamy Matha, Yelahanka maintains the traditions and teachings of Mantralaya. The idol of Swamiji here is worshipped with same devotion as at Mantralaya.

Devotees consider visiting the Brindavana at Mantralaya as highly auspicious and spiritually rewarding.`,
    "ಬೃಂದಾವನ - ಪವಿತ್ರ ಕೊನೆಯ ವಿಶ್ರಾಂತಿ ಸ್ಥಳ",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ಬೃಂದಾವನವು ಕರ್ನಾಟಕದ ರಾಯಚೂರು ಜಿಲ್ಲೆಯ ಮಂತ್ರಾಲಯದಲ್ಲಿದೆ. ಇದು ೧೬೭೨ ರಲ್ಲಿ ಸ್ವಾಮಿಜಿ ಸಮಾಧಿ ಪಡೆದ ಪವಿತ್ರ ಕೊನೆಯ ವಿಶ್ರಾಂತಿ ಸ್ಥಳವಾಗಿದೆ.

**ಬೃಂದಾವನದ ಬಗ್ಗೆ:**
- ಕರ್ನಾಟಕದ ಮಂತ್ರಾಲಯದಲ್ಲಿ ನೆಲೆಗೊಂಡಿದೆ
- ಸಮಾಧಿ (ಸಮಾಧಿ) ಭವ್ಯ ರಚನೆಯಿಂದ ಆವರಿಸಲ್ಪಟ್ಟಿದೆ
- ದಿನಕ್ಕೆ ಸಾವಿರಾರು ಭಕ್ತರು ಭೇಟಿ ನೀಡುತ್ತಾರೆ, ವಿಶೇಷವಾಗಿ ಗುರುವಾರಗಳಂದು
- ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಭಕ್ತರಿಗೆ ಅತ್ಯಂತ ಪವಿತ್ರ ಸ್ಥಳವೆಂದು ಪರಿಗಣಿಸಲಾಗಿದೆ

**ಮಂತ್ರಾಲಯ:**
- ರಾಯಚೂರು ಜಿಲ್ಲೆಯ ಸಣ್ಣ ಪಟ್ಟಣ
- ಕೃಷ್ಣಾ ನದಿಯ ದಡದಲ್ಲಿ ನೆಲೆಗೊಂಡಿದೆ
- ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಭಕ್ತರಿಗೆ ಪ್ರಮುಖ ತೀರ್ಥಯಾತ್ರಾ ಕೇಂದ್ರ
- ರಸ್ತೆ ಮತ್ತು ರೈಲು ಮೂಲಕ ಸಂಪರ್ಕ

**ಮಹತ್ವ:**
- ಬೃಂದಾವನವು ಅದ್ಭುತ ಶಕ್ತಿಗಳನ್ನು ಹೊಂದಿದೆ ಎಂದು ನಂಬಲಾಗಿದೆ
- ಭಕ್ತರು ಆರೋಗ್ಯ, ಐಶ್ವರ್ಯ ಮತ್ತು ಆಧ್ಯಾತ್ಮಿಕ ಪ್ರಗತಿಗಾಗಿ ಅನುಗ್ರಹ ಬೇಡುತ್ತಾರೆ
- ಜೀವನದಲ್ಲಿ ಕನಿಷ್ಠ ಒಮ್ಮೆ ಮಂತ್ರಾಲಯಕ್ಕೆ ಭೇಟಿ ನೀಡುವುದು ವಾಡಿಕೆ
- ಆರಾಧನೆ ಮಹೋತ್ಸವವನ್ನು ಇಲ್ಲಿ ವಾರ್ಷಿಕವಾಗಿ ನಡೆಸಲಾಗುತ್ತದೆ

**ಬೃಂದಾವನಕ್ಕೆ ಭೇಟಿ:**
- ಎಲ್ಲಾ ದಿನ ತೆರೆದಿರುತ್ತದೆ, ಬೆಳಿಗ್ಗೆ ಅಥವಾ ಸಂಜೆ ಉತ್ತಮ ಸಮಯ
- ಶುಕ್ರವಾರ ಮತ್ತು ಗುರುವಾರಗಳಂದು ವಿಶೇಷ ಪೂಜೆಗಳು ನಡೆಯುತ್ತವೆ
- ಎಲ್ಲಾ ಭೇಟಿದಾರರಿಗೆ ಅನ್ನದಾನಮ್ (ಉಚಿತ ಆಹಾರ) ಸರ್ವಿಸ್ ಮಾಡಲಾಗುತ್ತದೆ
- ದೇವಸ್ಥಾನದ ಬಳಿ ವಸತಿ ಲಭ್ಯ`
  ),

  createArticle(
    "Sri Raghavendra Swamy - Life and Teachings",
    "sri_raghavendra",
    ["raghavendra", "swamy", "guru", "life", "biography", "teachings", "ರಾಘವೇಂದ್ರ"],
    `Sri Raghavendra Swamy (1595–1672 CE) was a renowned saint, scholar, and philosopher of the Dvaita (dualistic) school of Vedanta.

**Birth:** Born in 1595 in a village called Bhairanahalli near Mantralaya, Karnataka.

**Spiritual Journey:**
- Disciple of Sri Sudheendra Teertha of the Madhwa tradition
- Known for his scholarly works in Sanskrit and Kannada
- Established the Brindavana at Mantralaya in 1671

**Key Teachings:**
1. **Bhakti (Devotion):** Complete surrender to the lotus feet of the Lord
2. **Service:** Serving humanity as service to God
3. **Truth:** Upholding truth and righteousness
4. **Guru Bhakti:** Deep reverence for the Guru lineage

Sri Raghavendra Swamy is revered as an incarnation of Lord Venkateswara by many devotees. His Aradhana (day of attaining lotus feet of the Lord) is celebrated annually as a grand festival.`,
    "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ - ಜೀವನ ಮತ್ತು ಉಪದೇಶಗಳು",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರು (೧೫೯೫-೧೬೭೨ ಕ್ರಿ.ಶ.) ದ್ವೈತ (ದ್ವಂದ್ವ) ವೇದಾಂತ ಶಾಲೆಯ ಪ್ರಸಿದ್ಧ ಸಂತ, ವಿದ್ವಾಂಸ ಮತ್ತು ತತ್ತ್ವಜ್ಞಾನಿಯಾಗಿದ್ದರು.

**ಜನನ:** ಕರ್ನಾಟಕದ ಮಂತ್ರಾಲಯದ ಬಳಿ ಇರುವ ಭೈರನಹಳ್ಳಿ ಎಂಬ ಗ್ರಾಮದಲ್ಲಿ ೧೫೯೫ ರಲ್ಲಿ ಜನಿಸಿದರು.

**ಆಧ್ಯಾತ್ಮಿಕ ಪ್ರಯಾಣ:**
- ಮಾಧ್ವ ಸಂಪ್ರದಾಯದ ಶ್ರೀ ಸುಧೀಂದ್ರ ತೀರ್ಥರ ಶಿಷ್ಯ
- ಸಂಸ್ಕೃತ ಮತ್ತು ಕನ್ನಡದಲ್ಲಿ ವಿದ್ವತ್ತಿನ ಕೃತಿಗಳಿಗೆ ಹೆಸರುವಾಸಿ
- ೧೬೭೧ ರಲ್ಲಿ ಮಂತ್ರಾಲಯದಲ್ಲಿ ಬೃಂದಾವನವನ್ನು ಸ್ಥಾಪಿಸಿದರು

**ಮುಖ್ಯ ಉಪದೇಶಗಳು:**
೧. **ಭಕ್ತಿ:** ಪ್ರಭುವಿನ ಚರಣಗಳಿಗೆ ಪೂರ್ಣ ಸಮರ್ಪಣೆ
೨. **ಸೇವೆ:** ಮಾನವೀಯತೆಗೆ ಸೇವೆ ದೇವರಿಗೆ ಸೇವೆ
೩. **ಸತ್ಯ:** ಸತ್ಯ ಮತ್ತು ಧರ್ಮದ ಪಾಲನೆ
೪. **ಗುರು ಭಕ್ತಿ:** ಗುರು ವಂಶಕ್ಕೆ ಆಳವಾದ ಗೌರವ

ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರನ್ನು ಅನೇಕ ಭಕ್ತರು ಪ್ರಭು ವೆಂಕಟೇಶ್ವರರ ಅವತಾರವೆಂದು ಗೌರವಿಸುತ್ತಾರೆ.`
  ),

  createArticle(
    "Aradhana Mahotsava",
    "sri_raghavendra",
    ["aradhana", "aradhana mahotsava", "annual", "festival", "celebration", "ಆರಾಧನೆ"],
    `Sri Raghavendra Swamy Aradhana Mahotsava is the most important annual festival at our Matha and at Mantralaya.

**What is Aaradhana?**
Aradhana marks the day when Sri Raghavendra Swamy attained the lotus feet of the Lord (entered Brindavana) on the 5th day of the bright fortnight of the month of Margashirsha (November-December).

**Celebrations Include:**
- Special Panchamruta Abhisheka
- Veda Parayana
- Bhajans and Kirtans
- Pravachana (spiritual discourses)
- Annadanam (free food distribution)
- Cultural programmes
- Procession of the deity

Devotees from across the country visit during this time to seek blessings and participate in the sacred rituals.`,
    "ಆರಾಧನೆ ಮಹೋತ್ಸವ",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಆರಾಧನೆ ಮಹೋತ್ಸವವು ನಮ್ಮ ಮಠ ಮತ್ತು ಮಂತ್ರಾಲಯದಲ್ಲಿ ಅತ್ಯಂತ ಮುಖ್ಯ ವಾರ್ಷಿಕ ಉತ್ಸವವಾಗಿದೆ.

**ಆರಾಧನೆ ಎಂದರೇನು?**
ಮಾರ್ಗಶಿರ್ಷ ತಿಂಗಳ (ನವೆಂಬರ-ಡಿಸೆಂಬರ) ಶುಕ್ಲ ಪಕ್ಷದ ೫ನೇ ದಿನ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರು ಪ್ರಭುವಿನ ಚರಣಗಳನ್ನು ಪಡೆದ (ಬೃಂದಾವನವನ್ನು ಪ್ರವೇಶಿಸಿದ) ದಿನವನ್ನು ಆರಾಧನೆ ಎಂದು ಆಚರಿಸಲಾಗುತ್ತದೆ.

**ಆಚರಣೆಗಳು:**
- ವಿಶೇಷ ಪಂಚಾಮೃತ ಅಭಿಷೇಕ
- ವೇದ ಪಾರಾಯಣ
- ಭಜನೆ ಮತ್ತು ಕೀರ್ತನೆಗಳು
- ಪ್ರವಚನ (ಆಧ್ಯಾತ್ಮಿಕ ಉಪದೇಶಗಳು)
- ಅನ್ನದಾನಮ್ (ಉಚಿತ ಆಹಾರ ವಿತರಣೆ)
- ಸಾಂಸ್ಕೃತಿಕ ಕಾರ್ಯಕ್ರಮಗಳು
- ದೇವತಾ ಮೆರವಣಿಗೆ`
  ),

  // ==================== GURU PARAMPARA ====================
  createArticle(
    "Guru Parampara - Lineage",
    "guru_parampara",
    ["guru", "parampara", "lineage", "tradition", "succession", "preceptor", "ಗುರು", "ಪರಂಪರೆ"],
    `The Guru Parampara (lineage of preceptors) is the unbroken chain of spiritual teachers in the Madhwa tradition.

**Sri Raghavendra Swamy's Lineage:**
1. **Lord Narasimha** → Source
2. **Madhvacharya** (1238–1317 CE) → Founder of Dvaita philosophy
3. **Padmanabha Tirtha** → Disciple of Madhvacharya
4. **Narayana Panditacharya**
5. **Madhava Tirtha**
6. **Akshaya Tirtha**
7. **Vijaya Tirtha**
8. **Raghavendra Tirtha** (Before joining monastic life)
9. **Sudheendra Tirtha** → Guru of Sri Raghavendra Swamy
10. **Sri Raghavendra Swamy** (1595–1672)

This parampara represents the oral tradition of spiritual knowledge passed from guru to disciple, ensuring the preservation of Vedic wisdom and Dvaita philosophy.`,
    "ಗುರು ಪರಂಪರೆ - ವಂಶಾವಳಿ",
    `ಗುರು ಪರಂಪರೆಯು ಮಾಧ್ವ ಸಂಪ್ರದಾಯದಲ್ಲಿ ಆಧ್ಯಾತ್ಮಿಕ ಶಿಕ್ಷಕರ ಮುರಿಯದ ಸರಪಳಿಯಾಗಿದೆ.

**ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ವಂಶಾವಳಿ:**
೧. **ಪ್ರಭು ನರಸಿಂಹ** → ಮೂಲ
೨. **ಮಾಧವಾಚಾರ್ಯ** (೧೨೩೮-೧೩೧೭ ಕ್ರಿ.ಶ.) → ದ್ವೈತ ತತ್ತ್ವಶಾಸ್ತ್ರದ ಪ್ರತಿಷ್ಠಾಪಕ
೩. **ಪದ್ಮನಾಭ ತೀರ್ಥ** → ಮಾಧವಾಚಾರ್ಯರ ಶಿಷ್ಯ
೪. **ನಾರಾಯಣ ಪಂಡಿತಾಚಾರ್ಯ**
೫. **ಮಾಧವ ತೀರ್ಥ**
೬. **ಅಕ್ಷಯ ತೀರ್ಥ**
೭. **ವಿಜಯ ತೀರ್ಥ**
೮. **ರಾಘವೇಂದ್ರ ತೀರ್ಥ** (ಸನ್ಯಾಸ ಜೀವನಕ್ಕೆ ಸೇರುವ ಮುನ್ನ)
೯. **ಸುಧೀಂದ್ರ ತೀರ್ಥ** → ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ಗುರು
೧೦. **ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ** (೧೫೯೫-೧೬೭೨)

ಈ ಪರಂಪರೆಯು ಗುರುವಿನಿಂದ ಶಿಷ್ಯನಿಗೆ ಆಧ್ಯಾತ್ಮಿಕ ಜ್ಞಾನದ ಮೌಖಿಕ ಸಂಪ್ರದಾಯವನ್ನು ಪ್ರತಿನಿಧಿಸುತ್ತದೆ.`
  ),

  createArticle(
    "Madhwa Philosophy",
    "madhwa_philosophy",
    ["madhva", "madhvacharya", "dvaita", "philosophy", "dualism", "vedanta", "ದ್ವೈತ"],
    `Madhva Darsana (also called Dvaita Vedanta) is the philosophical system founded by Sri Madhvacharya.

**Core Principles:**

1. **God is Supreme:** Vishnu (Narayana) is the supreme reality and the cause of all creation.

2. **Jivas (Souls):** Individual souls are eternally distinct from God and from each other.

3. **Matter:** The physical world is real and distinct from God.

4. **Difference is Real:** The distinction between God, souls, and matter is eternal and real.

5. **Three Categories of Reality:**
   - **Paramarthika:** God (independent, all-pervading)
   - **Vyavaharika:** Souls and matter (dependent but real)
   - **Pratibhashika:** Illusion (temporary appearance)

**Key Texts:**
- Brahmasutrabhashya (Commentary on Brahma Sutras)
- Anuvyakhyana
- Mahabharayatatparyanirnaya
- Bhagavatatatparyanirnaya

Sri Raghavendra Swamy was a great proponent of this philosophy and wrote numerous works defending and explaining Madhva teachings.`,
    "ಮಾಧ್ವ ತತ್ತ್ವಶಾಸ್ತ್ರ",
    `ಮಾಧ್ವ ದರ್ಶನ (ದ್ವೈತ ವೇದಾಂತ ಎಂದೂ ಕರೆಯಲ್ಪಡುತ್ತದೆ) ಶ್ರೀ ಮಾಧವಾಚಾರ್ಯರಿಂದ ಸ್ಥಾಪಿತವಾದ ತಾತ್ವಿಕ ವ್ಯವಸ್ಥೆಯಾಗಿದೆ.

**ಮುಖ್ಯ ಸಿದ್ಧಾಂತಗಳು:**

೧. **ದೇವರು ಸರ್ವೋಚ್ಚ:** ವಿಷ್ಣು (ನಾರಾಯಣ) ಸರ್ವೋನ್ನತ ವಾಸ್ತವಿಕತೆ ಮತ್ತು ಎಲ್ಲಾ ಸೃಷ್ಟಿಯ ಕಾರಣ.
೨. **ಜೀವಗಳು (ಆತ್ಮಗಳು):** ವೈಯಕ್ತಿಕ ಆತ್ಮಗಳು ದೇವರಿಂದ ಮತ್ತು ಪರಸ್ಪರ ಶಾಶ್ವತವಾಗಿ ಭಿನ್ನ.
೩. **ಜಡ:** ಭೌತಿಕ ಜಗತ್ತು ನಿಜ ಮತ್ತು ದೇವರಿಂದ ಭಿನ್ನ.
೪. **ಭೇದ ನಿಜ:** ದೇವರು, ಆತ್ಮಗಳು ಮತ್ತು ಜಡದ ನಡುವಿನ ಭೇದ ಶಾಶ್ವತ ಮತ್ತು ನಿಜ.`
  ),

  // ==================== BRINDAVANA & MANTRALAYA ====================
  createArticle(
    "Brindavana - Sacred Tomb",
    "brindavana",
    ["brindavana", "tomb", "samadhi", "sacred", "mantralaya", "ಬೃಂದಾವನ"],
    `The Brindavana (sacred tomb/samadhi) of Sri Raghavendra Swamy is located at Mantralaya in Karnataka.

**About Mantralaya:**
- Located in Raichur district, Karnataka
- About 250 km from Hyderabad
- The place where Sri Raghavendra Swamy spent his final years

**The Brindavana:**
- Constructed in 1671 CE by Sri Raghavendra Swamy himself
- The samadhi is covered with a beautiful marble structure
- It is believed that taking dust from the Brindavana and applying it can cure ailments
- Devotees visit to offer prayers and seek blessings

**Tirthe (Holy Water):**
The teertha (sacred water) from the Brindavana is considered highly auspicious and is distributed to devotees. It is believed to have healing properties.

The daily rituals and services continue at Mantralaya, maintained by the Madhwa community and the descendents of the original disciples.`,
    "ಬೃಂದಾವನ - ಪವಿತ್ರ ಸಮಾಧಿ",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ಬೃಂದಾವನವು (ಪವಿತ್ರ ಸಮಾಧಿ) ಕರ್ನಾಟಕದ ಮಂತ್ರಾಲಯದಲ್ಲಿದೆ.

**ಮಂತ್ರಾಲಯದ ಬಗ್ಗೆ:**
- ರಾಯಚೂರು ಜಿಲ್ಲೆಯಲ್ಲಿ ನೆಲೆಗೊಂಡಿದೆ
- ಹೈದರಾಬಾದ್‌ನಿಂದ ಸುಮಾರು ೨೫೦ ಕಿ.ಮೀ ದೂರ
- ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರು ತಮ್ಮ ಕೊನೆಯ ವರ್ಷಗಳನ್ನು ಕಳೆದ ಸ್ಥಳ

**ಬೃಂದಾವನ:**
- ೧೬೭೧ ರಲ್ಲಿ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರಿಂದ ನಿರ್ಮಿತ
- ಸಮಾಧಿ ಸುಂದರ ಅಮೃತ ಶಿಲೆಯಿಂದ ಮುಚ್ಚಲ್ಪಟ್ಟಿದೆ`
  ),

  createArticle(
    "Mantralaya - The Sacred Place",
    "mantralaya",
    ["mantralaya", "location", "where", "karnataka", "travel", "ಮಂತ್ರಾಲಯ"],
    `Mantralaya is a pilgrimage center located in Karnataka, India, famous as the samadhi location of Sri Raghavendra Swamy.

**Location:**
- District: Raichur, Karnataka
- State: Karnataka
- Country: India
- Distance from Bengaluru: Approximately 450 km

**How to Reach:**
- **By Road:** Well-connected by bus and car. NH167 passes through Mantralaya.
- **By Rail:** Nearest railway station is Mantralaya Road (MTL) on Londa-Guntur line.
- **By Air:** Nearest airport is Hyderabad (International) or Belgaum.

**Facilities for Devotees:**
- Accommodation for visitors
- Free food (Annadanam) is served
- Prasad distribution
- Library with religious texts

**Best Time to Visit:**
- During Aradhana Mahotsava (November-December)
- Any time of the year is auspicious

Our Matha at Yelahanka maintains connections with Mantralaya and organizes pilgrimages during special occasions.`,
    "ಮಂತ್ರಾಲಯ - ಪವಿತ್ರ ಸ್ಥಳ",
    `ಮಂತ್ರಾಲಯವು ಕರ್ನಾಟಕ, ಭಾರತದಲ್ಲಿ ನೆಲೆಗೊಂಡಿರುವ ತೀರ್ಥಯಾತ್ರಾ ಕೇಂದ್ರವಾಗಿದೆ, ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯವರ ಸಮಾಧಿ ಸ್ಥಳವಾಗಿ ಪ್ರಸಿದ್ಧವಾಗಿದೆ.

**ಸ್ಥಳ:**
- ಜಿಲ್ಲೆ: ರಾಯಚೂರು, ಕರ್ನಾಟಕ
- ರಾಜ್ಯ: ಕರ್ನಾಟಕ
- ದೇಶ: ಭಾರತ
- ಬೆಂಗಳೂರಿನಿಂದ ದೂರ: ಸುಮಾರು ೪೫೦ ಕಿ.ಮೀ

**ಹೇಗೆ ತಲುಪಿಸಿಕೊಳ್ಳುವುದು:**
- **ರಸ್ತೆಯಿಂದ:** ಬಸ್ ಮತ್ತು ಕಾರಿನಿಂದ ಉತ್ತಮ ಸಂಪರ್ಕ
- **ರೈಲಿನಿಂದ:** ಮಂತ್ರಾಲಯ ರೋಡ್ (MTL) ನಿಲ್ದಾಣ`
  ),

  // ==================== DAILY POOJA & SEVAS ====================
  createArticle(
    "Daily Poojas",
    "daily_pooja",
    ["pooja", "puja", "daily", "schedule", "rituals", "ಪೂಜೆ"],
    `The daily poojas at Sri Raghavendra Swamy Matha follow traditional procedures.

**Typical Daily Schedule:**

**Morning:**
- Suprabhata Seva (Waking the deity)
- Panchamruta Abhisheka (Bath with sacred offerings)
- Alankara (Decoration)
- Archana (Chanting of names)
- Maha Mangalarati (Grand lamp offering)
- Teertha Prasada Distribution

**Evening:**
- Sandoor Dole (Applying sandal paste)
- Evening Arati
- Distribution of Teertha and Prasada

**Important Notes:**
- The exact schedule may vary on festival days
- Devotees should maintain silence in the temple premises
- Mobile phones should be on silent mode
- Footwear must be removed before entering the sanctum

For specific timings and special sevas, please contact the temple office or check the website.`,
    "ದೈನಂದಿನ ಪೂಜೆಗಳು",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದಲ್ಲಿ ದೈನಂದಿನ ಪೂಜೆಗಳು ಸಾಂಪ್ರದಾಯಿಕ ವಿಧಾನಗಳನ್ನು ಅನುಸರಿಸುತ್ತವೆ.

**ದೈನಂದಿನ ವೇಳಾಪಟ್ಟಿ:**

**ಬೆಳಿಗ್ಗೆ:**
- ಸುಪ್ರಭಾತ ಸೇವೆ (ದೇವರನ್ನು ಎಬ್ಬಿಸುವುದು)
- ಪಂಚಾಮೃತ ಅಭಿಷೇಕ
- ಅಲಂಕಾರ
- ಅರ್ಚನೆ
- ಮಹಾ ಮಂಗಳಾರತಿ
- ತೀರ್ಥ ಪ್ರಸಾದ ವಿತರಣೆ

**ಸಂಜೆ:**
- ಸಂದೂರ ಡೊಳ್ಳು
- ಸಂಜೆ ಆರತಿ
- ತೀರ್ಥ ಮತ್ತು ಪ್ರಸಾದ ವಿತರಣೆ`
  ),

  createArticle(
    "Visitor Guidelines",
    "visitor_guidelines",
    ["rules", "guidelines", "visit", "visiting", "instructions", "ನಿಯಮಗಳು"],
    `Welcome to Sri Raghavendra Swamy Matha! Please follow these guidelines to ensure a peaceful and respectful visit.

**General Conduct:**
- Maintain silence in the temple premises
- Remove footwear before entering the sanctum
- Keep mobile phones on silent mode
- Do not click photos inside the sanctum
- Maintain decorum at all times

**Dress Code:**
- Dress modestly and conservatively
- Traditional Indian attire is preferred
- Avoid shorts, sleeveless tops, and revealing clothing
- Head covered is appreciated (especially for women)

**During Pooja:**
- Do not enter during Archana if in progress
- Stand respectfully when Mangalarati is performed
- Accept Prasada with both hands

**Other Guidelines:**
- Follow instructions from temple priests and volunteers
- Do not offer food items inside the sanctum
- Leave offerings at designated places
- Be patient during peak hours

These guidelines help maintain the sacred atmosphere of the temple.`,
    "ಭೇಟಿದಾರರ ಮಾರ್ಗದರ್ಶಿನಿ",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠಕ್ಕೆ ಸ್ವಾಗತ! ಶಾಂತಿಯುತ ಮತ್ತು ಗೌರವಪೂರ್ಣ ಭೇಟಿಯನ್ನು ಖಾತ್ರಿಪಡಿಸಿಕೊಳ್ಳಲು ಈ ಮಾರ್ಗದರ್ಶಿನಿಗಳನ್ನು ಅನುಸರಿಸಿ.

**ಸಾಮಾನ್ಯ ನಡವಳಿಕೆ:**
- ದೇವಸ್ಥಾನದ ಆವರಣದಲ್ಲಿ ಮೌನವಾಗಿರಿ
- ಗರ್ಭಗೃಹವನ್ನು ಪ್ರವೇಶಿಸುವ ಮುನ್ನ ಪಾದರಕ್ಷೆಗಳನ್ನು ತೆಗೆದುಹಾಕಿ
- ಮೊಬೈಲ್ ಫೋನುಗಳನ್ನು ಮೌನ ಮೋಡ್‌ನಲ್ಲಿಡಿ
- ಗರ್ಭಗೃಹದೊಳಗೆ ಫೋಟೋ ತೆಗೆಯಬಾರದು`
  ),

  createArticle(
    "Dress Code",
    "dress_code",
    ["dress", "wear", "clothing", "attire", "what to wear", "ಉಡುಗೆ"],
    `Sri Raghavendra Swamy Matha welcomes all devotees. To maintain the sanctity of the temple, we request visitors to follow a modest dress code.

**Recommended Attire:**

**For Men:**
- Traditional: Dhoti, Kurta, Angavastram
- Formal: Long pants with collared shirts
- Avoid: Shorts, Bermudas, sleeveless shirts

**For Women:**
- Traditional: Saree, Punjabi dress, Kurta with dupatta
- Formal: Long skirt or pants with modest tops
- Avoid: Shorts, short skirts, sleeveless tops, revealing clothing

**General Guidelines:**
- Clothes should cover shoulders and knees
- Avoid flashy or revealing attire
- White and colored traditional wear is appreciated
- Head covered is a sign of respect (especially for women)

**Special Days:**
- During festivals and special poojas, traditional attire is especially recommended
- Some sevas may have specific requirements

Remember, the purpose is to maintain the sacred atmosphere and show respect to the deity and fellow devotees.`,
    "ಉಡುಗೆ ನಿಯಮ",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠವು ಎಲ್ಲಾ ಭಕ್ತರನ್ನು ಸ್ವಾಗತಿಸುತ್ತದೆ. ದೇವಸ್ಥಾನದ ಪವಿತ್ರತೆಯನ್ನು ಕಾಪಾಡಲು ಭೇಟಿದಾರರು ಮಿತಿಮೀರದ ಉಡುಗೆಯನ್ನು ಅನುಸರಿಸಲು ಕೋರಲಾಗಿದೆ.

**ಶಿಫಾರಸು ಮಾಡಲಾದ ಉಡುಗೆ:**

**ಪುರುಷರಿಗೆ:**
- ಸಾಂಪ್ರದಾಯಿಕ: ಧೋತಿ, ಕುರ್ತಾ, ಅಂಗವಸ್ತ್ರ
- ತಪ್ಪಿಸಿ: ಶಾರ್ಟ್ಸ್, ಬರ್ಮುಡಾಸ್, ತೋಳುರಹಿತ ಷರ್ಟ್‌ಗಳು

**ಮಹಿಳೆಯರಿಗೆ:**
- ಸಾಂಪ್ರದಾಯಿಕ: ಸಾರಿ, ಪಂಜಾಬಿ ಉಡುಗೆ, ದುಪಟ್ಟಾ ಹೊಂದಿದ ಕುರ್ತಾ
- ತಪ್ಪಿಸಿ: ಶಾರ್ಟ್ಸ್, ಮೊಟಕು ಸ್ಕರ್ಟ್‌ಗಳು, ತೋಳುರಹಿತ ಮೇಲಂಗಿಗಳು`
  ),

  // ==================== FAQ ====================
  createArticle(
    "Frequently Asked Questions",
    "faq",
    ["faq", "question", "questions", "help", "common", "ಪ್ರಶ್ನೆ"],
    `**Common Questions About Our Temple**

**Q: What are the temple timings?**
A: The temple is typically open from 6:00 AM to 12:00 PM in the morning and 5:00 PM to 8:30 PM in the evening. Festival timings may vary.

**Q: Is there a dress code?**
A: Yes, modest and conservative dress is recommended. Traditional Indian attire is preferred.

**Q: How can I book a Seva?**
A: Sevas can be booked online through our website or by visiting the temple office.

**Q: Is photography allowed?**
A: Photography is generally not allowed inside the sanctum. Please check with temple authorities for other areas.

**Q: Can I volunteer at the temple?**
A: Yes, we welcome volunteers. Please contact the temple office or speak with a priest during your visit.

**Q: How can I make a donation?**
A: Donations can be made online through our website or at the temple office. Tax receipts (80G) are available for eligible donations.

**Q: Is there accommodation available?**
A: Basic accommodation may be available for visiting devotees. Please contact the temple office in advance.

**Q: What is the nearest railway station?**
A: Yelahanka Junction is the nearest railway station. The temple is about 5 km from the station.

For any other questions, please contact the temple office.`,
    "ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳು",
    `**ನಮ್ಮ ದೇವಸ್ಥಾನದ ಬಗ್ಗೆ ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳು**

**ಪ್ರ: ದೇವಸ್ಥಾನದ ಸಮಯಗಳು ಯಾವುವು?**
ಉ: ಬೆಳಿಗ್ಗೆ ೬:೦೦ ರಿಂದ ೧೨:೦೦ ಮಧ್ಯಾಹ್ನ ಮತ್ತು ಸಂಜೆ ೫:೦೦ ರಿಂದ ೮:೩೦ ರವರೆಗೆ ತೆರೆದಿರುತ್ತದೆ.

**ಪ್ರ: ಉಡುಗೆ ನಿಯಮವಿದೆಯೇ?**
ಉ: ಹೌದು, ಮಿತಿಮೀರದ ಉಡುಗೆ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.

**ಪ್ರ: ಸೇವೆಯನ್ನು ಹೇಗೆ ಕಾಯ್ದಿಸಬಹುದು?**
ಉ: ನಮ್ಮ ವೆಬ್‌ಸೈಟ್ ಅಥವಾ ದೇವಸ್ಥಾನ ಕಛೇರಿಯಿಂದ ಕಾಯ್ದಿಸಬಹುದು.`
  ),

  createArticle(
    "Temple Facilities",
    "faq",
    ["facilities", "amenities", "parking", "toilet", "wheelchair", "prasad"],
    `Our temple provides various facilities for the comfort of devotees.

**Available Facilities:**

1. **Prasad Distribution:** Free Prasad (holy offerings) is distributed after poojas.

2. **Teertha (Holy Water):** Sacred water from the temple is available for devotees.

3. **Annadanam:** Free food is served during festivals and special occasions.

4. **Parking:** Limited parking is available near the temple. Please follow traffic regulations.

5. **Drinking Water:** Clean drinking water facilities are available.

6. **Restrooms:** Public restrooms are available near the temple entrance.

7. **Wheelchair Access:** Limited wheelchair facilities are available. Please contact temple authorities for assistance.

8. **Priest Services:** Priests are available for conducting special poojas and answering queries.

For queries about facilities or to report issues, please contact the temple office.`,
    "ದೇವಸ್ಥಾನ ಸೌಲಭ್ಯಗಳು",
    `ನಮ್ಮ ದೇವಸ್ಥಾನವು ಭಕ್ತರ ಸೌಕರ್ಯಕ್ಕಾಗಿ ವಿವಿಧ ಸೌಲಭ್ಯಗಳನ್ನು ಒದಗಿಸುತ್ತದೆ.

**ಲಭ್ಯ ಸೌಲಭ್ಯಗಳು:**

೧. **ಪ್ರಸಾದ ವಿತರಣೆ:** ಪೂಜೆಗಳ ನಂತರ ಉಚಿತ ಪ್ರಸಾದ ವಿತರಿಸಲಾಗುತ್ತದೆ.

೨. **ತೀರ್ಥ:** ದೇವಸ್ಥಾನದಿಂದ ಪವಿತ್ರ ನೀರು ಭಕ್ತರಿಗೆ ಲಭ್ಯ.

೩. **ಅನ್ನದಾನಮ್:** ಉತ್ಸವಗಳು ಮತ್ತು ವಿಶೇಷ ಸಂದರ್ಭಗಳಲ್ಲಿ ಉಚಿತ ಆಹಾರ ಸರ್ವಿಸ್ ಮಾಡಲಾಗುತ್ತದೆ.

೪. **ವಾಹನ ನಿಲುಗಡೆ:** ದೇವಸ್ಥಾನದ ಬಳಿ ಸೀಮಿತ ಪಾರ್ಕಿಂಗ್ ಲಭ್ಯ.`
  ),

  // ==================== DONATIONS ====================
  createArticle(
    "Donation Information",
    "donation_info",
    ["donate", "donation", "donations", "contribute", "support", "ದೇಣ"],
    `We welcome donations from devotees to support the temple's activities and services.

**Ways to Donate:**
- Online through our website (UPI, Net Banking, Cards)
- At the temple office (Cash, Cheque, Demand Draft)
- Bank Transfer (NEFT/RTGS)

**Donation Purposes:**
1. **Annadanam:** Food donation and free meals
2. **Temple Maintenance:** Upkeep and cleanliness
3. **Festival Sponsorship:** Support special celebrations
4. **General Development:** Temple improvements

**Tax Benefits:**
Donations to the temple trust are eligible for tax deduction under Section 80G of the Income Tax Act (50% of the donation amount).

**Receipts:**
All donors receive official receipts. For 80G certificates, please provide your PAN card details.

Contact the temple office for more information about specific donation purposes or to discuss sponsorship opportunities.`,
    "ದಾನ ಮಾಹಿತಿ",
    `ದೇವಸ್ಥಾನದ ಚಟುವಟಿಕೆಗಳನ್ನು ಬೆಂಬಲಿಸಲು ಭಕ್ತರಿಂದ ದಾನಗಳನ್ನು ಸ್ವಾಗತಿಸಲಾಗುತ್ತದೆ.

**ದಾನ ಮಾಡುವ ವಿಧಾನಗಳು:**
- ನಮ್ಮ ವೆಬ್‌ಸೈಟ್ ಮೂಲಕ (UPI, ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್, ಕಾರ್ಡ್‌ಗಳು)
- ದೇವಸ್ಥಾನ ಕಛೇರಿಯಲ್ಲಿ (ನಗದು, ಚೆಕ್, ಡಿಮ್ಯಾಂಡ್ ಡ್ರಾಫ್ಟ್)
- ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ (NEFT/RTGS)`
  ),

  // ==================== GENERAL ====================
  createArticle(
    "About the Temple Trust",
    "general",
    ["trust", "committee", "management", "who runs"],
    `Sri Raghavendra Swamy Matha is managed by a dedicated Trust Committee comprising experienced devotees and trustees.

**Trust Responsibilities:**
- Temple administration and management
- Financial oversight
- Event planning and execution
- Maintenance of rituals and traditions
- Community service initiatives

The Trust works to ensure the temple runs smoothly while maintaining the spiritual traditions and serving devotees effectively.

**Contact:**
For matters requiring Trust attention, please contact the temple office during working hours.`,
    "ದೇವಸ್ಥಾನ ಟ್ರಸ್ಟಿನ ಬಗ್ಗೆ",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠವನ್ನು ಅನುಭವಿ ಭಕ್ತರು ಮತ್ತು ಟ್ರಸ್ಟಿಗಳನ್ನೊಳಗೊಂಡ ಸಮರ್ಪಿತ ಟ್ರಸ್ಟ್ ಸಮಿತಿಯಿಂದ ನಿರ್ವಹಿಸಲಾಗುತ್ತದೆ.

**ಟ್ರಸ್ಟ್ ಜವಾಬ್ದಾರಿಗಳು:**
- ದೇವಸ್ಥಾನ ಆಡಳಿತ ಮತ್ತು ನಿರ್ವಹಣೆ
- ಹಣಕಾಸು ಮೇಲುಸಕ್ತಿ
- ಕಾರ್ಯಕ್ರಮ ಯೋಜನೆ ಮತ್ತು ನಿರ್ವಹಣೆ`
  ),

  createArticle(
    "Community Services",
    "general",
    ["service", "community", "welfare", "charity", "social"],
    `Sri Raghavendra Swamy Matha is committed to serving the community through various welfare activities.

**Community Services:**

1. **Annadanam:** Free food distribution during festivals and special occasions.

2. **Spiritual Education:** Free classes on Sanskrit, Bhajans, and religious texts.

3. **Healthcare Support:** Occasional health camps and assistance programs.

4. **Educational Scholarships:** Support for deserving students from economically weaker sections.

5. **Disaster Relief:** Aid during natural calamities.

6. **Senior Citizen Support:** Special services for elderly devotees.

These activities reflect the teachings of Sri Raghavendra Swamy, who emphasized service to humanity as service to God.

For information about participating in or contributing to these services, please contact the temple office.`,
    "ಸಮುದಾಯ ಸೇವೆಗಳು",
    `ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠವು ವಿವಿಧ ಕಲ್ಯಾಣ ಚಟುವಟಿಕೆಗಳ ಮೂಲಕ ಸಮುದಾಯಕ್ಕೆ ಸೇವೆ ಸಲ್ಲಿಸಲು ಬದ್ಧವಾಗಿದೆ.

**ಸಮುದಾಯ ಸೇವೆಗಳು:**

೧. **ಅನ್ನದಾನಮ್:** ಉತ್ಸವಗಳು ಮತ್ತು ವಿಶೇಷ ಸಂದರ್ಭಗಳಲ್ಲಿ ಉಚಿತ ಆಹಾರ ವಿತರಣೆ.

೨. **ಆಧ್ಯಾತ್ಮಿಕ ಶಿಕ್ಷಣ:** ಸಂಸ್ಕೃತ, ಭಜನೆ ಮತ್ತು ಧಾರ್ಮಿಕ ಗ್ರಂಥಗಳ ಉಚಿತ ತರಗತಿಗಳು.

೩. **ಆರೋಗ್ಯ ನೆರವು:** ಕೆಲವೊಮ್ಮೆ ಆರೋಗ್ಯ ಶಿಬಿರಗಳು ಮತ್ತು ನೆರವಿನ ಕಾರ್ಯಕ್ರಮಗಳು.`
  ),
];

/**
 * Convert seed articles to Firestore format
 */
export function getSeedArticlesForFirebase(): Array<Omit<KnowledgeArticle, "id">> {
  return SEED_ARTICLES.map((article) => ({
    ...article,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}
