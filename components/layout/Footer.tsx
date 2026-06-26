import { MapPin, Phone, Mail } from "lucide-react";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-stone-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-6 py-16 grid gap-10 md:grid-cols-4">
        {/* Temple */}
        <div>
          <h3 className="text-xl font-bold text-white">
            Sri Raghavendra Swamy Temple
          </h3>

          <p className="mt-4 text-sm leading-7">
            Dedicated to the worship of Sri Raghavendra Swamy and preservation
            of Sanatana Dharma.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="mb-4 font-semibold text-white">Quick Links</h4>

          <ul className="space-y-2">
            <li>Home</li>
            <li>Events</li>
            <li>Gallery</li>
            <li>Sevas</li>
            <li>Donate</li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="mb-4 font-semibold text-white">Contact</h4>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              Bengaluru, Karnataka
            </div>

            <div className="flex items-center gap-2">
              <Phone size={16} />
              +91 XXXXX XXXXX
            </div>

            <div className="flex items-center gap-2">
              <Mail size={16} />
              info@rayaramatha.org
            </div>
          </div>
        </div>

        {/* Social */}
        <div>
          <h4 className="mb-4 font-semibold text-white">Follow Us</h4>

          <div className="flex gap-4 text-2xl">
            <FaFacebookF className="cursor-pointer hover:text-orange-400" />
            <FaInstagram className="cursor-pointer hover:text-orange-400" />
            <FaYoutube className="cursor-pointer hover:text-orange-400" />
          </div>
        </div>
      </div>

      <div className="border-t border-stone-700 py-5 text-center text-sm">
        © {new Date().getFullYear()} Sri Raghavendra Swamy Temple. All Rights
        Reserved.
      </div>
    </footer>
  );
}
