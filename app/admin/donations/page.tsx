"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import CrudTable from "@/components/admin/crud/CrudTable";
import { donationColumns } from "./columns";
import { donationService } from "@/services/donation.service";
import {
  DonationRecord,
  DonationStatus,
} from "@/types/donation";
export default function DonationsPage() {
  const router = useRouter();
  const [donations, setDonations] = useState<
    DonationRecord[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<DonationStatus | "all">("all");
  const loadDonations = useCallback(async () => {
    try {
      setLoading(true);
      const data =
        await donationService.getDonations();
      setDonations(data);
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to load donations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDonations();
  }, []);

  const filteredDonations = useMemo(() => {
    const keyword = search
      .toLowerCase()
      .trim();
    return donations.filter((donation) => {
      const matchesSearch =
        !keyword ||
        [
          donation.donorName,
          donation.email,
          donation.phone,
          donation.purpose,
        ].some((value) =>
          value.toLowerCase().includes(keyword)
        );
      const matchesStatus =
        statusFilter === "all" ||
        donation.status === statusFilter;
      return (
        matchesSearch && matchesStatus
      );
    });
  }, [
    donations,
    search,
    statusFilter,
  ]);
  async function updateStatus(
    donation: DonationRecord,
    status: DonationStatus
  ) {
    try {
      await donationService.updateDonationStatus(
        donation.id,
        status
      );
      toast.success(
        "Donation updated."
      );
      await loadDonations();
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to update donation."
      );
    }
  }
  async function handleDelete(
    donation: DonationRecord
  ) {
    if (
      !window.confirm(
        `Delete donation from ${donation.donorName}?`
      )
    ) {
      return;
    }
    try {
      await donationService.deleteDonation(
        donation.id
      );
      toast.success(
        "Donation deleted."
      );
      await loadDonations();
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to delete donation."
      );
    }
  }
  const totalAmount = donations.reduce(
    (sum, donation) =>
      sum + donation.amount,
    0
  );
  const pendingCount = donations.filter(
    (d) => d.status === "pending"
  ).length;
  const receivedCount = donations.filter(
    (d) => d.status === "received"
  ).length;
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Donations"
        description="Manage temple donations."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">
            Total Donations
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            ₹{totalAmount.toLocaleString()}
          </h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">
            Pending
          </p>
          <h2 className="mt-2 text-3xl font-bold text-amber-600">
            {pendingCount}
          </h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">
            Received
          </p>
          <h2 className="mt-2 text-3xl font-bold text-green-600">
            {receivedCount}
          </h2>
        </div>
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search donations..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as
                | DonationStatus
                | "all"
            )
          }
          className="rounded-xl border border-stone-300 bg-white px-4 py-3"
        >
          <option value="all">
            All Status
          </option>
          <option value="pending">
            Pending
          </option>
          <option value="received">
            Received
          </option>
          <option value="failed">
            Failed
          </option>
        </select>
      </div>
      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading donations...
        </div>
      ) : (
        <CrudTable<DonationRecord>
          data={filteredDonations}
          columns={donationColumns}
          emptyMessage="No donations found."
          actions={{
            onView: (donation) =>
              router.push(
                `/admin/donations/${donation.id}`
              ),
            onEdit: (donation) =>
              updateStatus(
                donation,
                "received"
              ),
            onDelete:
              handleDelete,
          }}
        />
      )}
    </div>
  );
}
