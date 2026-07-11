import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { TempleUser, TempleUserCreate, TempleUserUpdate } from "@/types/user";

const COLLECTION = "users";

class UserService {
  async getUsers(): Promise<TempleUser[]> {
    if (!db) throw new Error("Firebase not configured");
    const snapshot = await getDocs(collection(db, COLLECTION));

    return snapshot.docs.map((d) => {
      const data = d.data();

      const isActive = data.active ?? true;
      return {
        id: d.id,
        name: data.name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        role: data.role ?? "Volunteer",
        active: isActive,
        isActive,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
  }

  async getUser(id: string): Promise<TempleUser | null> {
    if (!db) throw new Error("Firebase not configured");
    const snap = await getDoc(doc(db, COLLECTION, id));

    if (!snap.exists()) return null;

    const data = snap.data();

    const isActive = data.active ?? true;
    return {
      id: snap.id,
      name: data.name ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      role: data.role ?? "Volunteer",
      active: isActive,
      isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async addUser(user: TempleUserCreate) {
    if (!db) throw new Error("Firebase not configured");
    return addDoc(collection(db, COLLECTION), {
      ...user,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateUser(
    id: string,
    user: TempleUserUpdate
  ) {
    if (!db) throw new Error("Firebase not configured");
    return updateDoc(doc(db, COLLECTION, id), {
      ...user,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteUser(id: string) {
    if (!db) throw new Error("Firebase not configured");
    return deleteDoc(doc(db, COLLECTION, id));
  }
}

export const userService = new UserService();
