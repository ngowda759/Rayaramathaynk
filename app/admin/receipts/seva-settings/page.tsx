"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import FormDialog from "@/components/admin/common/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { receiptSevaService } from "@/services/receiptSeva.service";
import { ReceiptSeva, ReceiptSevaInput } from "@/types/receiptSeva";
import { validateReceiptSevaInput } from "@/lib/receipt/validation";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface DialogState {
  mode: "create" | "edit";
  seva: ReceiptSeva |
    null;
}

const emptyForm: ReceiptSevaInput = {
  name: "",
  description: "",
  amount: 0,
  active: true,
  displayOrder: 0,
};

export default function SevaSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [sevas, setSevas] = useState<ReceiptSeva[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [form, setForm] = useState<ReceiptSevaInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadSevas = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const data = await receiptSevaService.getAllSevas(token);
      setSevas([...data].sort((a,b) => a.displayOrder - b.displayOrder));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load seva catalogue.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSevas();
  }, [loadSevas]);

  function openCreate() {
    setForm({ ...emptyForm, displayOrder: sevas.length + 1 });
    setDialog({ mode: "create", seva: null });
  }

  function openEdit(seva: ReceiptSeva) {
    setForm({
      name: seva.name,
      description: seva.description,
      amount: seva.amount,
      active: seva.active,
      displayOrder: seva.displayOrder,
    });
    setDialog({ mode: "edit", seva });
  }

  function updateField<K extends keyof ReceiptSevaInput>(field: K, value: ReceiptSevaInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!user || !dialog) return;

    const errors = validateReceiptSevaInput(form);
    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error));
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      if (dialog.mode === "create") {
        await receiptSevaService.createSeva({ ...form, name: form.name.trim(), description: form.description.trim() }, token);
        toast.success("Seva added successfully.");
      } else if (dialog.seva) {
        await receiptSevaService.updateSeva(dialog.seva.id, form, token);
        toast.success("Seva updated successfully.");
      }
      setDialog(null);
      await loadSevas();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save seva.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(seva: ReceiptSeva) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await receiptSevaService.updateSeva(seva.id, { active: !seva.active }, token);
      toast.success(!seva.active ? "Seva enabled." : "Seva disabled.");
      await loadSevas();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update seva.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/receipts"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <AdminPageHeader
            title="Seva Settings"
            description="Manage the seva prices and catalogue used for receipts."
          />
        </div>
        <Button onClick={openCreate} className="bg-orange-600 hover:bg-orange-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Seva
        </Button>
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm text-stone-500">
        Sevas used in past receipts can never be deleted — disable them instead. Prices are
        snapshotted into receipts atthe time of issuance, so changing a price never alters old receipts.

      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-stone-500">
          Loading sevas...
        </div>
      ) : sevas.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <p className="text-stone-500">No sevas in the catalogue yet.</p>
          <Button onClick={openCreate} className="mt-4 bg-orange-600 hover:bg-orange-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Seva
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Seva</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {sevas.map((seva) => (
                  <tr key={seva.id} className="hover:bg-stone-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                      {seva.displayOrder}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{seva.name}</p>
                    </td>
                    <td className="max-w-md px-4 py-3 text-sm text-stone-500">
                      {seva.description || "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-stone-900">
                      {formatCurrency(seva.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(seva)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          seva.active ? "bg-green-500" : "bg-stone-300"
                        }`}
                        title={seva.active ? "Disable seva" : "Enable seva"}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            seva.active ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(seva)}>
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormDialog
        open={dialog !== null}
        title={dialog?.mode === "edit" ? "Edit Seva" : "Add Seva"}
        onClose={() => setDialog(null)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Seva Name *
            </label>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Panchamrutha Seva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Amount (₹) *
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.amount}
              onChange={(e) => updateField("amount", Number(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Description
            </label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Short description of the seva"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Display Order
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.displayOrder}
              onChange={(e) => updateField("displayOrder", Number(e.target.value) || 0)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} loading={saving} className="bg-orange-600 hover:bg-orange-700">
              {dialog?.mode === "edit" ? "Save Changes" : "Add Seva"}
            </Button>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}