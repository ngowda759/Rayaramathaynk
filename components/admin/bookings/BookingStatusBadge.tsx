import { SevaBookingStatus } from "@/types/seva-booking";

interface BookingStatusBadgeProps {
  status: SevaBookingStatus;
}

const styles: Record<
  SevaBookingStatus,
  string
> = {
  pending:
    "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed:
    "bg-green-100 text-green-800 border-green-200",
  completed:
    "bg-blue-100 text-blue-800 border-blue-200",
  cancelled:
    "bg-red-100 text-red-800 border-red-200",
};

export default function BookingStatusBadge({
  status,
}: BookingStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}
