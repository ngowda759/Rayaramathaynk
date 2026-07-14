"use client";

import Link from "next/link";
import { ExternalLink, MessageSquareQuote } from "lucide-react";
import FormSection from "@/components/ui/form/FormSection";

export default function TestimonialsSection() {
  return (
    <FormSection
      title="Testimonials Section"
      description="Testimonials are now managed separately."
    >
      <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
            <MessageSquareQuote size={28} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-stone-900">
              Manage Testimonials Separately
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Testimonials are now managed independently. Go to the dedicated 
              Testimonials page to add, edit, or remove testimonials.
            </p>
            <Link
              href="/admin/testimonials"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              <ExternalLink size={16} />
              Go to Testimonials Page
            </Link>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
