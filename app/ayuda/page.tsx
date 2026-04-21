import type { Metadata } from "next";
import Link from "next/link";
import { CLUB_NAME } from "@/lib/brand";

const CLUB_GREEN = "#0f5e2e";

const quickLinks = [
  { href: "#inicio", label: "Inicio" },
  { href: "#reservar", label: "Reservar" },
  { href: "#partidas-abiertas", label: "Partidas abiertas" },
  { href: "#mis-reservas", label: "Mis reservas" },
];

const helpSections = [
  {
    id: "inicio",
    title: "Inicio",
    description:
      "Es la pantalla principal de la app. Desde aquí puedes acceder rápidamente al resto de apartados.",
    steps: [
      "Accede a la pantalla principal",
      "Revisa los accesos disponibles",
      "Entra en la sección que necesites",
    ],
  },
  {
    id: "reservar",
    title: "Reservar",
    description:
      "Aquí puedes reservar una pista en el día y horario disponibles.",
    steps: [
      "Selecciona el día",
      "Elige una pista o franja disponible",
      "Confirma la reserva",
    ],
  },
  {
    id: "partidas-abiertas",
    title: "Partidas abiertas",
    description:
      "Aquí verás partidas con plazas libres a las que puedes unirte.",
    steps: [
      "Busca una partida con hueco",
      "Revisa el día y la hora",
      "Pulsa para unirte",
    ],
  },
  {
    id: "mis-reservas",
    title: "Mis reservas",
    description:
      "Aquí puedes consultar y gestionar las reservas que ya tienes.",
    steps: [
      "Revisa tus próximas reservas",
      "Comprueba el día y la hora",
      "Cancela una reserva si lo necesitas",
    ],
  },
];

export const metadata: Metadata = {
  title: `Ayuda | ${CLUB_NAME}`,
  description: `Guía rápida para usar la app de reservas de ${CLUB_NAME}.`,
};

function SectionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M7 4h10" />
      <path d="M6 8h12" />
      <path d="M8 12h8" />
      <path d="M10 16h4" />
      <path d="M12 20h.01" />
    </svg>
  );
}

function ScreenshotPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-3">
      <div className="overflow-hidden rounded-[1.35rem] border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-red-200" />
          <span className="h-2 w-2 rounded-full bg-yellow-200" />
          <span className="h-2 w-2 rounded-full bg-green-200" />
        </div>

        <div className="aspect-[4/3] bg-gradient-to-b from-white to-gray-50 p-4">
          <div className="h-full rounded-2xl border border-dashed border-green-200 bg-green-50/60 p-4">
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-2">
                <div className="h-3 w-24 rounded-full bg-green-200" />
                <div className="h-3 w-32 rounded-full bg-gray-200" />
              </div>

              <div className="space-y-2">
                <div className="h-8 rounded-2xl bg-white shadow-sm ring-1 ring-black/5" />
                <div className="h-8 rounded-2xl bg-white shadow-sm ring-1 ring-black/5" />
                <div className="h-8 rounded-2xl bg-white shadow-sm ring-1 ring-black/5" />
              </div>

              <p className="text-xs font-semibold text-green-900">
                Captura de {title}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpSection({
  id,
  title,
  description,
  steps,
}: {
  id: string;
  title: string;
  description: string;
  steps: string[];
}) {
  return (
    <section
      id={id}
      className="scroll-mt-[calc(var(--app-header-height)+1rem)] rounded-3xl border border-gray-300 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] sm:items-center">
        <div className="space-y-5">
          <div className="space-y-2">
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-900 ring-1 ring-green-200"
              style={{ color: CLUB_GREEN }}
            >
              <SectionIcon />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-[15px] leading-6 text-gray-600 sm:text-base">
              {description}
            </p>
          </div>

          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                  style={{ backgroundColor: CLUB_GREEN }}
                >
                  {index + 1}
                </span>
                <span className="pt-0.5 text-[15px] font-medium leading-6 text-gray-800">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <ScreenshotPlaceholder title={title} />
      </div>
    </section>
  );
}

export default function AyudaPage() {
  return (
    <main className="min-h-[calc(100vh-var(--app-header-height))] bg-gray-50 pb-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <h1
            className="text-3xl font-bold leading-tight sm:text-4xl"
            style={{ color: CLUB_GREEN }}
          >
            Ayuda
          </h1>
          <p className="mt-3 text-base leading-7 text-gray-700 sm:text-lg">
            Aquí tienes una guía rápida para usar la app del club.
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-600 sm:text-base">
            Aprende rápidamente cómo reservar pista, unirte a partidas abiertas
            y gestionar tus reservas.
          </p>

          <nav
            aria-label="Accesos rápidos de ayuda"
            className="mt-5 flex flex-wrap gap-2"
          >
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-900 outline-none transition hover:bg-green-100 focus-visible:ring-2 focus-visible:ring-green-300"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </section>

        <div className="space-y-6">
          {helpSections.map((section) => (
            <HelpSection key={section.id} {...section} />
          ))}
        </div>

        <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-green-900 shadow-sm ring-1 ring-green-200">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                >
                  <path d="M12 18h.01" />
                  <path d="M9.5 9a2.5 2.5 0 1 1 4.24 1.8c-.98.81-1.74 1.31-1.74 2.7" />
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>

              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                ¿Tienes algún problema?
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-gray-700">
                Si algo no funciona o no puedes acceder, contacta con el
                coordinador o con el club.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {["WhatsApp", "Teléfono", "Correo"].map((label) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-green-200 bg-white/80 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {label}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Pendiente</p>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-sm outline-none transition hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99] sm:w-auto"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              Abrir la app
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
