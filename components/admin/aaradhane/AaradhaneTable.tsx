"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Calendar,
  Sparkles,
  List,
  Gift,
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

import { Aaradhane } from "@/types/aaradhane";
import { aaradhaneService } from "@/services/aaradhane.service";

interface AaradhaneTableProps {
  items: Aaradhane[];
  onRefresh: () => void;
}

export default function AaradhaneTable({ items, onRefresh }: AaradhaneTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailItem, setDetailItem] = useState<Aaradhane | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await aaradhaneService.deleteAaradhane(deleteId);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete aaradhane:", err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  async function moveOrder(id: string, direction: "up" | "down") {
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === items.length - 1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = items[index];
    const swap = items[swapIndex];

    try {
      await aaradhaneService.updateAaradhane(current.id, {
        displayOrder: swap.displayOrder,
      });
      await aaradhaneService.updateAaradhane(swap.id, {
        displayOrder: current.displayOrder,
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  }

  function formatDate(dateStr?: string | string[]) {
    if (!dateStr) return "";
    if (Array.isArray(dateStr)) {
      return dateStr.map(d => {
        const date = new Date(d);
        if (isNaN(date.getTime())) return "";
        return date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }).join(", ");
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Guru</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rituals</TableHead>
              <TableHead>Offerings</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  No aaradhanes found. Add your first record.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={item.id}>
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
                          onClick={() => moveOrder(item.id, "up")}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === items.length - 1}
                          onClick={() => moveOrder(item.id, "down")}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.title}</div>
                    <div className="max-w-xs truncate text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{item.guruName}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col gap-1 text-xs">
                      {item.dates && item.dates.length > 0 ? (
                        item.dates.map((d, i) => (
                          <span key={i} className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(d)}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">No date</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        item.isUpcoming
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {item.isUpcoming ? (
                        <>
                          <Sparkles className="mr-1 h-3 w-3" />
                          Upcoming
                        </>
                      ) : (
                        "Past"
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <List className="h-3.5 w-3.5" />
                      {item.rituals?.length || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Gift className="h-3.5 w-3.5" />
                      {item.offerings?.length || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetailItem(item)}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/aaradhane/edit/${item.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
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
              <DialogTitle>Delete Aaradhane</DialogTitle>
              <DialogDescription>
                This will permanently remove this aaradhane record.
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

      {detailItem && (
        <Dialog open onOpenChange={() => setDetailItem(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{detailItem?.title}</DialogTitle>
              <DialogDescription>
                {detailItem?.guruName} &mdash; {detailItem?.dates ? formatDate(detailItem.dates) : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium">Description</h4>
                <p className="text-sm text-muted-foreground">{detailItem?.description}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium">Significance</h4>
                <p className="text-sm text-muted-foreground">{detailItem?.significance}</p>
              </div>
              {detailItem?.rituals.length ? (
                <div>
                  <h4 className="text-sm font-medium">Rituals</h4>
                  <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                    {detailItem.rituals.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {detailItem?.offerings.length ? (
                <div>
                  <h4 className="text-sm font-medium">Offerings</h4>
                  <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                    {detailItem.offerings.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
