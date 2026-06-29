import { CrudColumn } from "@/types/crud";
import { DonationRecord } from "@/types/donation";

export const donationColumns: CrudColumn<DonationRecord>[] = [
  {
    key: "name",
    header: "Donor",
    sortable: true,
  },
  {
    key: "amount",
    header: "Amount",
    type: "currency",
    sortable: true,
  },
  {
    key: "paymentMethod",
    header: "Payment",
    sortable: true,
  },
  {
    key: "status",
    header: "Status",
    formatter: (value) => {
      switch (value) {
        case "received":
          return "🟢 Received";
        case "failed":
          return "🔴 Failed";
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
