import { redirect } from "next/navigation";

import { SEVA_ROUTES } from "@/lib/seva/routes";

/**
 * The Firestore Receipt Book's create form is retired (DB §17.2): receipts are made at the counter, so this address
 * forwards there.
 */
export default function CreateReceiptPage(): never {
  redirect(SEVA_ROUTES.counter);
}
