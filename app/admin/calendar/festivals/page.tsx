"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Save, X, PartyPopper } from "lucide-react";
import { Festival } from "@/types/calendar";
import { calendar } from "@/data/calendar";

export default function FestivalsAdminPage() {
  const [festivalsList, setFestivalsList] = useState<Festival[]>(calendar.festivals);
  const [newDate, setNewDate] = useState("");
  const [newFestival, setNewFestival] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editFestival, setEditFestival] = useState("");
  const [samvatsara] = useState(calendar.samvatsara);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = async () => {
    if (!newDate || !newFestival) return;

    const newEntry: Festival = {
      date: newDate,
      festival: newFestival,
    };

    const updatedList = [...festivalsList, newEntry].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    try {
      await fetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ festivals: updatedList, samvatsara }),
      });
    } catch {
      console.error("API not available, updating local state only");
    }

    setFestivalsList(updatedList);
    setNewDate("");
    setNewFestival("");
    setShowForm(false);
  };

  const handleUpdate = async () => {
    if (editingIndex === null || !editDate || !editFestival) return;

    const updatedList = [...festivalsList];
    updatedList[editingIndex] = {
      date: editDate,
      festival: editFestival,
    };

    updatedList.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    try {
      await fetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ festivals: updatedList, samvatsara }),
      });
    } catch {
      console.error("API not available, updating local state only");
    }

    setFestivalsList(updatedList);
    setEditingIndex(null);
    setEditDate("");
    setEditFestival("");
  };

  const handleDelete = async (index: number) => {
    const updatedList = festivalsList.filter((_, i) => i !== index);

    try {
      await fetch("/api/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ festivals: updatedList, samvatsara }),
      });
    } catch {
      console.error("API not available, updating local state only");
    }

    setFestivalsList(updatedList);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditDate(festivalsList[index].date);
    setEditFestival(festivalsList[index].festival);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Festival Calendar</h1>
          <p className="text-gray-500">Manage festival dates for {samvatsara} Samvatsara</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus size={18} />
          Add Festival
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Add New Festival</h3>
          <div className="flex gap-4 items-end flex-wrap">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Festival Name
              </label>
              <input
                type="text"
                value={newFestival}
                onChange={(e) => setNewFestival(e.target.value)}
                placeholder="e.g., Diwali, Navratri"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-64"
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
                setNewFestival("");
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
                Festival
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {festivalsList.map((item, index) => (
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
                <td className="px-6 py-4 text-sm text-gray-900">
                  {editingIndex === index ? (
                    <input
                      type="text"
                      value={editFestival}
                      onChange={(e) => setEditFestival(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 w-full"
                    />
                  ) : (
                    item.festival
                  )}
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
                          setEditFestival("");
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
        {festivalsList.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <PartyPopper className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>No festivals added yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
