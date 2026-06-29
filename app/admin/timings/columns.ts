import { CrudColumn } from "@/types/crud";
import { TempleTiming } from "@/types/timing";

export const timingColumns: CrudColumn<TempleTiming>[] = [
  {
    key: "title",
    header: "Title",
    sortable: true,
  },
  {
    key: "startTime",
    header: "Start",
    sortable: true,
  },
  {
    key: "endTime",
    header: "End",
    sortable: true,
  },
  {
    key: "order",
    header: "Order",
    type: "number",
    sortable: true,
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
