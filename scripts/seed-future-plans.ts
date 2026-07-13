import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const futurePlansData = {
  heading: "Future Plans",
  headingKannada: "ಟ್ರಸ್ಟ್ ನ ಮುಂದಿನ ಮಹತ್ವಾಕಾಂಕ್ಷಿ ಯೋಜನೆಗಳು",
  subheading: "Join us in our journey to preserve and propagate the sacred traditions",
  subheadingKannada: "ನಮ್ಮ ಯಾತ್ರೆಯಲ್ಲಿ ಭಾಗಿಯಾಗಿ ಪವಿತ್ರ ಸಂಪ್ರದಾಯಗಳನ್ನು ಸಂರಕ್ಷಿಸಲು ಮತ್ತು ಪ್ರಸರಣ ಮಾಡಲು ನಮಗೆ ಸಹಾಯ ಮಾಡಿ",
  plans: [
    {
      id: "1",
      title: "Modern Building Project",
      titleKannada: "ಅತ್ಯಾಧುನಿಕ ಕಟ್ಟಡ ಯೋಜನೆ",
      description: "Plans to construct a modern 4-story building for the Matha with ample parking, meditation hall, modern kitchen, and a spacious hall that can accommodate at least 450 people. The building will have lifts and other modern amenities. Devotees can participate in this grand project.",
      descriptionKannada: "ಶ್ರೀ ಮಠದ ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ 4 ಮಹಡಿಗಳ ಅತ್ಯಾಧುನಿಕ ಕಟ್ಟಡವನ್ನು ಗುರುರಾಜರಿಗೆ ಸಮರ್ಪಿಸಲು ಸಂಕಲ್ಪಿಸಲಾಗಿದೆ. ಕಟ್ಟಡವು ಆಧುನಿಕ ಪಾರ್ಕಿಂಗ್ ವ್ಯವಸ್ಥೆ, ಧ್ಯಾನ – ಪ್ರವಚನ ಮಂದಿರ, ಆಧುನಿಕ ಅಡಿಗೆ ಮನೆ, ಒಂದು ಮಹಡಿಯಲ್ಲಿ ಕನಿಷ್ಠ 450 ಕುಳಿತುಕೊಳ್ಳಲು ಅನುಕೂಲವಾಗುವಂತೆ ವಿಶಾಲ ಹಾಲ್. ಭಕ್ತರಿಗೆ ಎಲ್ಲಾ ಶುಭ ಕಾರ್ಯಕ್ರಮಗಳನ್ನು ಆಯೋಜಿಸಲು ಅನುಕೂಲವಾಗುವಂತೆ 2 ಸಣ್ಣ ಹಾಲ್. ಕಟ್ಟಡಕ್ಕೆ ಲಿಫ್ಟ್ ಸೌಲಭ್ಯ ಹಾಗೂ ಇನ್ನಿತರ ಆದುನಿಕ ಸೌಲಭ್ಯಗಳನ್ನು ಹೊಂದಿರುತ್ತದೆ. ಈ ಬೃಹತ್ ಯೋಜನೆಯಲ್ಲಿ ನೀವೂ ನಿಮ್ಮ ಯಥಾ ಶಕ್ತಿ ಪಾಲ್ಗೊಳ್ಳಬಹುದು.",
      icon: "building",
      isActive: true,
      order: 1,
    },
    {
      id: "2",
      title: "Knowledge Dissemination Project",
      titleKannada: "ಜ್ಞಾನ ಪ್ರಸಾರ ಯೋಜನೆ",
      description: "Annual knowledge dissemination activities including Madhvacharya philosophy propagation, Purana discussions, and lectures are planned throughout the year. A special endowment fund will be established for this purpose. You can participate in this project by offering a lecture service as your service.",
      descriptionKannada: "ಶ್ರೀ ಮಠದಲ್ಲಿ ವರ್ಷಪೂರ್ತಿ ಜ್ಞಾನ ಪ್ರಸಾರ ಕಾರ್ಯಗಳು, ಮಧ್ವಾಚಾರ್ಯರ ಸಿದ್ಧಾಂತ ಪ್ರಸಾರ, ಪುರಾಣಗಳು, ಉಪನ್ಯಾಸಗಳನ್ನು ವರ್ಷಪೂರ್ತಿ ನಡೆಸಲು ಆಯೋಜಿಸಲಾಗಿದೆ. ಈ ಕಾರ್ಯಕ್ಕೆ ಅನುಕೂಲವಾಗುವಂತೆ ವಿಶೇಷ ದತ್ತಿ ನಿಧಿಯನ್ನು ಸ್ಥಾಪಿಸಲು ಯೋಜಿಸಲಾಗಿದೆ. ಈ ಯೋಜನೆಯಲ್ಲಿ ತಾವೂ ಪಾಲ್ಗೊಳ್ಳಬಹುದು. ಈ ಯೋಜನೆಯಲ್ಲಿ ಒಂದು ಉಪನ್ಯಾಸದ ಸೇವೆಯನ್ನು ತಮ್ಮ ಸೇವೆಯಲ್ಲಿ ನಡೆಸಬಹುದು.",
      icon: "book",
      isActive: true,
      order: 2,
    },
    {
      id: "3",
      title: "Gomata Protection Project",
      titleKannada: "ಗೋ ಸಂರಕ್ಷಣಾ ಯೋಜನೆ",
      description: "Protection of cows is our primary duty. We already maintain a Goshaala with the best breed of cows from Malenadu. We plan to continue Gomata service on a larger scale in the future.",
      descriptionKannada: "ಗೋವಿನ ಸಂರಕ್ಷಣೆಯು ನಮ್ಮ ಆದ್ಯ ಕರ್ತವ್ಯದಲ್ಲಿ ಒಂದಾಗಿದೆ. ವಿಶೇಷವಾಗಿ ಮಲೆನಾಡಿನ ಅತ್ಯುತ್ತಮ ತಳಿಗಳ ಗೋವುಗಳನ್ನು ಸಂರಕ್ಷಿಸುವುದು, ಗೋವಿನ ಸೇವೆಗೆ, ಈಗಾಗಲೇ ನಮ್ಮದೇ ಆದ ಗೋಶಾಲೆ ನಡೆಸುತ್ತಿದ್ದೇವೆ. ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ ಇನ್ನೂ ದೊಡ್ಡ ಮಟ್ಟದಲ್ಲಿ ಗೋಸೇವೆ ಮುಂದುವರಿಸಲು ಸಂಕಲ್ಪಿಸಲಾಗಿದೆ.",
      icon: "heart",
      isActive: true,
      order: 3,
    },
    {
      id: "4",
      title: "Vedic Education",
      titleKannada: "ವೈದಿಕ ಶಿಕ್ಷಣ",
      description: "Vedas will be prepared for teaching Vedic education, mantras, sukthas, deity worship methods to children and elders at the Matha. Mantra Stotra classes have already started and other classes will be started soon. Everyone can avail these facilities free of cost.",
      descriptionKannada: "ಶ್ರೀ ಮಠದಲ್ಲಿ ಮಕ್ಕಳಿಗೆ ಹಾಗೂ ಹಿರಿಯರಿಗೆ ವೈದಿಕ ಶಿಕ್ಷಣ, ಶ್ಲೋಕಗಳು, ಮಂತ್ರಗಳು, ಸೂಕ್ತಗಳು, ದೇವತಾ ಪೂಜಾ ವಿಧಾನಗಳು ಕಲಿಸಲು ವೇದಿಕೆಯನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ. ಮಂತ್ರ ಸ್ತೋತ್ರ ತರಗತಿಗಳು ಈಗಾಗಲೇ ಪ್ರಾರಂಭಾಗಿದ್ದು ಇತರ ತರಗತಿಗಳನ್ನು ಸದ್ಯದಲ್ಲೇ ಪ್ರಾರಂಭಿಸಲು ಯೋಜಿಸಲಾಗಿದೆ. ಎಲ್ಲಾರೂ ಈ ಸೌಲಭ್ಯಗಳನ್ನು ಉಚಿತವಾಗಿ ಪಡೆದುಕೊಳ್ಳಬಹುದು.",
      icon: "graduation",
      isActive: true,
      order: 4,
    },
    {
      id: "5",
      title: "Cultural Education",
      titleKannada: "ಸಾಂಸ್ಕೃತಿಕ ಶಿಕ್ಷಣ",
      description: "Committed to transform the Matha into a social and cultural center of faith, music, Bharatanatyam, Talavadya and other arts will be taught here.",
      descriptionKannada: "ಶ್ರೀ ಮಠವನ್ನು ಸಾಮಾಜಿಕ ಹಾಗೂ ಸಾಂಸ್ಕೃತಿಕ ಶ್ರದ್ದಾ ಕೇಂದ್ರವಾಗಿ ಮಾರ್ಪಡಿಸಲು ಕಟಿಬದ್ಧವಾಗಿದೆ, ಈ ಯೋಜನೆಯಲ್ಲಿ ಸಂಗೀತ, ಭರತನಾಟ್ಯ, ತಾಳವಾದ್ಯ ಮೊದಲಾದ ಕಲೆಗಳನ್ನು ಹೇಳಿಕೊಡಲಾಗುವುದು.",
      icon: "music",
      isActive: true,
      order: 5,
    },
  ],
  updatedAt: new Date().toISOString(),
};

async function seedFuturePlans() {
  if (!db) {
    console.error("Firebase not initialized. Please check your configuration.");
    process.exit(1);
  }

  try {
    const docRef = doc(db, "settings", "futurePlans");
    await setDoc(docRef, futurePlansData);
    console.log("✅ Future Plans seeded successfully!");
    console.log(`   - ${futurePlansData.plans.length} plans added`);
  } catch (error) {
    console.error("❌ Error seeding Future Plans:", error);
    process.exit(1);
  }
}

seedFuturePlans();
