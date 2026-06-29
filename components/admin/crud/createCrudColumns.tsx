import { ColumnDef } from "@tanstack/react-table";

import CrudTableCell from "./CrudTableCell";

import {
  CrudColumn,
  CrudTableActions,
} from "@/types/crud";

/**
 * Converts framework CRUD columns
 * into TanStack Column Definitions.
 */
export function createCrudColumns<T>(
  columns: CrudColumn<T>[],
  actions?: CrudTableActions<T>
): ColumnDef<T>[] {
  return columns.map((column) => ({
    id: String(column.key),

    accessorFn: (row: T) =>
      (row as Record<string, unknown>)[String(column.key)],

    header: () => (
      <span className="font-semibold text-stone-700">
        {column.header}
      </span>
    ),

    cell: ({ row }) => (
      <CrudTableCell
        row={row.original}
        column={column}
        actions={actions}
      />
    ),

    enableSorting: column.sortable ?? false,
  }));
}
