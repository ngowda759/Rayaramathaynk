"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import DonationDetails from "@/components/admin/donations/DonationDetails";

import { donationService } from "@/services/donation.service";
import { DonationRecord } from "@/types/donation";

export default function DonationPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [donation, setDonation] =
    useState<DonationRecord | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadDonation() {
      try {
        const data =
          await donationService.getDonationById(id);

        if (!data) {
          toast.error("Donation not found.");

          router.push("/admin/donations");
          return;
        }

        setDonation(data);
      } catch (error) {
        console.error(error);

        toast.error(
          "Failed to load donation."
        );

        router.push("/admin/donations");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadDonation();
    }
  }, [id, router]);

  if (loading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Donation Details"
          description="Loading donation..."
        />

        <div className="rounded-xl border bg-white p-8">
          Loading donation...
        </div>
      </div>
    );
  }

  if (!donation) return null;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Donation Details"
        description="View and manage donation."
      />

      <DonationDetails donation={donation} />
    </div>
  );
}
