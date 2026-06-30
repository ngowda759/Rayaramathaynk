"use client";

import toast from "react-hot-toast";

import Button from "@/components/ui/button";

import {
  DonationRecord,
  DonationStatus,
} from "@/types/donation";

import { donationService } from "@/services/donation.service";

import DonationStatusBadge from "./DonationStatusBadge";

interface DonationDetailsProps {
  donation: DonationRecord;
}

export default function DonationDetails({
  donation,
}: DonationDetailsProps) {
  async function updateStatus(
    status: DonationStatus
  ) {
    try {
      await donationService.updateDonationStatus(
        donation.id,
        status
      );

      toast.success("Donation updated.");

      window.location.reload();
    } catch {
      toast.error("Failed to update donation.");
    }
  }

  return (
    <div className="space-y-6 rounded-xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Donation Details
        </h2>

        <DonationStatusBadge
          status={donation.status}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Info
          label="Donor"
          value={donation.donorName}
        />

        <Info
          label="Email"
          value={donation.email}
        />

        <Info
          label="Phone"
          value={donation.phone}
        />

        <Info
          label="Address"
          value={donation.address || "-"}
        />

        <Info
          label="Purpose"
          value={donation.purpose || "-"}
        />

        <Info
          label="Amount"
          value={`₹${donation.amount}`}
        />

        <Info
          label="Payment Mode"
          value={donation.paymentMode}
        />

        <Info
          label="Receipt No."
          value={
            donation.receiptNumber || "-"
          }
        />
      </div>

      <div>
        <h3 className="mb-2 font-medium">
          Devotee Message
        </h3>

        <div className="rounded-lg border bg-stone-50 p-4">
          {donation.message || "-"}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium">
          Admin Remarks
        </h3>

        <div className="rounded-lg border bg-stone-50 p-4">
          {donation.adminRemarks || "-"}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() =>
            updateStatus("received")
          }
        >
          Mark Received
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            updateStatus("failed")
          }
        >
          Mark Failed
        </Button>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <div className="text-sm text-stone-500">
        {label}
      </div>

      <div className="font-medium">
        {value}
      </div>
    </div>
  );
}
