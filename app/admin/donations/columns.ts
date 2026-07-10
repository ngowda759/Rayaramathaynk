import { CrudColumn } from "@/types/crud";
import { DonationRecord } from "@/types/donation";

export const donationColumns: CrudColumn<DonationRecord>[] = [
  {
    key: "donorName",
    header: "Donor",
    sortable: true,
  },
  {
    key: "purpose",
    header: "Purpose",
    sortable: true,
  },
  {
    key: "amount",
    header: "Amount",
    type: "currency",
    sortable: true,
  },
  {
    key: "paymentMode",
    header: "Payment",
    formatter: (value) => {
      switch (value) {
        case "bank_transfer":
          return "Bank Transfer";
        case "upi":
          return "UPI";
        case "cheque":
          return "Cheque";
        case "cash":
          return "Cash";
        default:
          return "Other";
      }
    },
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
