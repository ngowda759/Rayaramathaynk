export interface Member {
  id: string;
  memberId: string;
  name: string;
  phone: string;
  sex: "Male" | "Female" | "Other";
  active: boolean;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemberRequest {
  memberId: string;
  name: string;
  phone: string;
  sex: "Male" | "Female" | "Other";
  active: boolean;
  address: string;
}

export interface Volunteer {
  id: string;
  volunteerId: string;
  name: string;
  phone: string;
  sex: "Male" | "Female" | "Other";
  active: boolean;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerRequest {
  volunteerId: string;
  name: string;
  phone: string;
  sex: "Male" | "Female" | "Other";
  active: boolean;
  address: string;
}
