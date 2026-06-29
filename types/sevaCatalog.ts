export interface Seva {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: string;
  description: string;
  status: "active" | "inactive";
  createdAt?: Date;
  updatedAt?: Date;
}
