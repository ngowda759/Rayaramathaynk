import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { XCircle, Heart, RefreshCcw } from "lucide-react";

export default function DonationFailurePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-red-50 to-white flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <div className="mb-8">
            <XCircle className="mx-auto h-24 w-24 text-red-500" />
          </div>
          
          <h1 className="text-4xl font-bold text-stone-900 mb-4">
            Donation Could Not Be Processed
          </h1>
          
          <p className="text-lg text-stone-600 mb-8">
            We encountered an issue processing your donation. 
            No money has been deducted from your account.
          </p>
          
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <p className="text-stone-600 mb-4">
              This could be due to:
            </p>
            <ul className="text-left text-stone-600 space-y-2">
              <li>• Network connectivity issues</li>
              <li>• Payment gateway timeout</li>
              <li>• Invalid payment details</li>
            </ul>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/donation"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-8 py-4 font-semibold text-white shadow-lg transition-all hover:scale-105"
            >
              <RefreshCcw className="h-5 w-5" />
              Try Again
            </Link>
            
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-stone-300 px-8 py-4 font-semibold text-stone-700 transition-all hover:border-amber-500 hover:text-amber-600"
            >
              Return to Home
            </Link>
          </div>
          
          <p className="mt-8 text-sm text-stone-500">
            If the problem persists, please contact us at{" "}
            <a href="mailto:contact@sriraghavendra.org" className="text-amber-600 hover:underline">
              contact@sriraghavendra.org
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
