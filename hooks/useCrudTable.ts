"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

interface UseCrudTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
}

export function useCrudTable<T>({
  data,
  columns,
}: UseCrudTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return {
    table,
    flexRender,
  };
}
