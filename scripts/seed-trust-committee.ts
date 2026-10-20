import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loadServiceAccount } from "./lib/admin-credentials";

const trustCommitteeData = {
  heading: "Trust Committee",
  headingKannada: "ತ್ರಸ್ಟ್ ಸಮಿತಿ",
  subheading: "Meet the team",
  subheadingKannada: "ತೆಂದವನ್ನು ಭೇಟಿಯಾಗಿ",
  members: [
    {
      id: "1",
      name: "Ravikumar N",
      nameKannada: "ರವಿಕುಮಾರ್ ಎನ್",
      role: "Honorary President",
      roleKannada: "ಗೌರವ ಅಧ್ಯಕ್ಷರು",
      imageUrl: "/images/committee/ravikumar-n.png",
      order: 1,
      isActive: true,
      phone: "9448291362",
      address: "No 93, Sri Krishna, 1st Main, Varadaraja Swamy Layout, Vidyaranyapura, Bangalore 560097"
    },
    {
      id: "2",
      name: "Rama Vadiraj",
      nameKannada: "ರಮಾ ವಾದಿರಾಜ್",
      role: "Honorary Vice President",
      roleKannada: "ಗೌರವ ಉಪಾಧ್ಯಕ್ಷರು",
      imageUrl: "/images/committee/rama-vadiraj.png",
      order: 2,
      isActive: true,
      phone: "9964793505",
      address: "C001, Inland Edilon, 1st Main, 4th Phase, Yelahanka New Town, Opposite Prasad Hospital, Bangalore 560064"
    },
    {
      id: "3",
      name: "Bheemasenachar S",
      nameKannada: "ಭೀಮಸೇನಾಚಾರ್ ಎಸ್",
      role: "Honorary Secretary",
      roleKannada: "ಗೌರವ ಕಾರ್ಯದರ್ಶಿ",
      imageUrl: "/images/committee/bheemasenachar-s.png",
      order: 3,
      isActive: true,
      phone: "9481789180",
      address: "No 57, Mythrei Nilaya, 4th Cross, 1st Main, Maruti Nagar, Yelahanka Old Town, Bangalore 560064"
    },
    {
      id: "4",
      name: "Jayatheerth S C",
      nameKannada: "ಜಯತೀರ್ಥ ಎಸ್.ಸಿ.",
      role: "Honorary Joint Secretary",
      roleKannada: "ಗೌರವ ಸಹ ಕಾರ್ಯದರ್ಶಿ",
      imageUrl: "/images/committee/jayatheerth-sc.png",
      order: 4,
      isActive: true,
      phone: "9241712960",
      address: "No 5/A, 6th Cross, Santosh Nagar, Attur Layout, Bangalore 560064"
    },
    {
      id: "5",
      name: "Mohan N K",
      nameKannada: "ಮೋಹನ್ ಎನ್.ಕೆ.",
      role: "Honorary Treasurer",
      roleKannada: "ಗೌರವ ಖಜಾಂಚಿ",
      imageUrl: "/images/committee/mohan-nk.png",
      order: 5,
      isActive: true,
      phone: "9972502993",
      address: "No 2520, 4th B Main, 3rd Phase, Yelahanka New Town, Bangalore 560064"
    },
    {
      id: "6",
      name: "Ravindranath Y K",
      nameKannada: "ರವೀಂದ್ರನಾಥ್ ವೈ.ಕೆ.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/ravindranath-yk.png",
      order: 6,
      isActive: true,
      phone: "9448078930",
      address: "No 1524, Sugappa Layout, Yelahanka, Bangalore 560064"
    },
    {
      id: "7",
      name: "Sudheendra G",
      nameKannada: "ಸುಧೀಂದ್ರ ಜಿ",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/sudheendra-g.png",
      order: 7,
      isActive: true,
      phone: "9900307921",
      address: "No 1-A, Mathru Chaya, 3rd Main, Someshwara Nagara, Yelahanka New Town, Bangalore 560065"
    },
    {
      id: "8",
      name: "Sanjay H S",
      nameKannada: "ಸಂಜಯ್ ಎಚ್.ಎಸ್.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/sanjay-hs.png",
      order: 8,
      isActive: true,
      phone: "9591376736",
      address: "No B-13, MIG-2, KHB Colony, Puttenahally, Yelahanka, Bangalore 560064"
    },
    {
      id: "9",
      name: "Raghavendra M N",
      nameKannada: "ರಾಘವೇಂದ್ರ ಎಂ.ಎನ್.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/raghavendra-mn.png",
      order: 9,
      isActive: true,
      phone: "9844868078",
      address: "No 43, Koustaba, 3rd Main, Maruti Nagar, Yelahanka, Bangalore 560064"
    },
    {
      id: "10",
      name: "Narasimha Prasad K R",
      nameKannada: "ನರಸಿಂಹ ಪ್ರಸಾದ್ ಕೆ.ಆರ್.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/narasimha-prasad-kr.png",
      order: 10,
      isActive: true,
      phone: "9686993178",
      address: "No 2405, LIG, 3rd Stage, Yelahanka New Town, Bangalore 560064"
    },
    {
      id: "11",
      name: "Venkataramana H S",
      nameKannada: "ವೆಂಕಟರಮಣ ಎಚ್.ಎಸ್.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯ",
      imageUrl: "/images/committee/venkataramana-hs.png",
      order: 11,
      isActive: true,
      phone: "9243407855",
      address: "47, Siri Nivasa, 8th Cross, 3rd B Cross, 3rd B Main, Someshwara Nagara, Chikka Bommasandra, Yelahanka New Town, Bengaluru 560064"
    },
    {
      id: "12",
      name: "Vidya G P",
      nameKannada: "ವಿದ್ಯಾ ಜಿ.ಪಿ.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯೆ",
      imageUrl: "/images/committee/vidya-gp.png",
      order: 12,
      isActive: true,
      phone: "9448240756",
      address: "Eshavasya, 1166, 10th B Cross, Yelahanka New Town, Bangalore 560064"
    },
    {
      id: "13",
      name: "Veena N A",
      nameKannada: "ವೀಣಾ ಎನ್.ಎ.",
      role: "Executive Committee Member",
      roleKannada: "ಕಾರ್ಯಕಾರಿ ಸಮಿತಿ ಸದಸ್ಯೆ",
      imageUrl: "/images/committee/veena-na.png",
      order: 13,
      isActive: true,
      phone: "9611242308",
      address: "No 211, 2nd Floor, Madhwa Maanasa, Fusion 4 Pearl Apartment, 7th Cross, Ashwathnarayana Road, Tirumala Nagara, Attur, Yelahanka, Bangalore 560064"
    }
  ],
  updatedAt: new Date().toISOString()
};

async function seedTrustCommittee() {
  const sa = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(sa),
    });
  }

  const db = getFirestore();
  const settingsRef = db.collection("settings").doc("trustCommittee");

  // Check existing data
  console.log("Checking existing trust committee data...");
  const existingDoc = await settingsRef.get();
  if (existingDoc.exists) {
    console.log("Found existing trust committee data. Overwriting...");
  } else {
    console.log("No existing trust committee data found. Creating new...");
  }

  // Add trust committee data
  console.log("\nAdding trust committee data...");
  await settingsRef.set(trustCommitteeData);
  console.log(`Added ${trustCommitteeData.members.length} trust committee members!`);

  console.log("\nSuccessfully seeded trust committee data!");
  process.exit(0);
}

seedTrustCommittee().catch((error) => {
  console.error("Error seeding trust committee:", error);
  process.exit(1);
});
