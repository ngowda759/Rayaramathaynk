"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Power,
  PowerOff,
  Clock,
  IndianRupee,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { DailyPooja } from "@/types/pooja";
import { poojaService } from "@/services/pooja.service";

interface PoojaTableProps {
  poojas: DailyPooja[];
  onRefresh: () => void;
}

export default function PoojaTable({ poojas, onRefresh }: PoojaTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await poojaService.deletePooja(deleteId);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete pooja:", err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  async function moveOrder(id: string, direction: "up" | "down") {
    const index = poojas.findIndex((p) => p.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === poojas.length - 1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = poojas[index];
    const swap = poojas[swapIndex];

    try {
      await poojaService.updatePooja(current.id, {
        displayOrder: swap.displayOrder,
      });
      await poojaService.updatePooja(swap.id, {
        displayOrder: current.displayOrder,
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await poojaService.updatePooja(id, { isActive: !current });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle active:", err);
    }
  }

  function formatDays(days: string[]) {
    if (days.includes("All") || days.length === 7) return "All Days";
    if (days.length <= 3) return days.join(", ");
    return `${days.length} days`;
  }

  return (
    <>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Pooja</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Seva</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {poojas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  No poojas found. Add your first daily pooja.
                </TableCell>
              </TableRow>
            ) : (
              poojas.map((pooja, index) => (
                <TableRow key={pooja.id}>
                  <TableCell>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => moveOrder(pooja.id, "up")}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === poojas.length - 1}
                          onClick={() => moveOrder(pooja.id, "down")}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{pooja.title}</div>
                    <div className="max-w-xs truncate text-xs text-muted-foreground">
                      {pooja.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {pooja.startTime}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pooja.duration}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                      {pooja.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    {pooja.sevaAmount > 0 ? (
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <IndianRupee className="h-3.5 w-3.5" />
                        {pooja.sevaAmount.toLocaleString("en-IN")}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDays(pooja.days)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(pooja.id, pooja.isActive)}
                      className={
                        pooja.isActive
                          ? "text-green-600 hover:text-green-700"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    >
                      {pooja.isActive ? (
                        <>
                          <Power className="mr-1.5 h-3.5 w-3.5" />
                          Active
                        </>
                      ) : (
                        <>
                          <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                          Inactive
                        </>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/pooja/edit/${pooja.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(pooja.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {deleteId && (
        <Dialog open={true} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Pooja</DialogTitle>
              <DialogDescription>
                This will permanently remove this pooja from the daily schedule.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
