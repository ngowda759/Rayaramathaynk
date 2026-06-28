import { Timestamp } from "firebase/firestore";

export type UserRole =
  | "super_admin"
  | "temple_admin"
  | "priest"
  | "staff"
  | "volunteer"
  | "devotee"
  | "Super Admin"
  | "Temple Admin"
  | "Priest"
  | "Office Staff"
  | "Volunteer";

export interface UserProfile {
  uid: string;

  name: string;

  email: string;

  phone: string;

  role: UserRole;

  templeId: string;

  profileImage: string;

  isApproved: boolean;

  isActive: boolean;

  emailVerified: boolean;

  lastLogin: Timestamp | null;

  createdAt: Timestamp;

  updatedAt: Timestamp;
}

export interface TempleUser {
  id: string;

  name: string;

  email: string;

  phone: string;

  role: UserRole;

  active: boolean;

  isActive: boolean;

  createdAt: Timestamp;

  updatedAt: Timestamp;
}

export type TempleUserCreate = Pick<TempleUser, "name" | "email" | "phone" | "role" | "active">;
export type TempleUserUpdate = Partial<TempleUserCreate>;
