import Link from "next/link";
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
} from "react-icons/fa";

export default function SocialConnect() {
  return (
    <section className="bg-gradient-to-b from-amber-50 to-white py-16">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <span className="inline-block rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-amber-700">
          Connect With Sri Matha
        </span>

        <h2 className="mt-6 text-3xl font-bold text-stone-900 md:text-4xl">
          Stay Connected With Us
        </h2>

        <p className="mt-4 text-lg leading-8 text-stone-600">
          Receive temple updates, daily darshanas, sevas, festivals and
          spiritual content by following our official social media channels.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Facebook */}
          <Link
            href="https://www.facebook.com/srs.mutt.yelahanka.newtown"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-2xl border-2 border-stone-200 bg-white p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white">
                <FaFacebookF size={28} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-stone-900">Facebook Page</h3>
                <p className="text-sm text-stone-600">Sri Raghavendra Rayaru Yelahanka New Town</p>
              </div>
            </div>
            <span className="text-amber-600 font-semibold group-hover:translate-x-1 transition-transform">
              Visit →
            </span>
          </Link>

          {/* Instagram */}
          <Link
            href="https://www.instagram.com/srs_mutt_yelahanka_newtown"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-2xl border-2 border-stone-200 bg-white p-6 shadow-sm transition-all hover:border-pink-400 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white">
                <FaInstagram size={28} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-stone-900">Instagram Account</h3>
                <p className="text-sm text-stone-600">srs_mutt_yelahanka_newtown</p>
              </div>
            </div>
            <span className="text-amber-600 font-semibold group-hover:translate-x-1 transition-transform">
              Visit →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// Small icons component for above footer
export function SocialIcons() {
  return (
    <div className="flex items-center justify-center gap-4 py-6 bg-stone-50">
      <Link
        href="https://www.facebook.com/srs.mutt.yelahanka.newtown"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-all hover:scale-110 hover:shadow-lg"
        aria-label="Facebook"
      >
        <FaFacebookF size={22} />
      </Link>

      <Link
        href="https://www.instagram.com/srs_mutt_yelahanka_newtown"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-md transition-all hover:scale-110 hover:shadow-lg"
        aria-label="Instagram"
      >
        <FaInstagram size={22} />
      </Link>

      <Link
        href="https://www.youtube.com/@Guru_Raghavendra_Rayaru"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition-all hover:scale-110 hover:shadow-lg"
        aria-label="YouTube"
      >
        <FaYoutube size={22} />
      </Link>

      <Link
        href="#"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-md transition-all hover:scale-110 hover:shadow-lg"
        aria-label="WhatsApp"
      >
        <FaWhatsapp size={22} />
      </Link>
    </div>
  );
}
