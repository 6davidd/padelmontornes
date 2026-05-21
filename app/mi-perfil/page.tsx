import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";

const CLUB_GREEN = "#0f5e2e";

type SettingsItem = {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
};

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function AliasIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function SettingsRow({ item }: { item: SettingsItem }) {
  return (
    <Link
      href={item.href}
      className="group flex min-h-24 items-center gap-4 rounded-3xl border border-gray-300 bg-white p-4 shadow-sm outline-none transition hover:border-green-200 hover:bg-green-50/50 focus-visible:ring-2 focus-visible:ring-green-200 active:scale-[0.99] sm:p-5"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-green-100 bg-green-50 text-green-900"
        style={{ color: CLUB_GREEN }}
      >
        {item.icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-gray-900 sm:text-lg">
          {item.title}
        </span>
        <span className="mt-1 block text-sm leading-5 text-gray-600">
          {item.description}
        </span>
      </span>

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition group-hover:bg-white group-hover:text-green-900">
        <ChevronRightIcon />
      </span>
    </Link>
  );
}

const settingsItems: SettingsItem[] = [
  {
    href: "/mi-perfil/alias",
    title: "Alias",
    description: "Elige el nombre visible para el resto de socios.",
    icon: <AliasIcon />,
  },
  {
    href: "/mi-perfil/notificaciones",
    title: "Notificaciones",
    description: "Gestiona los correos que quieres recibir.",
    icon: <BellIcon />,
  },
];

export default function MiPerfilPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeaderCard title="Mi perfil" contentClassName="space-y-2">
          <p className="text-sm leading-6 text-gray-600 sm:text-base">
            Ajusta tu perfil y tus preferencias de la app.
          </p>
        </PageHeaderCard>

        <section className="space-y-3" aria-label="Ajustes de perfil">
          {settingsItems.map((item) => (
            <SettingsRow key={item.href} item={item} />
          ))}
        </section>
      </div>
    </div>
  );
}
