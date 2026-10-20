export interface NavigationItem {
  title: string;
  href: string;
  icon: string;
  /** Kannada label, shown on its own line under the English (seva items). */
  titleKn?: string;
  /** Sub-items shown under this item (Receipt Book's pages per role). */
  children?: NavigationItem[];
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}
