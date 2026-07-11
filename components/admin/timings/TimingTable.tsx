"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock3,
  CheckCircle,
  XCircle,
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

import { TempleTiming } from "@/types/timing";
import { timingService } from "@/services/timing.service";

interface TimingTableProps {
  timings: TempleTiming[];
  onRefresh: () => void;
}

export default function TimingTable({ timings, onRefresh }: TimingTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await timingService.deleteTiming(deleteId);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete timing:", err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  async function moveOrder(id: string, direction: "up" | "down") {
    const index = timings.findIndex((t) => t.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === timings.length - 1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = timings[index];
    const swap = timings[swapIndex];

    try {
      await timingService.updateTiming(current.id, {
        order: swap.order,
      });
      await timingService.updateTiming(swap.id, {
        order: current.order,
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to reorder timing:", err);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await timingService.updateTiming(id, { isActive: !current });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle timing status:", err);
    }
  }

  return (
    <>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Timing</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  No temple timings found. Add a new timing to display it here.
                </TableCell>
              </TableRow>
            ) : (
              timings.map((timing, index) => (
                <TableRow key={timing.id}>
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
                          onClick={() => moveOrder(timing.id, "up")}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === timings.length - 1}
                          onClick={() => moveOrder(timing.id, "down")}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{timing.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {timing.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock3 className="h-4 w-4 text-muted-foreground" />
                      {timing.startTime} - {timing.endTime}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(timing.id, timing.isActive)}
                      className={
                        timing.isActive
                          ? "text-emerald-600 hover:text-emerald-700"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    >
                      {timing.isActive ? (
                        <>
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="mr-1.5 h-3.5 w-3.5" /> Inactive
                        </>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/timings/edit/${timing.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(timing.id)}
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
        <Dialog open onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Timing</DialogTitle>
              <DialogDescription>
                This will permanently remove the timing entry from the temple schedule.
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
