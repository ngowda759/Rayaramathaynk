import Image from "next/image";

export default function LoginHeader() {
  return (
    <div className="text-center space-y-4">
      {/* Temple Logo */}
      <div className="flex justify-center mb-2">
        <div className="relative">
          <div className="absolute inset-0 bg-amber-400 rounded-full blur-lg opacity-30" />
          <Image
            src="/images/logos/ynk_matha_logo.png"
            alt="Sri Raghavendra Swamy Matha"
            width={72}
            height={72}
            className="relative rounded-full shadow-xl ring-4 ring-amber-200"
          />
        </div>
      </div>
      
      {/* Decorative top border */}
      <div className="h-1 w-20 mx-auto bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 rounded-full" />
      
      <h2 className="text-3xl font-bold font-heading text-stone-800">
        Welcome Back
      </h2>

      <p className="text-stone-600">
        Sign in to continue to the Temple Portal
      </p>
      
      {/* Sacred motto */}
      <p className="text-sm text-amber-600 font-medium mt-2">
        ॐ Sri Raghavendraya Namaha ॐ
      </p>
    </div>
  );
}
