import { ReactNode } from "react";

import StatusBadge from "./StatusBadge";
import TableActions from "./TableActions";

import {
  CrudColumn,
  CrudTableActions,
} from "@/types/crud";

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
  actions?: CrudTableActions<T>;
}

export default function CrudTableCell<T>({
  row,
  column,
  actions,
}: CrudTableCellProps<T>) {
  const value = (row as Record<string, unknown>)[String(column.key)];

  /**
   * Highest priority:
   * Fully custom renderer.
   */
  if (column.render) {
    return <>{column.render(row)}</>;
  }

  /**
   * Second priority:
   * Custom formatter.
   */
  if (column.formatter) {
    return <>{column.formatter(value, row)}</>;
  }

  switch (column.type) {
    case "currency":
      return <>{formatCurrency(Number(value ?? 0))}</>;

    case "number":
      return <>{formatNumber(Number(value ?? 0))}</>;

    case "date":
      return value ? (
        <>{formatDate(value as string | Date)}</>
      ) : (
        <>-</>
      );

    case "datetime":
      return value ? (
        <>{formatDateTime(value as string | Date)}</>
      ) : (
        <>-</>
      );

    case "boolean":
      return <>{formatBoolean(Boolean(value))}</>;

    case "status":
      return (
        <StatusBadge
          status={String(value ?? "")}
        />
      );

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
          onView={
            actions?.onView
              ? () => actions.onView!(row)
              : undefined
          }
          onEdit={
            actions?.onEdit
              ? () => actions.onEdit!(row)
              : undefined
          }
          onDelete={
            actions?.onDelete
              ? () => actions.onDelete!(row)
              : undefined
          }
        />
      );

    case "custom":
    case "text":
    default:
      return (
        <>
          {(value as ReactNode) ?? "-"}
        </>
      );
  }
}
