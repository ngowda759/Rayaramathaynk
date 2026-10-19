import { redirect } from "next/navigation";

/** Settings opens on its first tab, Receipts (template and numbering, DB §13.2). */
export default function ReceiptSettingsIndexPage(): never {
  redirect("/admin/receipts/settings/receipt");
}
