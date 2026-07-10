import { GoUpButton } from "@/components/ui/GoUpButton";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <GoUpButton />
    </>
  );
}
