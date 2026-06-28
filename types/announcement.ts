export interface Announcement {
  id: string;
  title: string;
  message: string;
  link?: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}
