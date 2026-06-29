import { ColumnDef } from "@tanstack/react-table";

import CrudTableCell from "@/components/admin/crud/CrudTableCell";
import { CrudColumn } from "@/types/crud";

/**
 * Converts framework CRUD columns into TanStack columns.
 */
export function createCrudColumns<T>(
  columns: CrudColumn<T>[]
): ColumnDef<T>[] {
  return columns.map((column) => ({
    id: String(column.key),

    accessorFn: (row) =>
      (row as Record<string, unknown>)[String(column.key)],

    header: column.header,

    cell: ({ row }) => (
      <CrudTableCell
        row={row.original}
        column={column}
      />
    ),
  }));
}
