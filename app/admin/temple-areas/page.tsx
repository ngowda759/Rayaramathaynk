"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { TempleArea, TempleAreaCategory, CATEGORY_LABELS, CATEGORY_COLORS } from "@/types/temple-explorer";
import toast from "react-hot-toast";
import { 
  Compass, PlusCircle, Pencil, Trash2, 
  MapPin, Clock, ChevronDown, ChevronRight,
  Loader2, RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES: TempleAreaCategory[] = ["sanctum", "halls", "facilities", "gardens", "historical"];

export default function TempleAreasPage() {
  const [areas, setAreas] = useState<TempleArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<TempleAreaCategory | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; area: TempleArea | null }>({ open: false, area: null });
  const [editDialog, setEditDialog] = useState<{ open: boolean; area: TempleArea | null }>({ open: false, area: null });
  const [saving, setSaving] = useState(false);

  const loadAreas = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/temple-areas");
      const result = await response.json();
      if (result.success) {
        setAreas(result.areas);
        setError(null);
      } else {
        setError(result.error || "Failed to load temple areas");
      }
    } catch (err) {
      console.error("Failed to load temple areas:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern
    loadAreas();
  }, [loadAreas]);

  const handleDelete = async () => {
    if (!deleteDialog.area) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/temple-areas/${deleteDialog.area.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success("Temple area deleted successfully");
        setDeleteDialog({ open: false, area: null });
        loadAreas();
      } else {
        toast.error(result.error || "Failed to delete area");
      }
    } catch (err) {
      console.error("Failed to delete area:", err);
      toast.error("Failed to delete area");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (area: Partial<TempleArea>) => {
    setSaving(true);
    try {
      const url = editDialog.area 
        ? `/api/admin/temple-areas/${editDialog.area.id}` 
        : "/api/admin/temple-areas";
      const method = editDialog.area ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(area),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success(editDialog.area ? "Temple area updated successfully" : "Temple area created successfully");
        setEditDialog({ open: false, area: null });
        loadAreas();
      } else {
        toast.error(result.error || "Failed to save area");
      }
    } catch (err) {
      console.error("Failed to save area:", err);
      toast.error("Failed to save area");
    } finally {
      setSaving(false);
    }
  };

  const groupedAreas = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = areas.filter(a => a.category === cat);
    return acc;
  }, {} as Record<TempleAreaCategory, TempleArea[]>);

  const stats = {
    total: areas.length,
    sanctum: groupedAreas.sanctum.length,
    halls: groupedAreas.halls.length,
    facilities: groupedAreas.facilities.length,
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Temple Explorer Areas"
        description="Manage temple areas and facilities displayed on the Temple Explorer page."
        action={
          <Button onClick={() => setEditDialog({ open: true, area: null })}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Area
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<MapPin className="h-5 w-5" />} label="Total Areas" value={stats.total} />
        <StatCard icon={<Compass className="h-5 w-5" />} label="Sanctuaries" value={stats.sanctum} />
        <StatCard icon={<MapPin className="h-5 w-5" />} label="Halls" value={stats.halls} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Facilities" value={stats.facilities} />
      </div>

      {loading ? (
        <div className="rounded-3xl border border-amber-200/50 bg-white p-12 shadow-lg">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-300 border-t-transparent" />
            <p className="text-stone-500">Loading temple areas...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200/50 bg-red-50/50 p-8 shadow-lg">
          <h3 className="text-lg font-semibold text-red-700">Failed to load temple areas</h3>
          <p className="mt-2 text-sm text-stone-600">{error}</p>
          <Button onClick={loadAreas} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : areas.length === 0 ? (
        <div className="rounded-3xl border border-amber-200/50 bg-white p-12 shadow-lg text-center">
          <h3 className="text-lg font-semibold text-stone-700">No temple areas found</h3>
          <p className="mt-2 text-sm text-stone-500">Add your first temple area using the &quot;Add Area&quot; button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map(category => {
            const categoryAreas = groupedAreas[category];
            if (categoryAreas.length === 0) return null;
            
            const colors = CATEGORY_COLORS[category];
            const isExpanded = expandedCategory === category;
            
            return (
              <div key={category} className="rounded-xl border bg-white overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-lg px-3 py-1 text-sm font-medium ${colors.bg} ${colors.text}`}>
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-sm text-stone-500">
                      {categoryAreas.length} {categoryAreas.length === 1 ? "area" : "areas"}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-stone-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-stone-400" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="border-t divide-y">
                    {categoryAreas.map(area => (
                      <div key={area.id} className="flex items-center justify-between p-4 hover:bg-stone-50">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl">{area.icon}</span>
                          <div>
                            <h4 className="font-medium text-stone-900">{area.name}</h4>
                            {area.nameKannada && (
                              <p className="text-sm text-stone-500 font-serif">{area.nameKannada}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditDialog({ open: true, area })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteDialog({ open: true, area })}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, area: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Temple Area</DialogTitle>
          </DialogHeader>
          <p className="text-stone-600">
            Are you sure you want to delete &quot;{deleteDialog.area?.name}&quot;? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, area: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <TempleAreaDialog
        open={editDialog.open}
        area={editDialog.area}
        onClose={() => setEditDialog({ open: false, area: null })}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-stone-900">{value}</div>
        <div className="text-sm text-stone-500">{label}</div>
      </div>
    </div>
  );
}

function TempleAreaDialog({
  open,
  area,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  area: TempleArea | null;
  onClose: () => void;
  onSave: (area: Partial<TempleArea>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<TempleArea>>({
    name: "",
    nameKannada: "",
    description: "",
    significance: "",
    icon: "🕉️",
    category: "sanctum",
    features: [],
    bestTimeToVisit: "",
    tips: [],
    order: 0,
  });

  useEffect(() => {
    if (area) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Form initialization
      setForm(area);
    } else {
      setForm({
        name: "",
        nameKannada: "",
        description: "",
        significance: "",
        icon: "🕉️",
        category: "sanctum",
        features: [],
        bestTimeToVisit: "",
        tips: [],
        order: 0,
      });
    }
  }, [area, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{area ? "Edit Temple Area" : "Add Temple Area"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Garbhagriha (Sanctum Sanctorum)"
                required
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="nameKannada">Name in Kannada</Label>
              <Input
                id="nameKannada"
                value={form.nameKannada || ""}
                onChange={(e) => setForm({ ...form, nameKannada: e.target.value })}
                placeholder="e.g., ಗರ್ಭಗೃಹ"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe this temple area..."
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="significance">Significance</Label>
              <textarea
                id="significance"
                value={form.significance || ""}
                onChange={(e) => setForm({ ...form, significance: e.target.value })}
                placeholder="What makes this area special?"
                className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value as TempleAreaCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input
                id="icon"
                value={form.icon || ""}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="🕉️"
                className="text-2xl"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="bestTimeToVisit">Best Time to Visit</Label>
              <Input
                id="bestTimeToVisit"
                value={form.bestTimeToVisit || ""}
                onChange={(e) => setForm({ ...form, bestTimeToVisit: e.target.value })}
                placeholder="e.g., 5:30 AM - 12:00 PM"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="features">Features (one per line)</Label>
              <textarea
                id="features"
                value={(form.features || []).join("\n")}
                onChange={(e) => setForm({ ...form, features: e.target.value.split("\n").filter(Boolean) })}
                placeholder={"Main Deity: Lord Venkateshwara\nGolden krubas (garlands)"}
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="tips">Visitor Tips (one per line)</Label>
              <textarea
                id="tips"
                value={(form.tips || []).join("\n")}
                onChange={(e) => setForm({ ...form, tips: e.target.value.split("\n").filter(Boolean) })}
                placeholder={"Maintain silence in the sanctum\nRemove footwear before entry"}
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {area ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
