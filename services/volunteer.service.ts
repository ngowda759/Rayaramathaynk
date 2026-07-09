import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Member, MemberRequest, Volunteer, VolunteerRequest } from "@/types/volunteer";

const MEMBERS_COLLECTION = "members";
const VOLUNTEERS_COLLECTION = "volunteers";

// Member helpers
function docToMember(docSnap: any): Member {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    memberId: data.memberId || "",
    name: data.name || "",
    phone: data.phone || "",
    sex: data.sex || "Male",
    active: data.active ?? true,
    address: data.address || "",
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || new Date().toISOString(),
  };
}

// Volunteer helpers
function docToVolunteer(docSnap: any): Volunteer {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    volunteerId: data.volunteerId || "",
    name: data.name || "",
    phone: data.phone || "",
    sex: data.sex || "Male",
    active: data.active ?? true,
    address: data.address || "",
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt || new Date().toISOString(),
  };
}

export const memberService = {
  async getAllMembers(): Promise<Member[]> {
    const q = query(collection(db, MEMBERS_COLLECTION), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToMember);
  },

  async getMemberById(id: string): Promise<Member | null> {
    const docRef = doc(db, MEMBERS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docToMember(docSnap);
  },

  async createMember(data: MemberRequest): Promise<string> {
    const docRef = await addDoc(collection(db, MEMBERS_COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateMember(id: string, data: Partial<MemberRequest>): Promise<void> {
    const docRef = doc(db, MEMBERS_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteMember(id: string): Promise<void> {
    const docRef = doc(db, MEMBERS_COLLECTION, id);
    await deleteDoc(docRef);
  },
};

export const volunteerService = {
  async getAllVolunteers(): Promise<Volunteer[]> {
    const q = query(collection(db, VOLUNTEERS_COLLECTION), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToVolunteer);
  },

  async getVolunteerById(id: string): Promise<Volunteer | null> {
    const docRef = doc(db, VOLUNTEERS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docToVolunteer(docSnap);
  },

  async createVolunteer(data: VolunteerRequest): Promise<string> {
    const docRef = await addDoc(collection(db, VOLUNTEERS_COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateVolunteer(id: string, data: Partial<VolunteerRequest>): Promise<void> {
    const docRef = doc(db, VOLUNTEERS_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteVolunteer(id: string): Promise<void> {
    const docRef = doc(db, VOLUNTEERS_COLLECTION, id);
    await deleteDoc(docRef);
  },
};
