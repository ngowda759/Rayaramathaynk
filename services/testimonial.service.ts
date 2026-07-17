// Testimonials Service for managing testimonials data
// Uses Firestore as the primary source - all data synced across devices
import { Testimonial } from "@/types/homepage";

const TESTIMONIALS_COLLECTION = "testimonials";

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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Default testimonials for when Firestore is empty (English only)
export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "default-1",
    name: "Ramesh Rao",
    location: "Bangalore",
    quote: "The peace I feel at this Matha is indescribable. Every visit brings new spiritual strength and clarity.",
    years: "25 years devotee",
    image: "/testimonials/devotee-1.jpg"
  },
  {
    id: "default-2",
    name: "Lakshmi Devi",
    location: "Mysore",
    quote: "Sri Raghavendra Swamy's blessings have guided my family through the most challenging times. Forever grateful.",
    years: "Family tradition",
    image: "/testimonials/devotee-2.jpg"
  },
  {
    id: "default-3",
    name: "Venkataramana",
    location: "Chennai",
    quote: "The daily poojas and the serene atmosphere create a divine experience. This is where my soul finds rest.",
    years: "15 years devotee",
    image: "/testimonials/devotee-3.jpg"
  },
  {
    id: "default-4",
    name: "Shobha Krishnan",
    location: "Hyderabad",
    quote: "Attending the Bramhotsavam was life-changing. The devotion and rituals are performed with such purity and dedication.",
    years: "Regular visitor",
    image: "/testimonials/devotee-4.jpg"
  },
];

// Get pending testimonials (submitted by public, awaiting approval)
export async function getPendingTestimonials(): Promise<Testimonial[]> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    return [];
  }

  try {
    const { query, collection, where, orderBy, getDocs } = await import("firebase/firestore");
    const q = query(
      collection(firebaseDb, TESTIMONIALS_COLLECTION),
      where("submittedBy", "==", "public"),
      where("approved", "==", false),
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
        phone: data.phone || undefined,
        approved: data.approved ?? false,
        rejected: data.rejected ?? false,
        rejectionReason: data.rejectionReason || undefined,
        submittedBy: data.submittedBy || "public",
        createdAt: data.createdAt,
      } as Testimonial;
    });
  } catch (error) {
    console.error("[Testimonials] Error fetching pending testimonials:", error);
    return [];
  }
}

// Reject testimonial
export async function rejectTestimonial(id: string, reason?: string): Promise<void> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    throw new Error("Firebase is not available. Please try again later.");
  }

  try {
    const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
    
    await updateDoc(doc(firebaseDb, TESTIMONIALS_COLLECTION, id), {
      rejected: true,
      approved: false,
      rejectionReason: reason || "Your testimonial did not meet our guidelines.",
      reviewedAt: serverTimestamp(),
    });
    console.log("[Testimonials] Rejected testimonial:", id);
  } catch (error) {
    console.error("[Testimonials] Error rejecting testimonial:", error);
    throw new Error("Failed to reject testimonial. Please try again.");
  }
}

// Get all approved testimonials (for public display)
export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  const firebaseDb = await getFirebaseDb();
  
  // Return defaults if Firebase not available
  if (!firebaseDb) {
    console.warn("[Testimonials] Firebase not available, using default testimonials");
    return DEFAULT_TESTIMONIALS;
  }

  try {
    const { query, collection, where, orderBy, getDocs } = await import("firebase/firestore");
    const q = query(
      collection(firebaseDb, TESTIMONIALS_COLLECTION),
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    const testimonials = querySnapshot.docs.map((doc: any) => {
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

    // Return Firestore data if available, otherwise defaults
    return testimonials.length > 0 ? testimonials : DEFAULT_TESTIMONIALS;
  } catch (error) {
    console.error("[Testimonials] Error fetching testimonials:", error);
    return DEFAULT_TESTIMONIALS;
  }
}

// Get all testimonials (for admin - includes unapproved)
export async function getAllTestimonials(): Promise<Testimonial[]> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    return DEFAULT_TESTIMONIALS;
  }

  try {
    const { query, collection, orderBy, getDocs } = await import("firebase/firestore");
    const q = query(
      collection(firebaseDb, TESTIMONIALS_COLLECTION),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    
    // If no documents, return defaults
    if (querySnapshot.empty) {
      return DEFAULT_TESTIMONIALS;
    }
    
    return querySnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        location: data.location || "",
        quote: data.quote || "",
        years: data.years || "",
        image: data.image || undefined,
        approved: data.approved ?? false,
        createdAt: data.createdAt,
      } as Testimonial;
    });
  } catch (error) {
    console.error("[Testimonials] Error fetching all testimonials:", error);
    return DEFAULT_TESTIMONIALS;
  }
}

