export interface Shloka {
  id: string;
  title: string;
  titleKannada: string;
  author?: string;
  authorKannada?: string;
  category: string;
  verses: string[];
  meaning?: string;
}

export const shlokas: Shloka[] = [
  {
    id: "nitya-parayana",
    title: "Nitya Parayana Shloka",
    titleKannada: "ನಿತ್ಯ ಪಾರಾಯಣ ಶ್ಲೋಕ",
    category: "Daily Prayers",
    verses: [
      "ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ |",
      "ತೇಜಸ್ವಿನಾವಧೀತಮಸ್ತು ಮಾ ವಿದ್ವಿಷಾವಹೈ | ಓಂ ಶಾಂತಿಃ ಶಾಂತಿಃ ಶಾಂತಿಃ |",
      "ಓಮ್ | ಸಹಸ್ರಶೀರ್ಷಂ ದೇವಂ ವಿಶ್ವಾಕ್ಷಂ ವಿಶ್ವವಿದೇವತಾಮ್ |",
      "ವಿಶ್ವಾನಿ ತತ್ರ ವಿದ್ಯಾತೇ ಸರ್ವಭೂತಾನಿ ಸಂಪ್ರಭತಿ |",
      "ಪ್ರಭಾತ ಶ್ಲೋಕ:",
      "ಕರಾಗ್ರೇ ವಸತೇ ಲಕ್ಷ್ಮೀಃ ಕರಮಧ್ಯೇ ಸರಸ್ವತೀ |",
      "ಕರಮೂಲೇ ಸ್ಥಿತಾ ಗೌರೀ ಪ್ರಭಾತೇ ಕರದರ್ಶನಮ್ |",
      "ಪ್ರಭಾತ ಭೂಮಿ ಶ್ಲೋಕ:",
      "ಸಮುದ್ರ ವಸನೇ ದೇವೀ ಪರ್ವತ ಸ್ತನ ಮಂಡಲೇ |",
      "ವಿಷ್ಣುಪತ್ನಿ ನಮಸ್ತೇ ಪಾಂಡರಾಂಗನಾ ಸಂಸ್ಥಿತಾ |"
    ],
    meaning: "These shlokas are part of the daily prayers (Nitya Parayana) recited by devotees."
  },
  {
    id: "raghavendra-ashtottara",
    title: "Raghavendra Ashtottara Sata Namavali",
    titleKannada: "ರಾಘವೇಂದ್ರ ಅಷ್ಟೋತ್ತರ ಶತ ನಾಮಾವಳಿ",
    category: "Sri Raghavendra Swamy",
    verses: [
      "ಓಂ ವಿಶ್ವೇಶ್ವರಾಯ ನಮಃ | ಓಂ ವಿದ್ಯಾಧರಾಯ ನಮಃ | ಓಂ ವಿಕುಂಠಾಯ ನಮಃ |",
      "ಓಂ ವಿಜಯಿನ್ದ್ರಾಯ ನಮಃ | ಓಂ ವಿಜ್ಞಾನಿನೇ ನಮಃ | ಓಂ ವಿಮಲಾನಂದಾಯ ನಮಃ |",
      "ಓಂ ವಿಶಾಲಾಯ ನಮಃ | ಓಂ ವಿಕಾಸಿನೇ ನಮಃ | ಓಂ ವಿರಕ್ತಾಯ ನಮಃ |",
      "ಓಂ ವಿಭವಾನಿನೇ ನಮಃ | ಓಂ ವಿದಾರಿಣೇ ನಮಃ | ಓಂ ವಿಮುಕ್ತಾಯ ನಮಃ |"
    ],
    meaning: "This is a devotional hymn consisting of 108 names of Sri Raghavendra Swamy."
  },
  {
    id: "raghavendra-mangalashtakam",
    title: "Sri Raghavendra Mangalashtakam",
    titleKannada: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಮಂಗಳಾಷ್ಟಕಂ",
    author: "ಶ್ರೀ ವಾದಿರಾಜತೀರ್ಥರು",
    authorKannada: "Sri Vadirajatirtharu",
    category: "Sri Raghavendra Swamy",
    verses: [
      "ಶ್ರೀಮದ್ರಾಮಪಾದಾರವಿಂದಮಧುಪಃ ಶ್ರೀಮಧ್ವವಂಶಾಧಿಪಃ |",
      "ಸಚ್ಚಿಷ್ಯೋಡುಗಣೋಡುಪಃ ಶ್ರಿತಜಗದ್ಗೀರ್ವಾಣಸತ್ಪಾದಪಃ |",
      "ಅತ್ಯರ್ಥಂ ಮನಸಾ ಕೃತಾಚ್ಯುತಜಪಃ ಪಾಪಾಂಧಕಾರಾತಪಃ |",
      "ಶ್ರೀಮತ್ಸದ್ಗುರುರಾಘವೇಂದ್ರಯತಿರಾಟ ಕುರ್ಯಾದಮಸ್ಮಯಮ್ |"
    ],
    meaning: "This stotram is composed by Sri Vadirajatirtharu praising Sri Raghavendra Swamy."
  },
  {
    id: "raghavendra-stotra",
    title: "Sri Raghavendra Stotra",
    titleKannada: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ತೋತ್ರ",
    author: "ಅಪ್ಪಣಾಚಾರ್ಯ ವಿರಚಿತ",
    authorKannada: "Appannacharya Virachita",
    category: "Sri Raghavendra Swamy",
    verses: [
      "ಶ್ರೀಪೂರ್ಣಬೋಧ-ಗುರು-ತೀರ್ಥ-ಪಯೋಽಬ್ಧಿ-ಪಾರಾ",
      "ಕಾಮಾರಿ-ಮಾಽಕ್ಷ-ವಿಷಮಾಕ್ಷ-ಶಿರಃ ಸ್ಪೃಶಂತೀ |",
      "ಪೂರ್ವೋತ್ತರಾಮಿತ-ತರಂಗ-ಚರತ್-ಸು-ಹಂಸಾ",
      "ದೇವಾಲಿ-ಸೇವಿತ-ಪರಾಂಘ್ರಿ-ಪಯೋಜ-ಲಗ್ನಾ || ೧ ||"
    ],
    meaning: "This stotra is composed by Appannacharya, a great devotee of Sri Raghavendra Swamy."
  },
  {
    id: "venkateswara-stotram",
    title: "Sri Venkateswara Stotram",
    titleKannada: "ಶ್ರೀವೇಂಕಟೇಶ ಸ್ತೋತ್ರಮ್",
    category: "Venkateswara",
    verses: [
      "ವೇಂಕಟೇಶೋ ವಾಸುದೇವಃ ಪ್ರದ್ಯುಮ್ನೋಽಮಿತವಿಕ್ರಮಃ |",
      "ಸಂಕರ್ಷಣೋಽನಿರುದ್ಧಶ್ಚ ಶೇಷಾದ್ರಿಪತಿರೇವ ಚ || ೧ ||",
      "ಜನಾರ್ದನಃ ಪದ್ಮನಾಭೋ ವೇಂಕಟಾಚಲವಾಸಕಃ |",
      "ಸೃಷ್ಟಿಕರ್ತಾ ಜಗನ್ನಾಥೋ ಮಾಧವೋ ಭಕ್ತವತ್ಸಲಃ || ೨ ||"
    ],
    meaning: "A devotional hymn dedicated to Lord Venkateswara (Lord Balaji/Tirumala).",
  },
  {
    id: "vishnu-sahasranama",
    title: "Sri Vishnu Sahasranamastotram",
    titleKannada: "ಶ್ರೀ ವಿಷ್ಣುಸಹಸ್ರನಾಮಸ್ತೋತ್ರಮ್",
    category: "Vishnu",
    verses: [
      "ವೈಶಂಪಾಯನ ಉವಾಚ –",
      "ಶ್ರುತ್ವಾ ಧರ್ಮಾನಶೇಷೇಣ ಪಾವನಾನಿ ಚ ಸರ್ವಶಃ |",
      "ಯುಧಿಷ್ಠಿರಃ ಶಾಂತನವಂ ಪುನರೇವಾಭ್ಯಭಾಷತ || ೧ ||",
      "ಯುಧಿಷ್ಠಿರ ಉವಾಚ –",
      "ಕಿಮೇಕಂ ದೈವತಂ ಲೋಕೇ ಕಿಂ ವಾಽಪ್ಯೇಕಂ ಪರಾಯಣಮ್ |",
      "ಸ್ತುವಂತಃ ಕಂ ಕಮರ್ಚಂತಿ ಕೋ ವಾ ಪರಮೋ ದ್ವಿಜಃ || ೨ ||"
    ],
    meaning: "The Vishnu Sahasranama is a hymn consisting of 1000 names of Lord Vishnu. It is one of the most sacred and powerful texts in Hindu tradition.",
  },
  {
    id: "vayustuti",
    title: "Vayustuti",
    titleKannada: "ವಾಯುಸ್ತುತಿಃ",
    author: "ಶ್ರೀಮದಾನಂದತೀರ್ಥಭಗವತ್ಪಾದವಿರಚಿತಾ",
    authorKannada: "Sri Madhv Anand Tirtha",
    category: "Madhva Tradition",
    verses: [
      "ಓಂ ಪಾಂತ್ವಸ್ಮಾನ್ ಪುರಹೂತ-ವೈರಿ-ಬಲವನ್ ಮಾತಂಗ-ಮಾದ್ಯದ್-ಘಟಾ-",
      "ಕುಂಭೋಚ್ಚಾದ್ರಿ-ವಿಪಾಟನಾಧಿಕ-ಪಟು ಪ್ರತ್ಯೇಕ-ವಜ್ರಾಯಿತಾಃ |",
      "ಶ್ರೀಮತ್-ಕಂಠೀರವಾಸ್ಯ ಪ್ರತತ-ಪಾದ-ಸರಸಿ-ಜಲಾಧಿಕಾ-",
      "ವಿಪುಲಂ ವಿದುರಂ ತಿಷ್ಠಾದೃಷ್ಟಂ ನ ತಥಾ ವಯೋಃ || ೧ ||"
    ],
    meaning: "Vayustuti is a hymn praising Lord Vayu (wind god) composed by Madhv Anand Tirtha.",
  },
  {
    id: "laghu-sivastuti",
    title: "Laghu Siva Stuti",
    titleKannada: "ಲಘುಶಿವಸ್ತುತಿಃ",
    category: "Siva",
    verses: [
      "ಲಲಿತಚಂದ್ರನಿಭಾನನಸುಸ್ಮಿತಂ ಶುದ್ಧಚಂದ್ರಕಲಾಧರಂ",
      "ಚಂದ್ರಾಂಶುಕಲಾಕಲಂ ಚ ಚಂದ್ರಾರುಹಿತಂ ಸರ್ವಕಾಲಂ",
      "ಸಚ್ಚಿದಂಬರಾಲಯನಂ ಸಕಲಂ ಸಕಲೀಂದ್ರಿಯಂ ಪರಂ",
      "ತತ್ರಾಕೃತಿಂ ಯದಿತಿ ತದ್ವಿನೋ ವಿನಿಮಿತ್ತ ತತ್ರ ವಾ || ೧ ||"
    ],
    meaning: "Laghu Siva Stuti is a brief hymn praising Lord Shiva.",
  },
  {
    id: "dvadasa-stotram",
    title: "Dvadasa Stotram",
    titleKannada: "ದ್ವಾದಶ ಸ್ತೋತ್ರಮ್",
    category: "Venkateswara",
    verses: [
      "ವಂದೇ ವಂದ್ಯಂ ಸದಾನಂದಂ ವಾಸುದೇವಂ ನಿರಂಜನಮ್ |",
      "ಇಂದಿರಾಪತಿಮಾದ್ಯಾದಿ-ವರದೇಶ-ವರಪ್ರದಮ್ || ೧ ||",
      "ನಮಾಮಿ ನಿಖಿಲಾಧೀಶ-ಕಿರೀಟಾಘೃಷ್ಟಪೀಠವತ್ |",
      "ಹೃತ್ತಮಃಶಮನೆಽರ್ಕಾಭಂ ಶ್ರೀಪತೇಃ ಪಾದಪಂಕಜಮ್ || ೨ ||"
    ],
    meaning: "Dvadasa Stotram is a hymn dedicated to Lord Venkateswara with 12 verses.",
  },
  {
    id: "rama-panchakam",
    title: "Sri Rama Panchakam",
    titleKannada: "ಶ್ರೀರಾಮಪಂಚಕಮ್",
    author: "ಶ್ರೀವಾದಿರಾಜತೀರ್ಥರು",
    authorKannada: "Sri Vadirajatirtharu",
    category: "Rama",
    verses: [
      "ಪ್ರಾತಃ ಸ್ಮರಾಮಿ ರಘುನಾಥಪದಾರವಿಂದಂ",
      "ಮಂದಸ್ಮಿತಂ ಮಧುರಭಾಷವಿಶಾಲಫಾಲಮ್ |",
      "ಕರ್ಣಾವಲಂಬಿಚಲಕುಂಡಲಲೋಲಗಂಡಂ",
      "ಕರ್ಣಾಂತದೀರ್ಘನಯನಂ ನಯನಾಭಿರಾಮಮ್ || ೧ ||"
    ],
    meaning: "Sri Rama Panchakam is composed by Vadirajatirtharu with 5 verses praising Lord Rama.",
  },
  {
    id: "krishna-ashtakam",
    title: "Sri Krishna Ashtakam",
    titleKannada: "ಶ್ರೀ ಕೃಷ್ಣಾಷ್ಟಕಮ್",
    author: "ಶ್ರೀ ವಾದಿರಾಜಯತಿ ವಿರಚಿತ",
    authorKannada: "Sri Vadirajatya Virachita",
    category: "Krishna",
    verses: [
      "ಕಾಮಂದನಮ್ ಕಲಿತಾಂಗಂ ಲಲಿತಂ ವಂಶಿಮಾಲಯಮ್ |",
      "ಗೋಪಿಕಾಂತಂ ಗೋವಿಂದಂ ಸರಸಿಜಂಗಂ ಸುಧಾರಸಮ್ |",
      "ಸರ್ವಮಂಗಲಂ ಕಳಿತಂ ವಿಳಸತ್ಕಣ್ಠಿ ಚಂದ್ರಕಮ್ |",
      "ಚಂದ್ರಮೌಲಿಂ ಚಂದ್ರಲೀಲಂ ಚಂದ್ರಭಾಗಂ ನಮಸ್ತಿ || ೧ ||"
    ],
    meaning: "Sri Krishna Ashtakam is an 8-verse hymn praising Lord Krishna composed by Vadirajatya.",
  },
  {
    id: "nrsimha-rinamochana",
    title: "Sri Nrsimha Rinamochana Stotram",
    titleKannada: "ಶ್ರೀ ನರಸಿಂಹಪುರಾಣೋಕ್ತ ಋಣಮೋಚನ ಸ್ತೋತ್ರಮ್",
    author: "ಶ್ರೀ ವಾದಿರಾಜತೀರ್ಥದೃಷ್ಟಮ್",
    authorKannada: "Sri Vadirajatirtha Drishtam",
    category: "Nrsimha",
    verses: [
      "ದೇವತಾಕಾರ್ಯಸಿದ್ಧ್ಯರ್ಥಂ ಸಭಾಸ್ತಂಭಸಮುದ್ಭವಮ್ |",
      "ಶ್ರಿನೃಸಿಂಹ ಮಹಾವೀರಂ ನಮಾಮಿ ಋಣಮುಕ್ತಯೇ || ೧ ||",
      "ಲಕ್ಷ್ಮ್ಯಾಽಽಲಿಂಗಿತವಾಮಾಂಗಂ ಭಕ್ತಾನಾಂ ವರದಾಯಕಮ್ |",
      "ನಿರ್ವಿಘ್ನಂ ಕರುಣಾಸಿಂಹಂ ತಂ ನಮಾಮಿ ಹರಿಂದಮಮ್ || ೨ ||"
    ],
    meaning: "This stotram from Nrsimha Purana was seen/revealed by Vadirajatirtha for liberation from debts."
  },
  {
    id: "nrsimha-stuti-shani",
    title: "Sri Nrsimha Stuti by Lord Shani",
    titleKannada: "ಶ್ರೀ ಶನೈಶ್ಚರ ಕೃತ ಶ್ರೀ ನೃಸಿಂಹ ಸ್ತುತಿಃ",
    category: "Nrsimha",
    verses: [
      "ಸುಲಭೋ ಭಕ್ತಿಯುಕ್ತಾನಾಂ ದುರ್ದರ್ಶೋ ದುಷ್ಟ ಚೀತಸಾಂ |",
      "ಅನನ್ಯ ಗತಿಕಾನಾಂ ಚ ಪ್ರಭು ಭಕ್ತೈ ಕವತ್ಸಲ |",
      "ಶನೈಶ್ವರ ತತ್ರ ನೃಸಿಂಹ ದೇವ ಚಕಾರಾಮಲಚಿತ್ತವೃತ್ತಿ |",
      "ಪ್ರಣಮ್ಯ ಸಾಷ್ಟಾಂಗಮಶೇಷ ಲೋಕ ಸಂಸ್ಥಾಪಯಾಮಿ ತಮ್ || ೧ ||"
    ],
    meaning: "This is a hymn praising Lord Nrsimha, believed to have been composed by Lord Shani (Saturn)."
  },
  {
    id: "purusha-sukta",
    title: "Purusha Suktam",
    titleKannada: "ಪುರುಷ ಸೂಕ್ತಂ",
    category: "Vedas",
    verses: [
      "ಓಂ ತಚ್ಛಂ ಯೋರಾವೃಣೀಮಹೇ | ಗಾತುಂ ಯುಜ್ಞಾಯ | ಗಾತುಂ ಯುಜ್ಞಪತಯೇ | ದೈವೀ ಸ್ವಸ್ತಿರಸ್ತು ನಃ |",
      "ಸ್ವಸ್ತಿರ್ಮಾನುಷೇಭ್ಯಃ | ಊರ್ಧ್ವಂ ಜಿಗಾತು ಭೇಷಜಮ್ | ಶಂ ನೋ ಅಸ್ತು ದ್ವಿಪದೇ | ಶಂ ಚತುಷ್ಪದೇ |"
    ],
    meaning: "Purusha Suktam is a hymn from the Rig Veda describing the cosmic Purusha (the supreme being).",
  },
  {
    id: "narayana-sukta",
    title: "Narayana Suktam",
    titleKannada: "ನಾರಾಯಣ ಸೂಕ್ತ",
    category: "Vedas",
    verses: [
      "ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ |",
      "ತೇಜಸ್ವಿನಾ ವಿಧೀತಮಸ್ತು ಮಾ ವಿದ್ವಿಷಾವಹೈ | ಓಂ ಶಾಂತಿಃ ಶಾಂತಿಃ ಶಾಂತಿಃ |"
    ],
    meaning: "Narayana Suktam is a Vedic hymn dedicated to Lord Narayana."
  },
  {
    id: "manyu-sukta",
    title: "Manyu Suktam",
    titleKannada: "ಮನ್ಯು ಸೂಕ್ತಂ",
    category: "Vedas",
    verses: [
      "ಅಥ ಮನ್ಯುಸೂಕ್ತಂ | ಋಗ್ವೇದ ಸಂಹಿತಾಯಾಮ್ |",
      "ಮನ್ಯುರ್ವಿಭೀಮೋ ಭೀಮನಾದೋ ಭಯಂಕರೋ ವಿಶ್ವರೂಪಃ |",
      "ದುರ್ಗಾಣಿ ತರ್ವ ಸಂಗಮ್ಯ ದುರ್ಗಾಣಿ ಜಯಂತಿ ಸರ್ವಾ |"
    ],
    meaning: "Manyu Suktam is a Vedic hymn dedicated to Lord Manyu (a form of Lord Shiva/ Rudra)."
  }
];

export const shlokaCategories = [
  "All",
  "Daily Prayers",
  "Sri Raghavendra Swamy",
  "Venkateswara",
  "Vishnu",
  "Madhva Tradition",
  "Siva",
  "Rama",
  "Krishna",
  "Nrsimha",
  "Vedas"
];
