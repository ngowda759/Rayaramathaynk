import { CrudColumn } from "@/types/crud";
import { SevaBooking } from "@/types/seva-booking";

export const bookingColumns: CrudColumn<SevaBooking>[] = [
  {
    key: "sevaTitle",
    header: "Seva",
    sortable: true,
  },
  {
    key: "userName",
    header: "Devotee",
    sortable: true,
  },
  {
    key: "preferredDate",
    header: "Date",
    sortable: true,
  },
  {
    key: "sevaAmount",
    header: "Amount",
    type: "currency",
    sortable: true,
  },
  {
    key: "status",
    header: "Status",
    formatter: (value) => {
      switch (value) {
        case "confirmed":
          return "🟢 Confirmed";
        case "completed":
          return "🔵 Completed";
        case "cancelled":
          return "🔴 Cancelled";
        default:
          return "🟡 Pending";
      }
    },
    sortable: true,
  },
  {
    key: "actions",
    header: "Actions",
    type: "actions",
  },
];
