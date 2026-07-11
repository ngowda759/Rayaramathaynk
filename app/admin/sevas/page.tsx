"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Plus } from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import Button from "@/components/ui/button";
import { memberService, volunteerService } from "@/services/volunteer.service";
import { Member, Volunteer } from "@/types/volunteer";
import { memberColumns, volunteerColumns } from "./columns";
type TabType = "members" | "volunteers";
export default function VolunteerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersData, volunteersData] = await Promise.all([
        memberService.getAllMembers(),
        volunteerService.getAllVolunteers(),
      ]);
      setMembers(membersData);
      setVolunteers(volunteersData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const currentData = activeTab === "members" ? members : volunteers;
  const currentColumns = activeTab === "members" ? memberColumns : volunteerColumns;
  const currentIdField = activeTab === "members" ? "memberId" : "volunteerId";
  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return currentData;
    return currentData.filter((item) =>
      [item.name, item.phone, item.address, item[currentIdField as keyof typeof item]].some((value) =>
        String(value).toLowerCase().includes(keyword)
      )
    );
  }, [search, currentData, currentIdField]);
  async function handleDelete(item: Member | Volunteer) {
    const nameField = item.name;
    const confirmed = window.confirm(`Delete "${nameField}"?`);
    if (!confirmed) return;
    try {
      if (activeTab === "members") {
        await memberService.deleteMember(item.id);
      } else {
        await volunteerService.deleteVolunteer(item.id);
      }
      await loadData();
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete record.");
    }
  }
  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map((item) => item.id)));
    }
  }
  function handlePrint() {
    const printContent = filteredData
      .filter((item) => selectedIds.has(item.id))
      .map((item, index) => {
        const id = activeTab === "members" 
          ? (item as Member).memberId 
          : (item as Volunteer).volunteerId;
        return `${index + 1}. ${id} | ${item.name} | ${item.phone} | ${item.sex} | ${item.address}`;
      })
      .join("\n");
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${activeTab === "members" ? "Members" : "Volunteers"} List</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; }
              pre { font-size: 14px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <h1>Sri Raghavendra Swamy Mutt - ${activeTab === "members" ? "Members" : "Volunteers"}</h1>
            <pre>${printContent || "No records selected."}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }
  const isAllSelected = filteredData.length > 0 && selectedIds.size === filteredData.length;
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Member / Volunteer"
        description="Manage temple members and volunteers."
        action={
          <Button asChild>
            <Link href={`/admin/sevas/new?tab=${activeTab}`}>
              <Plus className="mr-2 h-4 w-4" />
              Add {activeTab === "members" ? "Member" : "Volunteer"}
            </Link>
          </Button>
        }
      />
      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => { setActiveTab("members"); setSearch(""); setSelectedIds(new Set()); }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "members"
              ? "border-b-2 border-orange-600 text-orange-600"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Members
        </button>
        <button
          onClick={() => { setActiveTab("volunteers"); setSearch(""); setSelectedIds(new Set()); }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "volunteers"
              ? "border-b-2 border-orange-600 text-orange-600"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Volunteers
        </button>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={`Search ${activeTab}...`}
          />
        </div>
        {selectedIds.size > 0 && (
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print Selected ({selectedIds.size})
          </Button>
        )}
      </div>
      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-100">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                  </th>
                  {currentColumns.map((col) => (
                    <th
                      key={col.key}
                      className="px-6 py-4 text-left text-sm font-semibold text-stone-700"
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={currentColumns.length + 1} className="px-6 py-10 text-center text-stone-500">
                      No {activeTab} found.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item.id} className="border-t transition-colors hover:bg-stone-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="h-4 w-4 rounded border-stone-300"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {activeTab === "members" 
                          ? (item as Member).memberId 
                          : (item as Volunteer).volunteerId}
                      </td>
                      <td className="px-6 py-4 text-sm">{item.name}</td>
                      <td className="px-6 py-4 text-sm">{item.phone}</td>
                      <td className="px-6 py-4 text-sm">{item.sex}</td>
                      <td className="px-6 py-4 text-sm">
                        {item.active ? "🟢 Yes" : "🔴 No"}
                      </td>
                      <td className="px-6 py-4 text-sm">{item.address}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/admin/sevas/${item.id}/edit?tab=${activeTab}`)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(item)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
