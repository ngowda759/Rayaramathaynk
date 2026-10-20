import { redirect } from "next/navigation";

import { SEVA_ROUTES } from "@/lib/seva/routes";

/** Settings opens on its first tab, Receipts (template and numbering, DB §13.2). */
export default function ReceiptSettingsIndexPage(): never {
  redirect(SEVA_ROUTES.settingsReceipt);
}
