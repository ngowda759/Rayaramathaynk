// Testimonials Service for managing testimonials data
// Uses localStorage as fallback when Firebase is not configured
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Testimonial } from "@/types/homepage";

const TESTIMONIALS_COLLECTION = "testimonials";
const LOCAL_STORAGE_KEY = "temple_testimonials";

// Local storage helper functions
function getLocalTestimonials(): Testimonial[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalTestimonials(testimonials: Testimonial[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(testimonials));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Check if Firebase is available
const useFirebase = (): boolean => {
  return db !== null;
};

// Get all approved testimonials
export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  if (!useFirebase() || !db) {
    return getLocalTestimonials();
  }

  try {
    const q = query(
      collection(db, TESTIMONIALS_COLLECTION),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        location: data.location || "",
        quote: data.quote || "",
        years: data.years || "",
        image: data.image || undefined,
        createdAt: data.createdAt,
      } as Testimonial;
    });
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    return getLocalTestimonials();
  }
}

// Get all testimonials (for admin)
export async function getAllTestimonials(): Promise<Testimonial[]> {
  if (!useFirebase() || !db) {
    return getLocalTestimonials();
  }

  try {
    const q = query(
      collection(db, TESTIMONIALS_COLLECTION),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        location: data.location || "",
        quote: data.quote || "",
        years: data.years || "",
        image: data.image || undefined,
        createdAt: data.createdAt,
      } as Testimonial;
    });
  } catch (error) {
    console.error("Error fetching all testimonials:", error);
    return getLocalTestimonials();
  }
}

// Get single testimonial by ID
export async function getTestimonial(id: string): Promise<Testimonial | null> {
  if (!useFirebase() || !db) {
    const testimonials = getLocalTestimonials();
    return testimonials.find(t => t.id === id) || null;
  }

  try {
    const docSnap = await getDoc(doc(db, TESTIMONIALS_COLLECTION, id));
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name || "",
        location: data.location || "",
        quote: data.quote || "",
        years: data.years || "",
        image: data.image || undefined,
        createdAt: data.createdAt,
      } as Testimonial;
    }
    return null;
  } catch (error) {
    console.error("Error fetching testimonial:", error);
    return null;
  }
}

// Create new testimonial
export async function createTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt">
): Promise<string> {
  if (!useFirebase() || !db) {
    // Use localStorage fallback
    const testimonials = getLocalTestimonials();
    const newTestimonial: Testimonial = {
      ...testimonial,
      id: generateId(),
      createdAt: Date.now(),
    };
    testimonials.unshift(newTestimonial);
    saveLocalTestimonials(testimonials);
    return newTestimonial.id;
  }

  const testimonialData = {
    name: testimonial.name,
    location: testimonial.location,
    quote: testimonial.quote,
    years: testimonial.years,
    image: testimonial.image || null,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, TESTIMONIALS_COLLECTION), testimonialData);
  return docRef.id;
}

// Update testimonial
export async function updateTestimonial(
  id: string,
  data: Partial<Omit<Testimonial, "id" | "createdAt">>
): Promise<void> {
  if (!useFirebase() || !db) {
    // Use localStorage fallback
    const testimonials = getLocalTestimonials();
    const index = testimonials.findIndex(t => t.id === id);
    if (index !== -1) {
      testimonials[index] = { ...testimonials[index], ...data };
      saveLocalTestimonials(testimonials);
    }
    return;
  }

  const updateData: Record<string, any> = {};
  
  if (data.name !== undefined) updateData.name = data.name;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.quote !== undefined) updateData.quote = data.quote;
  if (data.years !== undefined) updateData.years = data.years;
  if (data.image !== undefined) updateData.image = data.image || null;

  await updateDoc(doc(db, TESTIMONIALS_COLLECTION, id), updateData);
}

// Delete testimonial
export async function deleteTestimonial(id: string): Promise<void> {
  if (!useFirebase() || !db) {
    // Use localStorage fallback
    const testimonials = getLocalTestimonials();
    const filtered = testimonials.filter(t => t.id !== id);
    saveLocalTestimonials(filtered);
    return;
  }

  await deleteDoc(doc(db, TESTIMONIALS_COLLECTION, id));
}

// Submit testimonial (for public submissions)
export async function submitTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt">
): Promise<string> {
  return createTestimonial(testimonial);
}
