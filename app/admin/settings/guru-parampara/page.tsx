"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw, Plus, Trash2, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Guru {
  id: string;
  number: string;
  name: string;
  kannada: string;
  description: string;
}

interface GuruParamparaData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  gurus: Guru[];
}

const COLLECTION = "settings";
const DOCUMENT = "guruParampara";

const defaultData: GuruParamparaData = {
  heading: "Guru Parampara",
  headingKannada: "ಗುರು ಪರಂಪರೆ",
  subheading: "The sacred lineage of Madhva tradition",
  subheadingKannada: "ಮಾಧ್ವ ಸಂಪ್ರದಾಯದ ಪವಿತ್ರ ವಂಶಾವಳಿ",
  gurus: [
    {
      id: "1",
      number: "01",
      name: "Madwacharyaru",
      kannada: "ಬ್ರಹ್ಮಾಂತಾಗುರವ: ಸಾಕ್ಷಾದಿಷ್ಟಂ ದೈವಂ ಶ್ರೀಯ:ಪತಿ: ಆಚಾರ್ಯಾ: ಶ್ರೀಮದಾಚಾರ್ಯಾ: ಸಂತುಮೇ ಜನ್ಮ ಜನ್ಮನಿ ||",
      description: "The great preceptor who is the very essence of the Vedas, the divine master of all, the supreme teacher - Sri Madhvacharya",
    },
    {
      id: "2",
      number: "02",
      name: "Padmanabha Teertharu",
      kannada: "ಪೂರ್ಣಪ್ರಜ್ಞ ಕೃತಂ ಭಾಷ್ಯಾಮಾದೌ ತದ್ಭಾವಪೂರ್ವಕಂ ಯೋ ವ್ಯಾಕರೋನ್ನಮಸ್ಮೈ ಪದ್ಮನಾಭಾಖ್ಯ ಯೋಗಿನೇ ||",
      description: "The learned scholar who composed the bhashya (commentary) with complete knowledge and understanding",
    },
    {
      id: "3",
      number: "03",
      name: "Narahari Teertharu",
      kannada: "ಸಸೀತಾ ಮೂಲರಾಮಾರ್ಚಾ ಕೋಶೇ ಗಜಪತೇ ಸ್ಥಿತಾ ಯೇನಾನೀತಾ ನಮಸ್ತಸ್ಮೈ ಶ್ರೀಮನ್ ನೃಹರಿ ಭಿಕ್ಷವೇ ||",
      description: "The saint who tended to the Lord like a devotee, carrying the essence of devotion",
    },
    {
      id: "4",
      number: "04",
      name: "Madhava Teertharu",
      kannada: "ಸಾಧಿತಾಖಿಲ ಸತ್ತತ್ವಂ ಬಾಧಿತಾಖಿಲ ದುರ್ಮತಂ ಬೊಧಿತಾಖಿಲ ಸನ್ಮಾರ್ಗಂ ಮಾಧವಾಖ್ಯ ಗುರುಂ ಭಜೇ ||",
      description: "The guru who established all truths, refuted all false doctrines, and illuminated the path of righteousness",
    },
    {
      id: "5",
      number: "05",
      name: "Akshobhya Teertharu",
      kannada: "ಯೋ ವಿದ್ಯಾರಣ್ಯ ವಿಪಿನಂ ತತ್ವಮಸ್ಸಿನಾಛ್ಛಿನತ ಶ್ರೀಮದಕ್ಷೋಭ್ಯತೀರ್ಥಾಯ ನಮಸ್ತಸ್ಮೈ ಮಹಾತ್ಮನೇ ||",
      description: "The great soul who cut through the forest of ignorance with the sword of knowledge",
    },
    {
      id: "6",
      number: "06",
      name: "Jayateertharu",
      kannada: "ಯಸ್ಯ ವಾಕ್ಕಾಮಧೇನುರ್ನ: ಕಾಮಿತಾರ್ಥನ್ ಪ್ರಯಚ್ಛತಿ ಸೇವೇ ತಂ ಜಯಯೋಗೀಂದ್ರಂ ಕಾಮಬಾಣಚ್ಚಿದಂ ಸದಾ ||",
      description: "The victorious one whose words shower desired fruits upon devotees like the flow of honey",
    },
    {
      id: "7",
      number: "07",
      name: "Vidhyadirajaru",
      kannada: "ಮಾದ್ಯದದ್ವೈತ್ಯಂಧಕಾರ ಪ್ರದ್ಯೋತನಮಹರ್ನಿಶಂ ವಿದ್ಯಾಧಿರಾಜ ಸುಗುರೂಂ ಹೃದ್ಯಾಮಿತ ಗುರೂಂ ಭಜೇ ||",
      description: "The king of knowledge who illuminates the darkness of duality, the beloved guru of all scholars",
    },
    {
      id: "8",
      number: "08",
      name: "Kaveendra Teertharu",
      kannada: "ವೀಂದ್ರಾರೂಢ ಪದಾಸಕ್ತಂ ರಾಜೇಂದ್ರ ಮುನಿಸೇವಿತಂ ಶ್ರೀ ಕವೀಂದ್ರ ಮುನಿಂ ವಂದೇ ಭಜತಾಂ ಚಂದ್ರ ಸನ್ನಿಭಂ ||",
      description: "The poet-king among saints, served by great devotees, like the moon among stars",
    },
    {
      id: "9",
      number: "09",
      name: "Vageesha Teertharu",
      kannada: "ವಾಸುದೇವ ಪದದ್ವಂದ್ವ ವಾರಿಜಾಸಕ್ತ ಮಾನಸಂ ಪದ ವ್ಯಾಖ್ಯಾನ ಕುಶಲಂ ವಾಗೀಶ ಯತಿಮಾಶ್ರಯೇ ||",
      description: "The master of speech who is devoted to Vasudeva's feet and excels in explaining divine truths",
    },
    {
      id: "10",
      number: "10",
      name: "Ramachandra Teertharu",
      kannada: "ದ್ಯುಮಣ್ಯಬೀಜನಾಬ್ದಿಂದುಂ ರಾಮವ್ಯಾಸಪದಾರ್ಚಕ: ರಾಮಚಂದ್ರ ಗುರುರ್ಭ್ರುಯಾತ್ ಕಾಮಿತಾರ್ಥ ಪ್ರದಾಯಕ: ||",
      description: "The guru born from the lineage of Ramanuja, like the moon from the ocean of nectar, fulfilling all desires",
    },
    {
      id: "11",
      number: "11",
      name: "Vibhudhendra Teertharu",
      kannada: "ಅಕೇರಲಂ ತಥಾ ಸೇತುಂ ಮಾಗಂಗಂ ಚ ಹಿಮಾಲಯಂ ನಿರಾಕೃತಾದ್ವೈತ ಶೈವಂ ವಿಭುದೇಂದ್ರ ಗುರೂಂ ಭಜೇ ||",
      description: "The wise guru who crossed the oceans, bridges, rivers and mountains, worshipping the non-dual Shaiva doctrine",
    },
    {
      id: "12",
      number: "12",
      name: "Jitamitra Teertharu",
      kannada: "ಸಪ್ತರಾತ್ರದ ಕೃಷ್ಣವೇಣ್ಯಾ ಮುಶಿತ್ವಾ ಪುನರುತ್ಥಿತದ ಜಿತಾಮಿತ್ರ ಗುರು ವಂದೇ ವಿಭುದೇಂದ್ರ ಕರೋದ್ಭವದ ||",
      description: "The victorious friend who conquered all enemies of knowledge",
    },
    {
      id: "13",
      number: "13",
      name: "Raghunandana Teertharu",
      kannada: "ಪರೈರಪಹೃತಾ ಮೂಲರಾಮಾರ್ಚಾ ಗುರ್ವನುಗ್ರಹಾತ್ ಯೇನಾನೀತಾ ನಮಸ್ತಸ್ಮೈ ರಘುನಂದನ್ ಭಿಕ್ಷವೇ ||",
      description: "The one who received the essence of service to the Lord's feet through the guru's grace",
    },
    {
      id: "14",
      number: "14",
      name: "Surendra Teertharu",
      kannada: "ಯಶ್ಚಕಾರೋಪವಾಸೇನ ತ್ರಿವಾರದ ಭೂ ಪ್ರದಕ್ಷಿಣದ ತಸ್ಮೈ ನಮೋ ಯತೀಂದ್ರಾಯ ಶ್ರೀ ಸುರೇಂದ್ರ ತಪಸ್ವಿನೇ ||",
      description: "The austere practitioner who worshipped with three daily circuits of the earth through renunciation",
    },
    {
      id: "15",
      number: "15",
      name: "Vijayeendra Teertharu",
      kannada: "ಭಕ್ತಾನಾಂ ಮಾನಸಾಂ ಭೋಜಭಾನವೇ ಕಾಮಧೇನವೇ ಭಜತಾಂ ಕಲ್ಪತರವೇ ಜಯೀಂದ್ರ ಗುರವೇ ನಮಃ ||",
      description: "The lord of victory who is the wish-fulfilling tree for devotees, fulfilling all desires",
    },
    {
      id: "16",
      number: "16",
      name: "Sudheendra Teertharu",
      kannada: "ಕುಶಾಗ್ರಮತಯೇ ಭಾನುದ್ಯುತಯೇ ವಾದಿ ಭೀತಯೇ ಆರಾಧಿತ ಶ್ರೀಪತಯೇ ಶ್ರೀಸುಧೀಂದ್ರ ಯತಯೇ ನಮಃ ||",
      description: "The excellent one who is the crest-jewel of scholars, radiant like the sun, worshipped by the learned",
    },
    {
      id: "17",
      number: "17",
      name: "Raghavendra Teertharu",
      kannada: "ದುರ್ವಾದಿಧ್ವಾಂತರವಯೇ ವೈಷ್ಣವೇಂದೀವರೇಂದವೇ ಶ್ರೀ ರಾಘವೇಂದ್ರ ಗುರವೇ ನಮೋ ಅತ್ಯಂತ ದಯಾಳವೇ ||",
      description: "The presiding deity of our Matha, the great saint who is the embodiment of Lord Rama's grace, extremely compassionate",
    },
  ],
};

