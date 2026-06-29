import SidebarItem from "./SidebarItem";

interface Props {
  title: string;
  items: any[];
}

export default function SidebarGroup({
  title,
  items,
}: Props) {
  return (
    <div className="space-y-2">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>

      <div className="space-y-1">
        {items.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}
      </div>
    </div>
  );
}
