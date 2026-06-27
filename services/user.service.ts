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
import { TempleUser } from "@/types/user";

const COLLECTION = "users";

class UserService {
  async getUsers(): Promise<TempleUser[]> {
    const snapshot = await getDocs(collection(db, COLLECTION));

    return snapshot.docs.map((d) => {
      const data = d.data();

      return {
        id: d.id,
        name: data.name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        role: data.role ?? "Volunteer",
        active: data.active ?? true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
  }

  async getUser(id: string): Promise<TempleUser | null> {
    const snap = await getDoc(doc(db, COLLECTION, id));

    if (!snap.exists()) return null;

    const data = snap.data();

    return {
      id: snap.id,
      name: data.name ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      role: data.role ?? "Volunteer",
      active: data.active ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async addUser(user: TempleUser) {
    return addDoc(collection(db, COLLECTION), {
      ...user,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async updateUser(
    id: string,
    user: Partial<TempleUser>
  ) {
    return updateDoc(doc(db, COLLECTION, id), {
      ...user,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteUser(id: string) {
    return deleteDoc(doc(db, COLLECTION, id));
  }
}

export const userService = new UserService();
