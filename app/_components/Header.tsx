import Image from "next/image";

const CLUB_GREEN = "#0f5e2e";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4 py-3">
          <Image
            src="/logo.png"
            alt="Club Padel Montornes"
            width={29}
            height={44}
            priority
            className="h-11 w-auto"
          />

          <span
            className="text-xl font-bold leading-tight sm:text-2xl"
            style={{ color: CLUB_GREEN }}
          >
            Club Padel Montornes
          </span>
        </div>
      </div>
    </header>
  );
}
