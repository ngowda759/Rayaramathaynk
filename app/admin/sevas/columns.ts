import { CrudColumn } from "@/types/crud";
import { Seva } from "@/types/seva";

export const sevaColumns: CrudColumn<Seva>[] = [
  {
    key: "name",
    header: "Seva",
    type: "text",
    sortable: true,
  },
  {
    key: "category",
    header: "Category",
    type: "text",
    sortable: true,
  },
  {
    key: "amount",
    header: "Amount",
    type: "currency",
    sortable: true,
  },
  {
    key: "active",
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
