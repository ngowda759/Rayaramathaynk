export type DeliveryStatus = "not_requested" | "pending" | "sent" | "failed";

export interface DeliveryInfo {
  status: DeliveryStatus;
  sentAt?: string;
  error?: string;
}

export interface ReceiptDelivery {
  emailDelivery?: DeliveryInfo;
  whatsappDelivery?: DeliveryInfo;
}
