export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-orange-500 to-amber-500 p-6 md:p-8 text-white shadow-lg w-full">
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">
            Welcome, Administrator 👋
          </h1>
          <p className="pt-2 text-orange-50">
            Welcome back to the Temple Administration Portal.
          </p>
        </div>
        <div className="absolute right-4 md:right-6 top-4 md:top-6 text-6xl md:text-8xl opacity-10">
          🏛
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-500">Users</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">-</p>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-500">Events</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">-</p>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-500">Sevas</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">-</p>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-stone-500">Gallery</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">-</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <a href="/admin/events" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted">
            <span className="text-2xl">📅</span>
            <span>Add Event</span>
          </a>
          <a href="/admin/gallery" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted">
            <span className="text-2xl">🖼</span>
            <span>Upload Gallery</span>
          </a>
          <a href="/admin/announcements" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted">
            <span className="text-2xl">📢</span>
            <span>Announcements</span>
          </a>
          <a href="/admin/donations" className="flex items-center gap-3 rounded-xl border p-4 hover:bg-muted">
            <span className="text-2xl">💝</span>
            <span>Donations</span>
          </a>
        </div>
      </div>
    </div>
  );
}
