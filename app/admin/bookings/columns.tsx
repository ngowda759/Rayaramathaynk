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
    key: "paymentStatus",
    header: "Payment",
    formatter: (value, row: SevaBooking) => {
      if (value === "completed") {
        return (
          <span className="text-green-600" title={`Ref: ${row.paymentReference || "N/A"}`}>
            ✓ Paid
          </span>
        );
      } else if (value === "failed") {
        return <span className="text-red-600">Failed</span>;
      }
      return <span className="text-amber-600">Pending</span>;
    },
    sortable: true,
  },
  {
    key: "paymentReference",
    header: "Payment Ref",
    formatter: (value) => {
      if (!value) return <span className="text-stone-400">—</span>;
      return <span className="text-xs font-mono">{String(value)}</span>;
    },
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
