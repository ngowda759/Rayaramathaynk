import { GoUpButton } from "@/components/ui/GoUpButton";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PageViewTracker />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <GoUpButton />
    </>
  );
}
