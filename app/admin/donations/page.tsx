"use client";

import { useEffect, useState } from "react";
import { donationService } from "@/services/donation.service";
import { DonationRecord } from "@/types/donation";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadDonations() {
    try {
      setLoading(true);
      const data = await donationService.getDonations();
      setDonations(data);
    } catch (error) {
      console.error("Failed to load donations:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDonations();
  }, []);

  const filteredDonations = donations.filter((donation) => {
    const keyword = search.toLowerCase();
    return (
      donation.name.toLowerCase().includes(keyword) ||
      donation.email.toLowerCase().includes(keyword) ||
      donation.paymentMethod.toLowerCase().includes(keyword) ||
      donation.status.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Donations"
        description="Review donation requests and contribution records."
      />

      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Donation Records
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Donations submitted by devotees through the public site.
            </p>
          </div>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search donations..."
          />
        </div>

        {loading ? (
          <div className="mt-8 text-stone-500">Loading donations...</div>
        ) : filteredDonations.length === 0 ? (
          <div className="mt-8 text-stone-500">
            No donation records found.
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-3xl border border-stone-200">
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50 text-left text-sm uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-4 py-3">Donor</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 bg-white text-sm text-stone-700">
                {filteredDonations.map((donation) => (
                  <tr key={donation.id} className="hover:bg-stone-50">
                    <td className="px-4 py-4">
                      <div className="font-medium text-stone-900">
                        {donation.name}
                      </div>
                      <div className="text-xs text-stone-500">
                        {donation.email}
                      </div>
                    </td>
                    <td className="px-4 py-4">₹{donation.amount.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-4">{donation.paymentMethod}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        donation.status === "received"
                          ? "bg-emerald-100 text-emerald-700"
                          : donation.status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {donation.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-stone-500">
                      {new Date(donation.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
