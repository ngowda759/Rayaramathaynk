export interface NavigationItem {
  title: string;
  href: string;
  icon: string;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}
