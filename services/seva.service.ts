import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Seva, SevaRequest } from "@/types/seva";
import { getAllSevasAction, getSevaByIdAction } from "@/app/actions/sevas";

const COLLECTION = "sevas";

/** Visibilities the public site offers (DB §17.1, C-38); `counter` sevas are sold only at the temple counter. */
const ONLINE_VISIBILITY: readonly string[] = ["online", "both"];

/**
 * The Firestore fallback reads the public mirror (C-39): a counter-only seva is mirrored as not active, and a legacy
 * document without a visibility predates the field (C-38: existing sevas are offered both ways).
 */
function isOfferedOnline(data: Record<string, unknown> | undefined): boolean {
  if (!data || data.active !== true) return false;
  const visibility = data.visibility;
  return visibility === undefined || (typeof visibility === "string" && ONLINE_VISIBILITY.includes(visibility));
}

class SevaService {
  async getAllSevas(): Promise<Seva[]> {
    try {
      const data = await getAllSevasAction();
      return data.map((item: any) => ({
        id: item.firestore_id,
        name: item.name,
        description: item.description,
        category: item.category,
        amount: Number(item.amount),
        duration: item.duration,
        imageUrl: item.image_url || '',
        active: item.active,
        displayOrder: item.display_order,
        // Map timestamps matching expected string representation.
        // If from Supabase, it returns an ISO string we can pass through or construct.
        createdAt: item.created_at,
        updatedAt: item.updated_at || item.created_at,
      })) as Seva[];
    } catch (error) {
      console.error("[SevaService] Supabase Error:", error);
    }

    // Fallback to Firestore
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, COLLECTION));
      return snapshot.docs
        .filter((doc) => isOfferedOnline(doc.data()))
        .map((doc) => ({ id: doc.id, ...doc.data() })) as Seva[];
    } catch (error) {
      console.error("[SevaService] Error:", error);
      return [];
    }
  }

  async getSevaById(id: string): Promise<Seva | null> {
    try {
      const item = await getSevaByIdAction(id);
      return {
        id: item.firestore_id,
        name: item.name,
        description: item.description,
        category: item.category,
        amount: Number(item.amount),
        duration: item.duration,
        imageUrl: item.image_url || '',
        active: item.active,
        displayOrder: item.display_order,
        createdAt: item.created_at,
        updatedAt: item.updated_at || item.created_at,
      } as Seva;
    } catch (error) {
      console.error("[SevaService] Supabase Error:", error);
    }

    // Fallback to Firestore
    if (!db) return null;
    try {
      const snapshot = await getDoc(doc(db, COLLECTION, id));
      if (!snapshot.exists() || !isOfferedOnline(snapshot.data())) return null;
      return { id: snapshot.id, ...snapshot.data() } as Seva;
    } catch (error) {
      console.error("[SevaService] Error:", error);
      return null;
    }
  }

  async createSeva(data: SevaRequest) {
    if (!db) throw new Error("Firebase not configured");
    return addDoc(collection(db, COLLECTION), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  async updateSeva(id: string, data: Partial<SevaRequest>) {
    if (!db) throw new Error("Firebase not configured");
    return updateDoc(doc(db, COLLECTION, id), { ...data, updatedAt: serverTimestamp() });
  }

  async deleteSeva(id: string) {
    if (!db) throw new Error("Firebase not configured");
    return deleteDoc(doc(db, COLLECTION, id));
  }
}

export const sevaService = new SevaService();
