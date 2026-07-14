// Testimonials Service for managing testimonials data
// Uses localStorage as fallback when Firebase is not configured
import { Testimonial } from "@/types/homepage";

const TESTIMONIALS_COLLECTION = "testimonials";
const LOCAL_STORAGE_KEY = "temple_testimonials";

// Lazy load Firebase to avoid SSR issues
let db: any = null;
let firebaseInitialized = false;

async function getFirebaseDb() {
  if (typeof window === "undefined") return null;
  if (firebaseInitialized) return db;
  
  try {
    const { db: firestoreDb } = await import("@/lib/firebase");
    db = firestoreDb;
    firebaseInitialized = true;
    return db;
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    firebaseInitialized = true;
    return null;
  }
}

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
async function isFirebaseAvailable(): Promise<boolean> {
  const firebaseDb = await getFirebaseDb();
  return firebaseDb !== null && firebaseDb !== undefined;
}

// Get all approved testimonials
export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    return getLocalTestimonials();
  }

  try {
    const { query, collection, orderBy, getDocs } = await import("firebase/firestore");
    const q = query(
      collection(firebaseDb, TESTIMONIALS_COLLECTION),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc: any) => {
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
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    return getLocalTestimonials();
  }

  try {
    const { query, collection, orderBy, getDocs } = await import("firebase/firestore");
    const q = query(
      collection(firebaseDb, TESTIMONIALS_COLLECTION),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc: any) => {
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
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    const testimonials = getLocalTestimonials();
    return testimonials.find((t: Testimonial) => t.id === id) || null;
  }

  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const docSnap = await getDoc(doc(firebaseDb, TESTIMONIALS_COLLECTION, id));
    
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
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    // Use localStorage fallback
    const testimonials = getLocalTestimonials();
    const newTestimonial: Testimonial = {
      id: generateId(),
      name: testimonial.name,
      location: testimonial.location,
      quote: testimonial.quote,
      years: testimonial.years,
      image: testimonial.image,
      createdAt: Date.now(),
    };
    testimonials.unshift(newTestimonial);
    saveLocalTestimonials(testimonials);
    return newTestimonial.id;
  }

  try {
    const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    
    const testimonialData = {
      name: testimonial.name,
      location: testimonial.location,
      quote: testimonial.quote,
      years: testimonial.years,
      image: testimonial.image || null,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firebaseDb, TESTIMONIALS_COLLECTION), testimonialData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating testimonial:", error);
    // Fallback to localStorage
    const testimonials = getLocalTestimonials();
    const newTestimonial: Testimonial = {
      id: generateId(),
      name: testimonial.name,
      location: testimonial.location,
      quote: testimonial.quote,
      years: testimonial.years,
      image: testimonial.image,
      createdAt: Date.now(),
    };
    testimonials.unshift(newTestimonial);
    saveLocalTestimonials(testimonials);
    return newTestimonial.id;
  }
}

// Update testimonial
export async function updateTestimonial(
  id: string,
  data: Partial<Omit<Testimonial, "id" | "createdAt">>
): Promise<void> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    // Use localStorage fallback
    const testimonials = getLocalTestimonials();
    const index = testimonials.findIndex((t: Testimonial) => t.id === id);
    if (index !== -1) {
      testimonials[index] = { ...testimonials[index], ...data };
      saveLocalTestimonials(testimonials);
    }
    return;
  }

  try {
    const { doc, updateDoc } = await import("firebase/firestore");
    
    const updateData: Record<string, any> = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.quote !== undefined) updateData.quote = data.quote;
    if (data.years !== undefined) updateData.years = data.years;
    if (data.image !== undefined) updateData.image = data.image || null;

    await updateDoc(doc(firebaseDb, TESTIMONIALS_COLLECTION, id), updateData);
  } catch (error) {
    console.error("Error updating testimonial:", error);
    // Fallback to localStorage
    const testimonials = getLocalTestimonials();
    const index = testimonials.findIndex((t: Testimonial) => t.id === id);
    if (index !== -1) {
      testimonials[index] = { ...testimonials[index], ...data };
      saveLocalTestimonials(testimonials);
    }
  }
}

// Delete testimonial
export async function deleteTestimonial(id: string): Promise<void> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    // Use localStorage fallback
    const testimonials = getLocalTestimonials();
    const filtered = testimonials.filter((t: Testimonial) => t.id !== id);
    saveLocalTestimonials(filtered);
    return;
  }

  try {
    const { doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(firebaseDb, TESTIMONIALS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    // Fallback to localStorage
    const testimonials = getLocalTestimonials();
    const filtered = testimonials.filter((t: Testimonial) => t.id !== id);
    saveLocalTestimonials(filtered);
  }
}

// Submit testimonial (for public submissions)
export async function submitTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt">
): Promise<string> {
  return createTestimonial(testimonial);
}
