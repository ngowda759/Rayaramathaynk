export interface Seva {
  id: string;

  name: string;

  description: string;

  category: string;

  amount: number;

  duration: number;

  imageUrl: string;

  active: boolean;

  displayOrder: number;

  createdAt: string;

  updatedAt: string;
}

export interface SevaRequest {
  name: string;
  description: string;
  category: string;
  amount: number;
  duration: number;
  imageUrl: string;
  active: boolean;
  displayOrder: number;
}
