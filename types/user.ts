import { Timestamp } from "firebase/firestore";

export type UserRole =
  | "Super Admin"
  | "Temple Admin"
  | "Priest"
  | "Office Staff"
  | "Volunteer";

export interface TempleUser {
  id?: string;

  name: string;

  email: string;

  phone?: string;

  role: UserRole;

  active: boolean;

  createdAt?: Timestamp;

  updatedAt?: Timestamp;
}
