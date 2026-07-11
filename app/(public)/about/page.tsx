import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { Building2, Users, Heart, Calendar, BookOpen, MapPin, Phone, Mail } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-amber-50 to-white">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <Breadcrumb current="About Us" parentHref="/" parentName="Home" />
            <div className="text-center mt-4">
              <div className="inline-block mb-4">
                <p className="text-amber-200 text-sm tracking-widest uppercase">Welcome to</p>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ (ರಿ)
              </h1>
              <h2 className="text-2xl md:text-3xl font-semibold mb-4">
                Sri Gururaja Seva Samiti (R)
              </h2>
              <p className="text-amber-100 text-lg">
                Maintained by the Sri Sri Raghavendraswamy Brindavan Seva Samithi Trust (R)
              </p>
              <p className="text-amber-200 mt-2">
                Yelahanka New Town, Bengaluru
              </p>
            </div>
          </div>
        </div>

        {/* Sacred Motto */}
        <div className="bg-stone-900 text-white py-6">
          <div className="max-w-4xl mx-auto text-center space-y-2">
            <p className="text-2xl font-serif tracking-wide">|| ಹರಿ ಸರ್ವೋತ್ತಮ ||</p>
            <p className="text-xl text-amber-300">|| Hari Sarvottama ||</p>
            <p className="text-lg text-stone-400">|| ವಾಯು ಜೀವೋತ್ತಮ ||</p>
            <p className="text-amber-400">|| Vāyu Jīvōttama ||</p>
            <p className="text-lg text-stone-400">|| ಗುರುರಾಜೋ ವಿಜಯತೇ ||</p>
            <p className="text-xl text-amber-300">|| Gururājō Vijayate ||</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
          {/* About Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">About the Temple</h2>
            </div>
            
            <div className="prose prose-stone max-w-none space-y-4 text-base leading-8 text-stone-700">
              <p>
                A sacred space blessed with the divine presence of Lord Venkateswara, 
                this temple serves as a spiritual haven for devotees in the Yelahanka 
                New Town community.
              </p>
              <p>
                The temple is dedicated to preserving ancient Hindu traditions and 
                Madhva philosophy, offering daily rituals, special sevas, spiritual 
                teachings, and a welcoming environment for families to gather in faith.
              </p>
              <p>
                Our mission is to promote dharma, provide opportunities for devotees 
                to perform service (seva), and maintain the sacred traditions passed 
                down through the guru parampara.
              </p>
            </div>
          </section>

          {/* Our Activities */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <Calendar className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">Our Activities</h2>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { title: "Daily Poojas", desc: "Morning and evening rituals including Suprabhata, Archane, and Harathi" },
                { title: "Special Sevas", desc: "Weekly and monthly sevas including Archane with Harathi, Annadana, and more" },
                { title: "Festivals", desc: "Celebration of all Hindu festivals including Gururaja Aradhana, Ram Navami, and Janmashtami" },
                { title: "Spiritual Discourses", desc: "Regular bhajans, pravachanas, and religious lectures" }
              ].map((item, index) => (
                <div key={index} className="p-5 bg-white rounded-xl border border-stone-200 shadow-sm">
                  <h3 className="font-semibold text-stone-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-stone-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Our Services */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <Heart className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">Seva Offerings</h2>
            </div>
            
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
              <p className="text-stone-700 mb-4">
                We offer various sevas (services) that devotees can book to participate 
                in temple activities and earn punya:
              </p>
              <ul className="space-y-2 text-stone-700">
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">•</span>
                  <Link href="/sevas" className="text-orange-700 hover:underline font-medium">
                    Online Seva Booking
                  </Link>
                  - Book sevas conveniently from home
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">•</span>
                  Donation and Annadana Seva
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">•</span>
                  Special Poojas and Archane
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-600">•</span>
                  Vahanarchane and Ratha Utsava participation
                </li>
              </ul>
            </div>
          </section>

          {/* Spiritual Resources */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">Spiritual Resources</h2>
            </div>
            
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-orange-100 to-amber-100 p-4">
                <h3 className="font-semibold text-stone-900">Shlokas & Stotrams</h3>
              </div>
              <div className="p-5">
                <p className="text-stone-600 mb-4">
                  Access sacred hymns, prayers, and stotrams for your daily worship. 
                  Our collection includes prayers dedicated to Lord Venkateswara, 
                  Sri Raghavendra Swamy, and other deities.
                </p>
                <Link 
                  href="/shlokas"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  View Shlokas Collection
                </Link>
              </div>
            </div>
          </section>

          {/* Visit Us */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <MapPin className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">Visit Us</h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
                <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  Address
                </h3>
                <address className="not-italic text-stone-600 space-y-2">
                  <p>No. 05, Kere Cross</p>
                  <p>Yelahanka Upanagara</p>
                  <p>Bengaluru – 560064</p>
                  <p>Karnataka, India</p>
                </address>
              </div>

              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
                <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-orange-600" />
                  Contact
                </h3>
                <div className="space-y-3 text-stone-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-stone-400" />
                    <span>+91 99002 15389</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-stone-400" />
                    <span>+91 98450 79474</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-stone-400" />
                    <a href="mailto:srimoolaramafoundation@gmail.com" className="text-orange-600 hover:underline">
                      srimoolaramafoundation@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Community */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">Join Our Community</h2>
            </div>
            
            <div className="bg-gradient-to-r from-stone-800 to-stone-900 text-white rounded-2xl p-6">
              <p className="text-stone-300 mb-4">
                We welcome all devotees to participate in our temple activities, 
                events, and community gatherings. Whether you are a longtime devotee 
                or visiting for the first time, you are always welcome.
              </p>
              <p className="text-amber-300 font-medium">
                ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ |
              </p>
              <p className="text-stone-400 text-sm mt-2">
                May we all be protected, nourished, and blessed with strength together.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
