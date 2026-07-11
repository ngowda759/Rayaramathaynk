"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Save, X, Calendar } from "lucide-react";
import { Ekadashi } from "@/types/calendar";
import { calendar } from "@/data/calendar";

const getDayOfWeek = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "long" });
};

export default function EkadashiAdminPage() {
  const [ekadashiList, setEkadashiList] = useState<Ekadashi[]>(calendar.ekadashi);
  const [newDate, setNewDate] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [samvatsara] = useState(calendar.samvatsara);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = async () => {
    if (!newDate) return;

    const newEntry: Ekadashi = {
      date: newDate,
      day: getDayOfWeek(newDate),
    };

    const updatedList = [...ekadashiList, newEntry].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    try {
      await fetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ekadashi: updatedList, samvatsara }),
      });
    } catch {
      console.error("API not available, updating local state only");
    }

    setEkadashiList(updatedList);
    setNewDate("");
    setShowForm(false);
  };

  const handleUpdate = async () => {
    if (editingIndex === null || !editDate) return;

    const updatedList = [...ekadashiList];
    updatedList[editingIndex] = {
      date: editDate,
      day: getDayOfWeek(editDate),
    };

    updatedList.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    try {
      await fetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ekadashi: updatedList, samvatsara }),
      });
    } catch {
      console.error("API not available, updating local state only");
    }

    setEkadashiList(updatedList);
    setEditingIndex(null);
    setEditDate("");
  };

  const handleDelete = async (index: number) => {
    const updatedList = ekadashiList.filter((_, i) => i !== index);

    try {
      await fetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ekadashi: updatedList, samvatsara }),
      });
    } catch {
      console.error("API not available, updating local state only");
    }

    setEkadashiList(updatedList);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditDate(ekadashiList[index].date);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ekadashi Calendar</h1>
          <p className="text-gray-500">Manage Ekadashi dates for {samvatsara} Samvatsara</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus size={18} />
          Add Ekadashi
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Add New Ekadashi</h3>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save size={18} />
              Save
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewDate("");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              <X size={18} />
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Day
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ekadashiList.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingIndex === index ? (
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  ) : (
                    new Date(item.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {item.day}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {editingIndex === index ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleUpdate}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Save"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingIndex(null);
                          setEditDate("");
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Cancel"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEditing(index)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ekadashiList.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>No Ekadashi dates added yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
