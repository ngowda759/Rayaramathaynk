import { CrudColumn } from "@/types/crud";
import { Member, Volunteer } from "@/types/volunteer";

export const memberColumns: CrudColumn<Member>[] = [
  {
    key: "memberId",
    header: "Member ID",
    type: "text",
    sortable: true,
  },
  {
    key: "name",
    header: "Name",
    type: "text",
    sortable: true,
  },
  {
    key: "phone",
    header: "Phone",
    type: "text",
    sortable: false,
  },
  {
    key: "sex",
    header: "Sex",
    type: "text",
    sortable: true,
  },
  {
    key: "active",
    header: "Active",
    formatter: (value) =>
      value ? "🟢 Yes" : "🔴 No",
  },
  {
    key: "address",
    header: "Address",
    type: "text",
    sortable: false,
  },
  {
    key: "actions",
    header: "Actions",
    type: "actions",
  },
];

export const volunteerColumns: CrudColumn<Volunteer>[] = [
  {
    key: "volunteerId",
    header: "Volunteer ID",
    type: "text",
    sortable: true,
  },
  {
    key: "name",
    header: "Name",
    type: "text",
    sortable: true,
  },
  {
    key: "phone",
    header: "Phone",
    type: "text",
    sortable: false,
  },
  {
    key: "sex",
    header: "Sex",
    type: "text",
    sortable: true,
  },
  {
    key: "active",
    header: "Active",
    formatter: (value) =>
      value ? "🟢 Yes" : "🔴 No",
  },
  {
    key: "address",
    header: "Address",
    type: "text",
    sortable: false,
  },
  {
    key: "actions",
    header: "Actions",
    type: "actions",
  },
];