export default function GuruParamparaSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<GuruParamparaData>(defaultData);

  useEffect(() => {
    async function loadData() {
        if (!db) {
          setLoading(false);
          return;
        }
      try {
        const docRef = doc(db, COLLECTION, DOCUMENT);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData({ ...defaultData, ...docSnap.data() } as GuruParamparaData);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function saveData() {
    if (!db) {
      toast.error("Firebase not configured");
      return;
    }
    setSaving(true);
    try {
      const docRef = doc(db, COLLECTION, DOCUMENT);
      await setDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      toast.success("Guru Parampara saved successfully!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof GuruParamparaData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function updateGuru(id: string, field: keyof Guru, value: string) {
    setData((prev) => ({
      ...prev,
      gurus: prev.gurus.map((g) =>
        g.id === id ? { ...g, [field]: value } : g
      ),
    }));
  }

  function addGuru() {
    const newNumber = (data.gurus.length + 1).toString().padStart(2, '0');
    const newGuru: Guru = {
      id: Date.now().toString(),
      number: newNumber,
      name: "",
      kannada: "",
      description: "",
    };
    setData((prev) => ({ ...prev, gurus: [...prev.gurus, newGuru] }));
  }

  function removeGuru(id: string) {
    if (confirm("Are you sure you want to remove this guru?")) {
      setData((prev) => ({
        ...prev,
        gurus: prev.gurus.filter((g) => g.id !== id),
      }));
    }
  }

  function moveGuru(index: number, direction: 'up' | 'down') {
    const newGurus = [...data.gurus];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newGurus.length) return;
    [newGurus[index], newGurus[targetIndex]] = [newGurus[targetIndex], newGurus[index]];
    // Update numbers
    newGurus.forEach((g, i) => {
      g.number = (i + 1).toString().padStart(2, '0');
    });
    setData((prev) => ({ ...prev, gurus: newGurus }));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/settings"
          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <AdminPageHeader
          title="Guru Parampara Settings"
          description="Configure the Guru Parampara page content."
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setData(defaultData)}
          className="border-stone-300"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Page Header */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-900 mb-4">Page Header</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Heading (English)
            </label>
            <Input
              type="text"
              value={data.heading}
              onChange={(e) => updateField("heading", e.target.value)}
              placeholder="Guru Parampara"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Heading (Kannada)
            </label>
            <Input
              type="text"
              value={data.headingKannada}
              onChange={(e) => updateField("headingKannada", e.target.value)}
              placeholder="ಗುರು ಪರಂಪರೆ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Subheading (English)
            </label>
            <Input
              type="text"
              value={data.subheading}
              onChange={(e) => updateField("subheading", e.target.value)}
              placeholder="The sacred lineage..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Subheading (Kannada)
            </label>
            <Input
              type="text"
              value={data.subheadingKannada}
              onChange={(e) => updateField("subheadingKannada", e.target.value)}
              placeholder="ಮಾಧ್ವ ಸಂಪ್ರದಾಯದ..."
            />
          </div>
        </div>
      </div>

      {/* Gurus List */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-900">Gurus</h3>
          <Button onClick={addGuru} size="sm" className="bg-orange-600 hover:bg-orange-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Guru
          </Button>
        </div>

        <div className="space-y-4">
          {data.gurus.map((guru, index) => (
            <div key={guru.id} className="rounded-lg border p-4 bg-stone-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-stone-400 cursor-move" />
                  <span className="text-sm font-semibold text-orange-600">
                    #{guru.number}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveGuru(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveGuru(index, 'down')}
                    disabled={index === data.gurus.length - 1}
                    className="p-1 text-stone-400 hover:text-stone-600 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeGuru(guru.id)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Guru Name (English)
                  </label>
                  <Input
                    type="text"
                    value={guru.name}
                    onChange={(e) => updateGuru(guru.id, "name", e.target.value)}
                    placeholder="Guru Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Guru Name (Kannada)
                  </label>
                  <Input
                    type="text"
                    value={guru.kannada}
                    onChange={(e) => updateGuru(guru.id, "kannada", e.target.value)}
                    placeholder="ಗುರು ಹೆಸರು"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Description (English)
                  </label>
                  <Textarea
                    value={guru.description}
                    onChange={(e) => updateGuru(guru.id, "description", e.target.value)}
                    placeholder="Description of the guru..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.gurus.length === 0 && (
          <div className="text-center py-8 text-stone-500">
            No gurus added yet. Click &quot;Add Guru&quot; to create one.
          </div>
        )}
      </div>

      <div className="flex justify-end pb-6">
        <Button
          onClick={saveData}
          disabled={saving}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
