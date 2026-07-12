import { ReactNode } from "react";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-stone-50">
      {/* Left Side - Temple Branding */}
      <section className="hidden lg:flex relative items-center justify-center bg-gradient-to-br from-orange-700 via-amber-700 to-stone-900 text-white p-16 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute top-10 left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl" />
        
        {/* Om watermark */}
        <div className="absolute right-8 top-1/4 text-amber-400/10 text-[200px] font-serif select-none">
          ॐ
        </div>

        <div className="relative z-10 max-w-lg">
          {/* Temple Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400 rounded-full blur-xl opacity-30" />
              <Image
                src="/images/logos/ynk_matha_logo.png"
                alt="Temple Logo"
                width={100}
                height={100}
                className="relative rounded-full shadow-2xl ring-4 ring-amber-400/50"
              />
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold font-heading mb-6 text-center">
            Sri Raghavendra Swamy Temple
          </h1>

          <p className="text-lg leading-8 text-orange-100 text-center">
            Temple Management Portal for Devotees,
            Priests and Administrators.
          </p>

          {/* Sacred quote */}
          <div className="mt-10 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-amber-400/20">
            <p className="italic text-amber-100 text-center">
              &ldquo;Sri Raghavendra Gurusarvabhouma,
              Bless us with wisdom and devotion.&rdquo;
            </p>
            <p className="text-center text-amber-300 text-sm mt-3">
              ॐ Sri Raghavendraya Namaha ॐ
            </p>
          </div>

          {/* Decorative footer */}
          <div className="mt-12 flex justify-center gap-4">
            <div className="h-1 w-16 bg-gradient-to-r from-transparent to-amber-400/50 rounded-full" />
            <div className="h-1 w-8 bg-amber-400/70 rounded-full" />
            <div className="h-1 w-16 bg-gradient-to-l from-transparent to-amber-400/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Right Side - Login Form */}
      <section className="flex items-center justify-center p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Decorative top border for card */}
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 rounded-t-2xl -mt-4 mb-0" />
          {children}
        </div>
      </section>
    </main>
  );
}
