import { Timestamp } from "firebase/firestore";

export type UserRole =
  | "super_admin"
  | "temple_admin"
  | "priest"
  | "staff"
  | "volunteer"
  | "devotee"
  | "billing"
  | "Billing"
  | "Super Admin"
  | "Temple Admin"
  | "Priest"
  | "Office Staff"
  | "Volunteer";

// Normalized roles for consistent access control
export type NormalizedRole = "super_admin" | "admin" | "billing" | "volunteer" | "devotee";

export function normalizeRole(role: UserRole): NormalizedRole {
  const roleLower = role.toLowerCase().replace(/\s+/g, "_");
  
  switch (roleLower) {
    case "super_admin":
    case "super admin":
      return "super_admin";
    case "billing":
      return "billing";
    case "temple_admin":
    case "temple admin":
    case "admin":
    case "priest":
    case "staff":
    case "office_staff":
    case "office staff":
      return "admin";
    case "volunteer":
      return "volunteer";
    case "devotee":
    default:
      return "devotee";
  }
}

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
