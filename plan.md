1. Add `emailDelivery` and `whatsappDelivery` to `types/receipt.ts`
2. Enhance `createReceiptWithAdmin` to include `emailDelivery` and `whatsappDelivery` initial status in the created document ("pending" or "not_requested").
3. Create a background task or run the delivery synchronously inside the POST `/api/admin/receipts` after receipt creation. Let's do it right after creation. The instruction says: "Receipt creation and notification delivery must be independent. Do NOT roll back/delete the receipt because notification delivery failed." So we can try sending notifications and update the receipt document with the status (`sent` or `failed`).
4. Update `app/admin/receipts/[receiptId]/page.tsx` to display delivery status and add "Send Email" / "Send WhatsApp" buttons that call the manual resend endpoint.
5. Implement the manual resend endpoint at `app/api/admin/receipts/[id]/send/route.ts` which takes a type (`email` or `whatsapp`), loads the receipt, attempts delivery, and updates the document status.
6. Make sure environment variables checking in services (lib/services/email.ts, lib/services/whatsapp.ts) allows the app to work gracefully when missing, marking status as "failed" with proper error message.
7. Run tests, lint, typecheck, build.
