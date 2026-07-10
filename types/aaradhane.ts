export interface Aaradhane {
  id: string;
  title: string;
  guruName: string;
  dates: string[]; // Multiple dates for the aaradhane
  description: string;
  significance: string;
  rituals: string[];
  offerings: string[];
  imageUrl: string; // JPG image URL
  sevaDetails: AaradhaneSeva[]; // List of seva details
  isUpcoming: boolean;
  displayOrder: number;
  createdAt: string;
  createdBy: string;
}

export interface AaradhaneSeva {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface AaradhaneStats {
  total: number;
  upcoming: number;
  past: number;
}
