import type { Metadata } from "next";

import ContactClient from "@/components/contact/ContactClient";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Contact the Sri Raghavendra Swamy Matha temple office in Yelahanka New Town, Bengaluru for seva bookings, donations and general enquiries.",
  path: "/contact",
});

export default function ContactPage() {
  return <ContactClient />;
}
