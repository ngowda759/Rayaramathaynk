import { ReactNode } from "react";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-stone-100">
      {/* Left Side */}
      <section className="hidden lg:flex relative items-center justify-center bg-gradient-to-br from-orange-700 via-amber-700 to-stone-900 text-white p-16">
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold font-heading mb-6">
            Sri Raghavendra Swamy Temple
          </h1>

          <p className="text-lg leading-8 text-orange-100">
            Temple Management Portal for Devotees,
            Priests and Administrators.
          </p>

          <div className="mt-12 border-l-4 border-orange-300 pl-6">
            <p className="italic text-orange-100">
              &ldquo;Sri Raghavendra Gurusarvabhouma,
              Bless us with wisdom and devotion.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Right Side */}
      <section className="flex items-center justify-center p-8">
        {children}
      </section>
    </main>
  );
}
