import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { CheckCircle, Heart, Home } from "lucide-react";

export default function DonationSuccessPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <div className="mb-8">
            <CheckCircle className="mx-auto h-24 w-24 text-green-500" />
          </div>
          
          <h1 className="text-4xl font-bold text-stone-900 mb-4">
            Thank You for Your Donation!
          </h1>
          
          <p className="text-lg text-stone-600 mb-8">
            Your generous contribution has been received. 
            A receipt has been sent to your email address.
          </p>
          
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Heart className="h-6 w-6 text-amber-600" />
              <span className="text-lg font-semibold text-stone-700">Your Support Matters</span>
            </div>
            <p className="text-stone-600">
              Your donation helps maintain the sacred temple, support daily rituals, 
              and serve the devotees community. We are deeply grateful for your kindness.
            </p>
          </div>
          
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-8 py-4 font-semibold text-white shadow-lg transition-all hover:scale-105"
          >
            <Home className="h-5 w-5" />
            Return to Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
