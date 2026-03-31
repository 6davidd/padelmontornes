"use client";

const CLUB_GREEN = "#0f5e2e";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center gap-4 py-3">
          <img
            src="/logo.png"
            alt="Club Pàdel Montornès"
            className="h-11 w-auto"
          />

          <span
            className="text-xl sm:text-2xl font-bold leading-tight"
            style={{ color: CLUB_GREEN }}
          >
            Club Pádel Montornès
          </span>
        </div>
      </div>
    </header>
  );
}