// Get single testimonial by ID
export async function getTestimonial(id: string): Promise<Testimonial | null> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    return DEFAULT_TESTIMONIALS.find((t: Testimonial) => t.id === id) || null;
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
    console.error("[Testimonials] Error fetching testimonial:", error);
    return null;
  }
}

// Create new testimonial
export async function createTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt">
): Promise<string> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    console.error("[Testimonials] Cannot create testimonial: Firebase not available");
    throw new Error("Firebase is not available. Please try again later.");
  }

  try {
    const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    
    const testimonialData = {
      name: testimonial.name,
      location: testimonial.location,
      quote: testimonial.quote,
      years: testimonial.years || "",
      image: testimonial.image || null,
      phone: testimonial.phone || null,
      approved: false, // New testimonials need approval
      rejected: false,
      submittedBy: testimonial.submittedBy || "admin", // Track who submitted
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firebaseDb, TESTIMONIALS_COLLECTION), testimonialData);
    console.log("[Testimonials] Created testimonial with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[Testimonials] Error creating testimonial:", error);
    throw new Error("Failed to create testimonial. Please try again.");
  }
}

// Submit testimonial from public form
export async function submitTestimonial(
  submission: {
    name: string;
    location: string;
    quote: string;
    phone?: string;
    image?: string; // Base64 data URL or file path
  }
): Promise<string> {
  let imageUrl = submission.image;

  // If image is a base64 data URL, upload to Firebase Storage
  if (submission.image && submission.image.startsWith("data:")) {
    try {
      imageUrl = await uploadTestimonialImage(submission.image, submission.name, submission.phone);
    } catch (error) {
      console.error("[Testimonials] Failed to upload image, saving without image:", error);
      imageUrl = undefined; // Save testimonial without image if upload fails
    }
  }

  return createTestimonial({
    name: submission.name,
    location: submission.location,
    quote: submission.quote,
    years: "Devotee",
    image: imageUrl,
    phone: submission.phone,
    submittedBy: "public",
    approved: false,
    rejected: false,
  });
}

// Upload testimonial image to Firebase Storage
async function uploadTestimonialImage(
  base64Data: string,
  name: string,
  phone?: string
): Promise<string> {
  // Dynamic import to avoid SSR issues
  const { storage } = await import("@/lib/firebase");
  
  if (!storage) {
    throw new Error("Firebase Storage is not available");
  }

  // Generate unique filename
  const sanitizedName = name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  const filename = cleanPhone 
    ? `${sanitizedName}_${cleanPhone}.jpg`
    : `${sanitizedName}_${Date.now()}.jpg`;
  
  const filename_with_path = `testimonials/${filename}`;
  
  // Convert base64 to blob
  const response = await fetch(base64Data);
  const blob = await response.blob();
  
  // Upload to Firebase Storage
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const storageRef = ref(storage, filename_with_path);
  
  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
    customMetadata: {
      uploadedBy: "public-form",
      originalName: name,
    },
  });
  
  // Get the download URL
  const downloadURL = await getDownloadURL(storageRef);
  console.log("[Testimonials] Image uploaded to:", downloadURL);
  
  return downloadURL;
}

// Update testimonial
export async function updateTestimonial(
  id: string,
  data: Partial<Omit<Testimonial, "id" | "createdAt">>
): Promise<void> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    console.error("[Testimonials] Cannot update testimonial: Firebase not available");
    throw new Error("Firebase is not available. Please try again later.");
  }

  try {
    const { doc, updateDoc } = await import("firebase/firestore");
    
    const updateData: Record<string, any> = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.quote !== undefined) updateData.quote = data.quote;
    if (data.years !== undefined) updateData.years = data.years;
    if (data.image !== undefined) updateData.image = data.image || null;
    if (data.approved !== undefined) updateData.approved = data.approved;

    await updateDoc(doc(firebaseDb, TESTIMONIALS_COLLECTION, id), updateData);
    console.log("[Testimonials] Updated testimonial:", id);
  } catch (error) {
    console.error("[Testimonials] Error updating testimonial:", error);
    throw new Error("Failed to update testimonial. Please try again.");
  }
}

// Approve testimonial (admin function)
export async function approveTestimonial(id: string): Promise<void> {
  return updateTestimonial(id, { approved: true });
}

// Delete testimonial
export async function deleteTestimonial(id: string): Promise<void> {
  const firebaseDb = await getFirebaseDb();
  
  if (!firebaseDb) {
    console.error("[Testimonials] Cannot delete testimonial: Firebase not available");
    throw new Error("Firebase is not available. Please try again later.");
  }

  try {
    const { doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(firebaseDb, TESTIMONIALS_COLLECTION, id));
    console.log("[Testimonials] Deleted testimonial:", id);
  } catch (error) {
    console.error("[Testimonials] Error deleting testimonial:", error);
    throw new Error("Failed to delete testimonial. Please try again.");
  }
}
