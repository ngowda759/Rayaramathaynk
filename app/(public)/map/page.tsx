import TempleMap from '@/components/home/TempleMap';

export default function MapPage() {
  return (
    <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-white to-amber-50 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <h1 className="text-4xl font-bold text-stone-900 mb-8">Interactive Temple Map</h1>
        <TempleMap />
      </div>
    </main>
  );
}
