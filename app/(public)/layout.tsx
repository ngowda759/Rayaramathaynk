import { GoUpButton } from "@/components/ui/GoUpButton";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <GoUpButton />
    </>
  );
}
