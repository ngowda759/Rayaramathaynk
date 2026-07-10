import { readdirSync } from "fs";
import { join } from "path";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];

function normalizeFileName(filename: string) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface SevaItem {
  title: string;
  image: string;
  price: string;
  duration: string;
  description: string;
  size: string;
}

const PRICE_OPTIONS = ["₹501", "₹301", "₹1001", "₹801", "₹601"];
const DURATION_OPTIONS = ["45 Minutes", "30 Minutes", "Sponsor", "60 Minutes", "90 Minutes"];

const DEFAULT_SEVAS: SevaItem[] = [
  {
    title: "Pushpalankara",
    image: "/images/Maha Mangalarati.jpg",
    price: "₹501",
    duration: "45 Minutes",
    description: "A special daily pooja seeking the divine blessings of Sri Raghavendra Swamy.",
    size: "row-span-2",
  },
  {
    title: "Panchamrutha Seva",
    image: "/images/panchamruta.jpg",
    price: "₹201",
    duration: "30 Minutes",
    description: "Traditional Panchamrutha Abhisheka performed with devotion and Vedic rituals.",
    size: "",
  },
  {
    title: "Annadana",
    image: "/images/Annadana.jpg",
    price: "₹1001",
    duration: "Sponsor",
    description: "Offer Annadana and receive the blessings of serving devotees.",
    size: "",
  },
];

export function getSevas(): SevaItem[] {
  const dir = join(process.cwd(), "public", "images", "sevas");

  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((file) =>
      IMAGE_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext))
    );
  } catch {
    return DEFAULT_SEVAS;
  }

  const images = files.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );

  if (images.length === 0) {
    return DEFAULT_SEVAS;
  }

  return images.map((file, index) => {
    const title = normalizeFileName(file);
    const price = PRICE_OPTIONS[index % PRICE_OPTIONS.length];
    const duration = DURATION_OPTIONS[index % DURATION_OPTIONS.length];
    const description = `Experience ${title} with devotion to Sri Raghavendra Swamy.`;
    const size = index === 0 ? "row-span-2" : index === 4 ? "col-span-2" : "";

    return {
      title,
      image: `/images/sevas/${file}`,
      price,
      duration,
      description,
      size,
    };
  });
}
