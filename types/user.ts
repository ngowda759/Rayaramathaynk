import { Timestamp } from "firebase/firestore";

export type UserRole =
  | "super_admin"
  | "temple_admin"
  | "priest"
  | "accountant"
  | "staff"
  | "volunteer"
  | "devotee";

export interface UserProfile {
  uid: string;

  name: string;

  email: string;

  phone: string;

  role: UserRole;

  templeId: string;

  profileImage?: string;

  isApproved: boolean;

  isActive: boolean;

  emailVerified: boolean;

  lastLogin?: Timestamp;

  createdAt: Timestamp;

  updatedAt: Timestamp;
}
