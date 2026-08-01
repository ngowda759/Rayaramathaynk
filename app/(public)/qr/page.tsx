"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import SacredDivider from "@/components/home/SacredDivider";
import { useURLQRCodeGenerator, URLQRCodeData, generateURLQRCodeDataUrl } from "@/lib/device/qr/QRCode";
import { Button } from "@/components/ui/button";
import { Download, Share2, Printer } from "lucide-react";
import { useShare } from "@/lib/device";
import toast from "react-hot-toast";

// Default URLs - can be configured via environment variables
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rayaramathaynk.com";
const TESTIMONIALS_SUBMIT_URL = `${SITE_URL}/testimonials/submit`;

interface QRCodeCardProps {
  data: URLQRCodeData;
  size?: number;
}

function QRCodeCard({ data, size = 280 }: QRCodeCardProps) {
  const { qrDataUrl, isLoading, error } = useURLQRCodeGenerator(data, size);
  const share = useShare();

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${data.type}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("QR code downloaded");
  };

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${data.title} - QR Code</title>
          <style>
            body { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              font-family: Arial, sans-serif;
            }
            h1 { color: #1c1917; margin-bottom: 10px; }
            p { color: #78716c; margin-bottom: 20px; }
            img { border: 4px solid #e7e5e4; border-radius: 8px; }
            .footer { margin-top: 20px; font-size: 12px; color: #a8a29e; }
          </style>
        </head>
        <body>
          <h1>${data.title}</h1>
          <p>${data.description || ""}</p>
          <img src="${qrDataUrl}" alt="${data.title}" width="${size}" height="${size}" />
          <p class="footer">Sri Raghavendra Swamy Matha, Yelahanka</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleShare = async () => {
    if (!qrDataUrl) return;
    const response = await fetch(qrDataUrl);
    const blob = await response.blob();
    const file = new File([blob], `${data.type}-qr-code.png`, { type: "image/png" });

    const success = await share.share({
      title: data.title,
      text: `Scan this QR code to ${data.description?.toLowerCase() || "visit our website"}`,
      files: [file],
    });

    if (success) {
      toast.success("QR code shared");
    }
  };

  return (
    <div className="rounded-3xl border border-amber-200 bg-white p-8 shadow-xl text-center">
      {isLoading ? (
        <div className="flex items-center justify-center h-[280px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-[280px] text-red-500">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border-4 border-amber-100 bg-white p-4 shadow-lg inline-block">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR Code for ${data.title}`}
              width={size}
              height={size}
              className="h-full w-full"
            />
          )}
        </div>
      )}

      <h3 className="mt-6 text-2xl font-bold text-stone-900">{data.title}</h3>
      <p className="mt-2 text-stone-600">{data.description}</p>
      <p className="mt-1 font-mono text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full inline-block">
        {data.url}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="w-4 h-4" />
          Download
        </Button>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Print
        </Button>
        <Button variant="outline" onClick={handleShare} className="gap-2">
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </div>
    </div>
  );
}

export default function QRPage() {
  const websiteQRData: URLQRCodeData = {
    type: "public-page",
    url: SITE_URL,
    title: "Sri Raghavendra Swamy Matha",
    description: "Scan to visit our website",
  };

  const testimonialsQRData: URLQRCodeData = {
    type: "testimonials-submit",
    url: TESTIMONIALS_SUBMIT_URL,
    title: "Share Your Experience",
    description: "Scan to submit your testimonial",
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-[#fff8ef]">
        
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-100">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <Breadcrumb current="QR Codes" />
            
            <div className="text-center mt-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
                📱 CONNECT WITH US
              </span>
              
              <h1 className="mt-6 text-4xl md:text-5xl font-bold text-stone-900">
                QR Codes
              </h1>
              
              <p className="mt-4 mx-auto max-w-2xl text-lg leading-8 text-stone-600">
                Scan these QR codes with your phone camera to quickly access our website 
                or submit your testimonial. Print and display at your convenience.
              </p>
            </div>
          </div>
        </section>

        <SacredDivider variant="lotus" />

        {/* QR Codes Section */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-12 md:grid-cols-2">
            {/* Website QR Code */}
            <QRCodeCard data={websiteQRData} />

            {/* Testimonials Submission QR Code */}
            <QRCodeCard data={testimonialsQRData} />
          </div>
        </section>

        {/* Instructions Section */}
        <section className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-8 text-center">
            <h2 className="text-2xl font-bold text-stone-900 mb-4">
              How to Use
            </h2>
            <div className="grid gap-6 md:grid-cols-2 text-left">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900">Open Camera</h3>
                  <p className="text-sm text-stone-600">
                    Open your phone&apos;s camera app and point it at the QR code
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900">Tap the Link</h3>
                  <p className="text-sm text-stone-600">
                    Tap the notification that appears to open the website
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900">Share Your Story</h3>
                  <p className="text-sm text-stone-600">
                    Fill out the form and share your spiritual experience
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900">Stay Connected</h3>
                  <p className="text-sm text-stone-600">
                    Bookmark the site to stay updated with events and activities
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Print Instructions */}
        <section className="mx-auto max-w-3xl px-6 pb-16 text-center">
          <p className="text-stone-600">
            💡 <strong>Tip:</strong> Click &quot;Print&quot; to create a printout of the QR codes. 
            Display them at your home or office to share with friends and family.
          </p>
        </section>

        <SacredDivider variant="diya" />

      </main>
      <Footer />
    </>
  );
}
