import { ReactNode } from "react";

import StatusBadge from "./StatusBadge";
import TableActions from "./TableActions";

import { CrudColumn } from "@/types/crud";
import {
  formatBoolean,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/format";

interface CrudTableCellProps<T> {
  row: T;
  column: CrudColumn<T>;
}

export default function CrudTableCell<T>({
  row,
  column,
}: CrudTableCellProps<T>) {
  const value = (row as Record<string, unknown>)[column.key as string];

  // Highest priority: fully custom renderer
  if (column.render) {
    return <>{column.render(row)}</>;
  }

  // Second priority: simple formatter
  if (column.formatter) {
    return <>{column.formatter(value, row)}</>;
  }

  switch (column.type) {
    case "currency":
      return <>{formatCurrency(Number(value ?? 0))}</>;

    case "number":
      return <>{formatNumber(Number(value ?? 0))}</>;

    case "date":
      return value ? <>{formatDate(value as string | Date)}</> : <>-</>;

    case "datetime":
      return value ? <>{formatDateTime(value as string | Date)}</> : <>-</>;

    case "boolean":
      return <>{formatBoolean(Boolean(value))}</>;

    case "status":
      return <StatusBadge status={String(value ?? "")} />;

    case "image":
      return value ? (
        <img
          src={String(value)}
          alt=""
          className="h-12 w-12 rounded-lg object-cover"
        />
      ) : (
        <>-</>
      );

    case "actions":
      return (
        <TableActions
          onView={column.actions?.onView ? () => column.actions!.onView!(row) : undefined}
          onEdit={column.actions?.onEdit ? () => column.actions!.onEdit!(row) : undefined}
          onDelete={column.actions?.onDelete ? () => column.actions!.onDelete!(row) : undefined}
        />
      );

    case "text":
    default:
      return <>{(value as ReactNode) ?? "-"}</>;
  }
}
