// Testimonials Service for managing testimonials data
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

// Get all approved testimonials
export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  if (!db) {
    console.warn("Firebase not configured, returning empty array");
    return [];
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
    return [];
  }
}

// Get all testimonials (for admin)
export async function getAllTestimonials(): Promise<Testimonial[]> {
  if (!db) {
    console.warn("Firebase not configured, returning empty array");
    return [];
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
    return [];
  }
}

// Get single testimonial by ID
export async function getTestimonial(id: string): Promise<Testimonial | null> {
  if (!db) {
    console.warn("Firebase not configured");
    return null;
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
  if (!db) throw new Error("Firebase not configured");

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
  if (!db) throw new Error("Firebase not configured");

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
  if (!db) throw new Error("Firebase not configured");

  await deleteDoc(doc(db, TESTIMONIALS_COLLECTION, id));
}

// Submit testimonial (for public submissions)
export async function submitTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt">
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

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
