import type { Metadata } from "next";
import Link from "next/link";
import { CLUB_NAME } from "@/lib/brand";
import { PageHeaderCard } from "../_components/PageHeaderCard";

const CLUB_GREEN = "#0f5e2e";
const DEVELOPER_WHATSAPP_URL =
  "https://wa.me/34691653518?text=Hola%20David%2C%20necesito%20ayuda%20con%20la%20app%20de%20reservas.";

const quickLinks = [
  { href: "#inicio", label: "Inicio", helper: "Pantalla principal" },
  { href: "#reservar", label: "Reservar", helper: "Crear una reserva" },
  {
    href: "#partidas-abiertas",
    label: "Partidas abiertas",
    helper: "Unirte a una partida",
  },
  {
    href: "#mis-reservas",
    label: "Mis reservas",
    helper: "Consultar y cancelar",
  },
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

function QuickHelpNav() {
  return (
    <nav
      aria-label="Accesos rápidos de ayuda"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {quickLinks.map((link, index) => (
        <Link
          key={link.href}
          href={link.href}
          className="group flex min-h-28 flex-col justify-between rounded-3xl border border-gray-300 bg-white p-4 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-green-200 hover:bg-green-50/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99]"
        >
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            {index + 1}
          </span>

          <span>
            <span className="block text-[15px] font-bold leading-5 text-gray-900">
              {link.label}
            </span>
            <span className="mt-1 block text-xs font-medium leading-4 text-gray-500">
              {link.helper}
            </span>
          </span>

          <span className="mt-3 h-1 w-10 rounded-full bg-green-100 transition group-hover:w-full group-hover:bg-green-300" />
        </Link>
      ))}
    </nav>
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
        <PageHeaderCard title="Ayuda" contentClassName="space-y-3">
          <p className="text-sm leading-6 text-gray-600 sm:text-base">
            Aquí tienes una guía rápida para usar la app del club.
          </p>
        </PageHeaderCard>

        <QuickHelpNav />

        <div className="space-y-6">
          {helpSections.map((section) => (
            <HelpSection key={section.id} {...section} />
          ))}
        </div>

        <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                ¿Tienes algún problema?
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-gray-700">
                Contacta con el desarrollador de la aplicación.
              </p>
              <p className="mt-1 text-sm font-semibold text-green-900">
                David · +34 691 653 518
              </p>
            </div>

            <a
              href={DEVELOPER_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-sm outline-none transition hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99] sm:w-auto"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              Escribir por WhatsApp
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
