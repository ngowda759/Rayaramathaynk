export interface Aaradhane {
  id: string;
  title: string;
  guruName: string;
  date: string;
  description: string;
  significance: string;
  rituals: string[];
  offerings: string[];
  isUpcoming: boolean;
  displayOrder: number;
  createdAt: string;
  createdBy: string;
}

export interface AaradhaneStats {
  total: number;
  upcoming: number;
  past: number;
}
