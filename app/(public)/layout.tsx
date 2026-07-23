import { GoUpButton } from "@/components/ui/GoUpButton";
import { VercelAnalytics } from "@/components/analytics/VercelAnalytics";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <VercelAnalytics />
      <PageViewTracker />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <GoUpButton />
    </>
  );
}
