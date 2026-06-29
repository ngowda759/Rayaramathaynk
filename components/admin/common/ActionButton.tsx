import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface ActionButtonProps {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "destructive";
}

export default function ActionButton({
  label,
  icon: Icon,
  onClick,
  variant = "default",
}: ActionButtonProps) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      className="gap-2 rounded-xl"
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </Button>
  );
}
