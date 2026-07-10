import { CrudColumn } from "@/types/crud";
import { TempleEvent } from "@/types/event";

export const eventColumns: CrudColumn<TempleEvent>[] = [
  {
    key: "title",
    header: "Title",
    type: "text",
  },
  {
    key: "startDate",
    header: "Date",
    type: "date",
  },
  {
    key: "location",
    header: "Location",
    type: "text",
  },
  {
    key: "featured",
    header: "Featured",
    formatter: (value) => (value ? "⭐ Yes" : "No"),
  },
  {
    key: "status",
    header: "Status",
    type: "status",
  },
  {
    key: "actions",
    header: "Actions",
    type: "actions",
  },
];
