"use client";

import { useRef, useState, useEffect } from "react";
import { Printer } from "lucide-react";
import Button from "@/components/ui/button";

interface SevaReceiptProps {
  receiptNumber: string;
  date: string;
  devoteeName: string;
  phone: string;
  sevaDate: string;
  sevaTitle: string;
  sevaAmount: number;
  paymentReference: string;
  onClose: () => void;
}

export default function SevaReceipt({
  receiptNumber,
  date,
  devoteeName,
  phone,
  sevaDate,
  sevaTitle,
  sevaAmount,
  paymentReference,
  onClose,
}: SevaReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [receiptId, setReceiptId] = useState<string>('');

  useEffect(() => {
    if (receiptRef.current) {
      setReceiptId(receiptRef.current.id);
    }
  }, []);

  const amountInWords = numberToWords(sevaAmount);

  function printReceipt() {
    const printContent = receiptRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;

    if (printContent) {
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-4 text-white text-center">
          <h2 className="text-xl font-bold">ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ (ರಿ)</h2>
          <p className="text-sm opacity-90 mt-1">Sri Gururaja Seva Samiti (R)</p>
          <p className="text-xs mt-1">No. 05, Kere Cross, Yelahanka Upanagara, Bengaluru – 64</p>
          <p className="text-xs">Phone: 99002 15389</p>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-orange-800 border-b-2 border-orange-300 pb-2 inline-block">
              ಸೇವಾ ರಸೀದಿ / SEVA RECEIPT
            </h3>
          </div>

          <div className="space-y-3 text-sm">
            {/* Row 1 */}
            <div className="grid grid-cols-2 gap-4 border-b border-dotted border-stone-300 pb-2">
              <div>
                <span className="text-stone-500">Receipt No. / ರಸೀದಿ ಸಂಖ್ಯೆ:</span>
                <span className="ml-2 font-medium">{receiptNumber}</span>
              </div>
              <div>
                <span className="text-stone-500">Date / ದಿನಾಂಕ:</span>
                <span className="ml-2 font-medium">{date}</span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="border-b border-dotted border-stone-300 pb-2">
              <span className="text-stone-500">Name / ಹೆಸರು (ಶ್ರೀಮತಿ/ಶ್ರೀ):</span>
              <span className="ml-2 font-medium">{devoteeName}</span>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-2 gap-4 border-b border-dotted border-stone-300 pb-2">
              <div>
                <span className="text-stone-500">Gotra / ಗೋತ್ರ:</span>
                <span className="ml-2">_________________</span>
              </div>
              <div>
                <span className="text-stone-500">Nakshatra / ನಕ್ಷತ್ರ:</span>
                <span className="ml-2">_________________</span>
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-2 gap-4 border-b border-dotted border-stone-300 pb-2">
              <div>
                <span className="text-stone-500">Phone No. / ಫೋನ್ ಸಂಖ್ಯೆ:</span>
                <span className="ml-2 font-medium">{phone || "_________________"}</span>
              </div>
              <div>
                <span className="text-stone-500">Payment Ref:</span>
                <span className="ml-2 font-mono text-xs">{paymentReference}</span>
              </div>
            </div>

            {/* Seva Details */}
            <div className="bg-orange-50 rounded-lg p-4 mt-4 border border-orange-200">
              <h4 className="font-bold text-orange-800 mb-3">ಸೇವಾ ವಿವರಗಳು / Seva Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Seva Date / ಸೇವಾ ದಿನಾಂಕ:</span>
                  <span className="font-medium">{sevaDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Seva Type / ಸೇವಾ ಪ್ರಕಾರ:</span>
                  <span className="font-medium">{sevaTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Seva Amount / ಮೊತ್ತ:</span>
                  <span className="font-bold text-green-700 text-lg">₹{sevaAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Amount in Words / ಮೊತ್ತ ಪದಗಳಲ್ಲಿ:</span>
                  <span className="font-medium italic">{amountInWords}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="grid grid-cols-2 gap-8 mt-6 pt-4 border-t border-stone-300">
              <div>
                <p className="text-stone-500 text-xs mb-8">Receipt Issue / ರಸೀದಿ ನೀಡಿದ ದಿನಾಂಕ</p>
                <p className="text-center text-stone-400">________________</p>
              </div>
              <div>
                <p className="text-stone-500 text-xs mb-8">Receiver Signature / ಸ್ವೀಕರಿಸುವವರ ಸಹಿ</p>
                <p className="text-center text-stone-400">________________</p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-6 text-center text-xs text-stone-500 border-t border-stone-200 pt-4">
            <p>ಧನ್ಯವಾದಗಳು / Thank you for your generous contribution</p>
            <p className="mt-1">ದಯವಿಟ್ಟು ರಸೀದಿಯನ್ನು ಉಳಿಸಿಕೊಳ್ಳಿರಿ / Please retain this receipt</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={printReceipt} className="bg-orange-600 hover:bg-orange-700">
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          ${receiptId ? `#${receiptId}, #${receiptId} *` : '.receipt-content, .receipt-content *'} {
            visibility: visible;
          }
          ${receiptId ? `#${receiptId}` : '.receipt-content'} {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function numberToWords(num: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  if (num === 0) return "Zero";

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  };

  return convert(num) + " Rupees Only";
}
