import Link from "next/link";
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
} from "react-icons/fa";

const socialLinks = [
  {
    title: "Facebook Page",
    subtitle: "Sri Raghavendra Rayaru Yelahanka New Town",
    href: "https://www.facebook.com/srs.mutt.yelahanka.newtown",
    icon: FaFacebookF,
    theme: "from-blue-600 to-sky-500",
  },
  {
    title: "Instagram Account",
    subtitle: "srs_mutt_yelahanka_newtown",
    href: "https://www.instagram.com/srs_mutt_yelahanka_newtown",
    icon: FaInstagram,
    theme: "from-pink-500 via-purple-500 to-orange-500",
  },
  {
    title: "YouTube Channel",
    subtitle: "Guru_Raghavendra_Rayaru",
    href: "https://www.youtube.com/@Guru_Raghavendra_Rayaru",
    icon: FaYoutube,
    theme: "from-red-600 to-red-500",
  },
  {
    title: "WhatsApp Community",
    subtitle: "Coming Soon",
    href: "#",
    icon: FaWhatsapp,
    theme: "from-green-500 to-emerald-500",
    disabled: true,
  },
];

export default function SocialConnect() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0b1120] via-[#121827] to-[#11151f] py-24 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.25),_transparent_35%)] opacity-20" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-amber-500/20 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-amber-300">
            Connect With Sri Matha
          </span>

          <h2 className="mt-6 text-4xl font-bold md:text-5xl">
            Stay Connected With Us
          </h2>

          <p className="mt-6 text-lg leading-8 text-stone-300">
            Receive temple updates, daily darshanas, sevas, festivals and
            spiritual content by following our official social media channels.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          {socialLinks.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="group rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-amber-400/40 hover:bg-white/10"
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${item.theme} text-white shadow-xl`}
                >
                  <Icon size={30} />
                </div>

                <h3 className="mt-8 text-2xl font-bold">
                  {item.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-stone-300">
                  {item.subtitle}
                </p>

                <div className="mt-8">
                  {item.disabled ? (
                    <span className="inline-flex rounded-xl border border-stone-600 bg-stone-900/80 px-5 py-3 text-sm font-semibold text-stone-300">
                      Coming Soon
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white transition-all duration-300 hover:bg-amber-400 hover:shadow-lg"
                    >
                      Visit →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
