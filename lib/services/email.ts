import nodemailer from "nodemailer";
import { Receipt } from "@/types/receipt";
import { buildReceiptPdf } from "@/lib/receipt/pdf";

export async function sendEmail(receipt: Receipt) {
  const emailHost = process.env.EMAIL_HOST;
  const emailPort = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailFrom = process.env.EMAIL_FROM || "info@rayaramathaynk.com";

  if (!emailHost || !emailUser || !emailPass) {
    throw new Error("Email provider not configured");
  }

  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  const pdfBytes = await buildReceiptPdf(receipt);
  const pdfBuffer = Buffer.from(pdfBytes);

  const subject = `Rayaramatha Receipt - ${receipt.receiptNumber}`;

  let sevaDetails = "";
  receipt.items.forEach(item => {
    sevaDetails += `${item.sevaName}\nQuantity: ${item.quantity}\nAmount: ₹${item.amount}\n\n`;
  });

  const text = `Sri Raghavendra Swamy Matha

Dear ${receipt.devoteeName},

Thank you for your seva.

Receipt Number: ${receipt.receiptNumber}

Seva details:
${sevaDetails}Total: ₹${receipt.totalAmount}

Payment Mode: ${receipt.paymentMode === "upi" ? "UPI" : receipt.paymentMode.toUpperCase()}

Payment Reference:
${receipt.paymentReference || "-"}
`;

  await transporter.sendMail({
    from: emailFrom,
    to: receipt.devoteeEmail,
    subject,
    text,
    attachments: [
      {
        filename: `${receipt.receiptNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}
