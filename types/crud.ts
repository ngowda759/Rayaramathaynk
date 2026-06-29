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
   * Column title.
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
   */
  formatter?: (
    value: unknown,
    row: T
  ) => ReactNode;

  /**
   * Fully custom renderer.
   * Takes precedence over formatter/type.
   */
  render?: (
    row: T
  ) => ReactNode;

  /**
   * Used only when type === "actions".
   */
  actions?: {
    onView?: (row: T) => void;
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
  };
}

/**
 * Toolbar Props
 */
export interface CrudToolbarProps {
  search: string;

  onSearchChange: (
    value: string
  ) => void;

  searchPlaceholder?: string;

  addLabel?: string;

  addHref?: string;

  onRefresh?: () => void;

  actions?: ReactNode;

  loading?: boolean;
}

/**
 * Pagination Props
 */
export interface CrudPaginationProps {
  page: number;

  pageSize: number;

  total: number;

  onPageChange: (
    page: number
  ) => void;
}

/**
 * Delete Dialog Props
 */
export interface DeleteDialogProps {
  title: string;

  description: string;

  open: boolean;

  loading?: boolean;

  onCancel: () => void;

  onConfirm: () => void;
}

/**
 * Generic CRUD Action.
 */
export interface CrudAction<T> {
  label: string;

  icon?: ReactNode;

  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "destructive";

  onClick: (
    row: T
  ) => void;

  hidden?: (
    row: T
  ) => boolean;

  disabled?: (
    row: T
  ) => boolean;
}

/**
 * Generic CRUD Page Props.
 */
export interface CrudPageProps<T> {
  title: string;

  description?: string;

  data: T[];

  columns: CrudColumn<T>[];

  loading?: boolean;

  search: string;

  onSearchChange: (
    value: string
  ) => void;

  searchPlaceholder?: string;

  addLabel?: string;

  addHref?: string;

  onRefresh?: () => void;
}
