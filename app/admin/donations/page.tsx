"use client";

import { useEffect, useMemo, useState } from "react";
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

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<DonationStatus | "all">(
      "all"
    );

  async function loadDonations() {
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
  }

  useEffect(() => {
    loadDonations();
  }, []);

  const filteredDonations =
    useMemo(() => {
      const keyword = search
        .toLowerCase()
        .trim();

      return donations.filter(
        (donation) => {
          const matchesSearch =
            !keyword ||
            [
              donation.name,
              donation.email,
              donation.phone,
            ].some((value) =>
              value
                .toLowerCase()
                .includes(keyword)
            );

          const matchesStatus =
            statusFilter === "all" ||
            donation.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
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
        `Delete donation from ${donation.name}?`
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

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Donations"
        description="Manage temple donations."
      />

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
              e.target
                .value as DonationStatus | "all"
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
