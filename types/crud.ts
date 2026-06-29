import { ReactNode } from "react";

/**
 * Supported built-in column types.
 */
export type CrudColumnType =
  | "text"
  | "number"
  | "currency"
  | "status"
  | "date"
  | "datetime"
  | "boolean"
  | "image"
  | "actions"
  | "custom";

/**
 * Generic CRUD column definition.
 */
export interface CrudColumn<T> {
  /**
   * Property name from the data model.
   */
  key: keyof T | string;

  /**
   * Column heading.
   */
  header: string;

  /**
   * Built-in renderer.
   */
  type?: CrudColumnType;

  /**
   * Optional width.
   */
  width?: string;

  /**
   * Text alignment.
   */
  align?: "left" | "center" | "right";

  /**
   * Enable sorting.
   */
  sortable?: boolean;

  /**
   * Optional custom formatter.
   * Receives the cell value and the full row.
   */
  formatter?: (
    value: unknown,
    row: T
  ) => ReactNode;

  /**
   * Fully custom renderer.
   * Takes precedence over formatter and type.
   */
  render?: (
    row: T
  ) => ReactNode;
}

/**
 * Row-level actions supported by CrudTable.
 * These are passed to the table itself,
 * not defined inside individual columns.
 */
export interface CrudTableActions<T> {
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

/**
 * Generic toolbar action.
 * Can be used for Export, Import, Print, etc.
 */
export interface CrudAction<T = unknown> {
  label: string;

  icon?: ReactNode;

  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "destructive";

  onClick: (row: T) => void;

  hidden?: (row: T) => boolean;

  disabled?: (row: T) => boolean;
}
