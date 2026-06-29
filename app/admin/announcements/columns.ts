import { CrudColumn } from "@/types/crud";
import { Announcement } from "@/types/announcement";

export const announcementColumns: CrudColumn<Announcement>[] = [
  {
    key: "title",
    header: "Title",
    sortable: true,
  },
  {
    key: "message",
    header: "Message",
  },
  {
    key: "link",
    header: "Link",
  },
  {
    key: "isActive",
    header: "Status",
    formatter: (value) =>
      value ? "🟢 Active" : "🔴 Inactive",
  },
  {
    key: "actions",
    header: "Actions",
    type: "actions",
  },
];
