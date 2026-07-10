"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TableActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;

  disableView?: boolean;
  disableEdit?: boolean;
  disableDelete?: boolean;
}

export default function TableActions({
  onView,
  onEdit,
  onDelete,
  disableView = false,
  disableEdit = false,
  disableDelete = false,
}: TableActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {onView && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onView}
          disabled={disableView}
          aria-label="View"
          title="View"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}

      {onEdit && (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onEdit}
          disabled={disableEdit}
          aria-label="Edit"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {onDelete && (
        <Button
          variant="destructive"
          size="icon-sm"
          onClick={onDelete}
          disabled={disableDelete}
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
