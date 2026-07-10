import { DonationStatus } from "@/types/donation";

interface DonationStatusBadgeProps {
  status: DonationStatus;
}

const styles: Record<DonationStatus, string> = {
  pending:
    "bg-yellow-100 text-yellow-800 border-yellow-200",
  received:
    "bg-green-100 text-green-800 border-green-200",
  failed:
    "bg-red-100 text-red-800 border-red-200",
};

export default function DonationStatusBadge({
  status,
}: DonationStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}
