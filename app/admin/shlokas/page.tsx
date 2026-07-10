"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Save, X, BookOpen, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Shloka } from "@/types/shlokas";
import { shlokas as shlokasData } from "@/data/shlokas";

const categories = [
  "Daily Prayers",
  "Sri Raghavendra Swamy",
  "Vishu",
  "Pooja",
  "Mantras",
  "Stotrams",
  "Bhajans",
  "Other"
];

export default function ShlokasAdminPage() {
  const [shlokas, setShlokas] = useState<Shloka[]>(shlokasData);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    titleKannada: "",
    author: "",
    authorKannada: "",
    category: "Daily Prayers",
    verses: "",
    meaning: ""
  });

  const resetForm = () => {
    setFormData({
      title: "",
      titleKannada: "",
      author: "",
      authorKannada: "",
      category: "Daily Prayers",
      verses: "",
      meaning: ""
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.verses) return;

    const versesArray = formData.verses.split("\n").filter(v => v.trim());

    if (editingId) {
      // Update existing
      setShlokas(shlokas.map(s => 
        s.id === editingId 
          ? { 
              ...s, 
              title: formData.title,
              titleKannada: formData.titleKannada,
              author: formData.author,
              authorKannada: formData.authorKannada,
              category: formData.category,
              verses: versesArray,
              meaning: formData.meaning
            }
          : s
      ));
    } else {
      // Add new
      const newShloka: Shloka = {
        id: formData.title.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now(),
        title: formData.title,
        titleKannada: formData.titleKannada,
        author: formData.author || undefined,
        authorKannada: formData.authorKannada || undefined,
        category: formData.category,
        verses: versesArray,
        meaning: formData.meaning || undefined
      };
      setShlokas([...shlokas, newShloka]);
    }
    resetForm();
  };

  const handleEdit = (shloka: Shloka) => {
    setFormData({
      title: shloka.title,
      titleKannada: shloka.titleKannada || "",
      author: shloka.author || "",
      authorKannada: shloka.authorKannada || "",
      category: shloka.category,
      verses: shloka.verses.join("\n"),
      meaning: shloka.meaning || ""
    });
    setEditingId(shloka.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this shloka?")) {
      setShlokas(shlokas.filter(s => s.id !== id));
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const groupedShlokas = shlokas.reduce((acc, shloka) => {
    if (!acc[shloka.category]) {
      acc[shloka.category] = [];
    }
    acc[shloka.category].push(shloka);
    return acc;
  }, {} as Record<string, Shloka[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shlokas Management</h1>
          <p className="text-gray-500">Manage devotional shlokas and prayers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus size={18} />
          Add Shloka
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingId ? "Edit Shloka" : "Add New Shloka"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (English) *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g., Raghavendra Ashtottara"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (Kannada)
              </label>
              <input
                type="text"
                value={formData.titleKannada}
                onChange={(e) => setFormData({...formData, titleKannada: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="ರಾಘವೇಂದ್ರ ಅಷ್ಟೋತ್ತರ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Author (English)
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({...formData, author: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g., Sri Vadirajatirtharu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Author (Kannada)
              </label>
              <input
                type="text"
                value={formData.authorKannada}
                onChange={(e) => setFormData({...formData, authorKannada: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verses * (one per line)
              </label>
              <textarea
                value={formData.verses}
                onChange={(e) => setFormData({...formData, verses: e.target.value})}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-kannada"
                placeholder="ಓಂ ಸಹ ನಾವವತು&#10;ಸಹ ನೌ ಭುನಕ್ತು"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meaning
              </label>
              <textarea
                value={formData.meaning}
                onChange={(e) => setFormData({...formData, meaning: e.target.value})}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Brief explanation of the shloka..."
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save size={18} />
              {editingId ? "Update" : "Save"}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              <X size={18} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Total Shlokas</p>
          <p className="text-2xl font-bold text-gray-900">{shlokas.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Categories</p>
          <p className="text-2xl font-bold text-gray-900">{Object.keys(groupedShlokas).length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Daily Prayers</p>
          <p className="text-2xl font-bold text-gray-900">
            {shlokas.filter(s => s.category === "Daily Prayers").length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Sri Raghavendra</p>
          <p className="text-2xl font-bold text-gray-900">
            {shlokas.filter(s => s.category === "Sri Raghavendra Swamy").length}
          </p>
        </div>
      </div>

      {/* Shlokas by Category */}
      {Object.entries(groupedShlokas).map(([category, categoryShlokas]) => (
        <div key={category} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">{category}</h3>
            <p className="text-sm text-gray-500">{categoryShlokas.length} shlokas</p>
          </div>
          <div className="divide-y divide-gray-100">
            {categoryShlokas.map((shloka) => (
              <div key={shloka.id} className="p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === shloka.id ? null : shloka.id)}
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{shloka.title}</h4>
                    {shloka.titleKannada && (
                      <p className="text-sm text-gray-500 font-kannada">{shloka.titleKannada}</p>
                    )}
                    {shloka.author && (
                      <p className="text-xs text-gray-400 mt-1">by {shloka.author}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(shloka);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(shloka.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                    {expandedId === shloka.id ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </div>
                </div>
                
                {expandedId === shloka.id && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-medium text-gray-700">Verses:</h5>
                        <button
                          onClick={() => handleCopyText(shloka.verses.join("\n"))}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600"
                        >
                          <Copy size={14} />
                          Copy
                        </button>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        {shloka.verses.map((verse, idx) => (
                          <p key={idx} className="font-kannada text-gray-800 leading-relaxed mb-2">
                            {verse}
                          </p>
                        ))}
                      </div>
                    </div>
                    {shloka.meaning && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Meaning:</h5>
                        <p className="text-sm text-gray-600 bg-amber-50 p-3 rounded-lg">
                          {shloka.meaning}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {shlokas.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500">No shlokas added yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 mx-auto"
          >
            <Plus size={18} />
            Add First Shloka
          </button>
        </div>
      )}
    </div>
  );
}
