import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CLUB_NAME } from "@/lib/brand";
import { PageHeaderCard } from "../_components/PageHeaderCard";

const CLUB_GREEN = "#0f5e2e";
const DEVELOPER_WHATSAPP_URL =
  "https://wa.me/34691653518?text=Hola%20David%2C%20necesito%20ayuda%20con%20la%20app%20de%20reservas.";

type ScreenshotAnnotation = {
  number: number;
  ring: {
    left: number;
    top: number;
    width: number;
    height: number;
    radius?: string;
  };
  badge: {
    left: number;
    top: number;
  };
  arrow?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
};

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
    description: "Acceso rápido a todas las secciones de la app.",
    steps: [
      "Partidas abiertas: únete a una partida.",
      "Reservar pista: crea una reserva.",
      "Mis reservas: consulta tus partidas.",
      "Ayuda: lee esta guía.",
    ],
    image: {
      src: "/help/ayuda-inicio.png",
      alt: "Pantalla de inicio de la zona socio con accesos principales.",
      annotations: [
        {
          number: 1,
          ring: { left: 3.8, top: 34.6, width: 92.4, height: 7.7 },
          badge: { left: 9.5, top: 34.9 },
          arrow: { x1: 10.7, y1: 35.7, x2: 24, y2: 38.4 },
        },
        {
          number: 2,
          ring: { left: 3.8, top: 44.2, width: 92.4, height: 7.2 },
          badge: { left: 9.5, top: 44.5 },
          arrow: { x1: 10.7, y1: 45.3, x2: 24, y2: 48 },
        },
        {
          number: 3,
          ring: { left: 3.8, top: 53, width: 92.4, height: 7.2 },
          badge: { left: 9.5, top: 53.3 },
          arrow: { x1: 10.7, y1: 54.1, x2: 24, y2: 56.8 },
        },
        {
          number: 4,
          ring: { left: 3.8, top: 69.4, width: 92.4, height: 7.2 },
          badge: { left: 9.5, top: 69.7 },
          arrow: { x1: 10.7, y1: 70.5, x2: 21, y2: 73 },
        },
      ],
    },
  },
  {
    id: "reservar",
    title: "Reservar",
    description: "Reserva una pista en el día y hora que quieras.",
    steps: [
      "Elige el día.",
      "Selecciona la hora.",
      "Pulsa Crear o Unirme.",
    ],
    image: {
      src: "/help/ayuda-reservar.png",
      alt: "Pantalla de reservar pista con selector de día, horario y botones para crear o unirse.",
      annotations: [
        {
          number: 1,
          ring: { left: 7.8, top: 25.3, width: 41.6, height: 9.1 },
          badge: { left: 8.3, top: 25 },
          arrow: { x1: 10.1, y1: 26.1, x2: 22, y2: 29.8 },
        },
        {
          number: 2,
          ring: { left: 7.6, top: 51.9, width: 43.8, height: 5.4 },
          badge: { left: 8.8, top: 50.8 },
          arrow: { x1: 10.6, y1: 52, x2: 20.5, y2: 54.5 },
        },
        {
          number: 3,
          ring: { left: 63.1, top: 64, width: 23.5, height: 5.5 },
          badge: { left: 86.5, top: 61.8 },
          arrow: { x1: 86.8, y1: 63.2, x2: 74.8, y2: 66.8 },
        },
        {
          number: 4,
          ring: { left: 52.4, top: 78, width: 34.4, height: 5.6 },
          badge: { left: 88, top: 76.2 },
          arrow: { x1: 88, y1: 77.8, x2: 70, y2: 80.8 },
        },
      ],
    },
  },
  {
    id: "partidas-abiertas",
    title: "Partidas abiertas",
    description: "Únete a una partida que tenga plazas disponibles.",
    steps: [
      "Elige un día con partidas.",
      "Revisa la hora y plazas.",
      "Mira quién está apuntado.",
      "Pulsa Unirme.",
    ],
    image: {
      src: "/help/ayuda-partidas-abiertas.png",
      alt: "Pantalla de partidas abiertas con una partida disponible y botón para unirse.",
      annotations: [
        {
          number: 1,
          ring: { left: 7.7, top: 35.2, width: 41.8, height: 9.1 },
          badge: { left: 8.4, top: 34.7 },
          arrow: { x1: 10.2, y1: 35.8, x2: 24, y2: 39.8 },
        },
        {
          number: 2,
          ring: { left: 7.7, top: 51.6, width: 43.7, height: 5.4 },
          badge: { left: 8.8, top: 50.3 },
          arrow: { x1: 10.6, y1: 51.7, x2: 20, y2: 54.1 },
        },
        {
          number: 3,
          ring: { left: 13.2, top: 76.6, width: 73.5, height: 10.4 },
          badge: { left: 12, top: 74.4 },
          arrow: { x1: 13.6, y1: 75.7, x2: 27, y2: 80.5 },
        },
        {
          number: 4,
          ring: { left: 62, top: 63.3, width: 24.6, height: 5.5 },
          badge: { left: 86.5, top: 61.4 },
          arrow: { x1: 86.6, y1: 62.8, x2: 74.2, y2: 66 },
        },
      ],
    },
  },
  {
    id: "mis-reservas",
    title: "Mis reservas",
    description: "Consulta y gestiona tus reservas activas.",
    steps: [
      "Selecciona el día.",
      "Revisa la hora y pista.",
      "Mira los jugadores apuntados.",
      "Pulsa Salir si quieres abandonar.",
    ],
    image: {
      src: "/help/ayuda-mis-reservas.png",
      alt: "Pantalla de mis reservas con reservas activas, jugadores y botón para salir.",
      annotations: [
        {
          number: 1,
          ring: { left: 50.5, top: 25.4, width: 42, height: 9.2 },
          badge: { left: 48.7, top: 24.9 },
          arrow: { x1: 50.4, y1: 26.1, x2: 66, y2: 29.5 },
        },
        {
          number: 2,
          ring: { left: 7.8, top: 51.2, width: 45, height: 8.3 },
          badge: { left: 8.7, top: 50.4 },
          arrow: { x1: 10.5, y1: 51.5, x2: 24, y2: 54.2 },
        },
        {
          number: 3,
          ring: { left: 8.2, top: 66.5, width: 83.5, height: 7.8 },
          badge: { left: 10, top: 64.7 },
          arrow: { x1: 11.8, y1: 66, x2: 24, y2: 70 },
        },
        {
          number: 4,
          ring: { left: 74.1, top: 51.7, width: 18.1, height: 5.4 },
          badge: { left: 92, top: 49.7 },
          arrow: { x1: 91.8, y1: 51, x2: 83, y2: 54.4 },
        },
      ],
    },
  },
];

export const metadata: Metadata = {
  title: `Ayuda | ${CLUB_NAME}`,
  description: `Guía rápida para usar la app de reservas de ${CLUB_NAME}.`,
};

function ScreenshotGuide({
  title,
  src,
  alt,
  annotations,
}: {
  title: string;
  src: string;
  alt: string;
  annotations: ScreenshotAnnotation[];
}) {
  const arrowMarkerId = `help-arrow-${title
    .toLowerCase()
    .replace(/\s+/g, "-")}`;

  return (
    <figure className="rounded-[2rem] border border-gray-200 bg-gray-50 p-2 shadow-sm">
      <div className="relative overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white">
        <Image
          src={src}
          alt={alt}
          width={945}
          height={2048}
          sizes="(min-width: 640px) 18rem, calc(100vw - 4rem)"
          className="h-auto w-full select-none"
        />

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <marker
              id={arrowMarkerId}
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill={CLUB_GREEN} />
            </marker>
          </defs>

          {annotations.map((annotation) =>
            annotation.arrow ? (
              <line
                key={`arrow-${annotation.number}`}
                x1={annotation.arrow.x1}
                y1={annotation.arrow.y1}
                x2={annotation.arrow.x2}
                y2={annotation.arrow.y2}
                stroke={CLUB_GREEN}
                strokeWidth="0.75"
                strokeLinecap="round"
                markerEnd={`url(#${arrowMarkerId})`}
                vectorEffect="non-scaling-stroke"
              />
            ) : null
          )}
        </svg>

        {annotations.map((annotation) => (
          <div key={`ring-${annotation.number}`}>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute border-[3px] border-green-600/90 bg-green-300/10 shadow-[0_0_0_2px_rgba(255,255,255,0.9),0_10px_28px_rgba(15,94,46,0.22)]"
              style={{
                left: `${annotation.ring.left}%`,
                top: `${annotation.ring.top}%`,
                width: `${annotation.ring.width}%`,
                height: `${annotation.ring.height}%`,
                borderRadius: annotation.ring.radius ?? "9999px",
              }}
            />

            <span
              className="pointer-events-none absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-sm font-black text-white shadow-lg sm:h-9 sm:w-9 sm:text-base"
              style={{
                left: `${annotation.badge.left}%`,
                top: `${annotation.badge.top}%`,
                backgroundColor: CLUB_GREEN,
              }}
            >
              {annotation.number}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

function QuickHelpNav() {
  return (
    <nav
      aria-label="Accesos rápidos de ayuda"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
    >
      {quickLinks.map((link, index) => (
        <Link
          key={link.href}
          href={link.href}
          className="group flex min-h-24 flex-col justify-between rounded-3xl border border-gray-300 bg-white p-3 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-green-200 hover:bg-green-50/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99] sm:min-h-28 sm:p-4"
        >
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm sm:h-7 sm:w-7"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            {index + 1}
          </span>

          <span>
            <span className="block text-sm font-bold leading-4 text-gray-900 sm:text-[15px] sm:leading-5">
              {link.label}
            </span>
            <span className="mt-0.5 block text-xs font-medium leading-3 text-gray-500 sm:mt-1 sm:leading-4">
              {link.helper}
            </span>
          </span>

          <span className="mt-2 h-0.5 w-6 rounded-full bg-green-100 transition group-hover:w-full group-hover:bg-green-300 sm:mt-3 sm:h-1 sm:w-10" />
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
  image,
}: {
  id: string;
  title: string;
  description: string;
  steps: string[];
  image: {
    src: string;
    alt: string;
    annotations: ScreenshotAnnotation[];
  };
}) {
  return (
    <section
      id={id}
      className="scroll-mt-[calc(var(--app-header-height)+1rem)] rounded-3xl border border-gray-300 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] sm:items-start">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h2>
            <p className="text-sm leading-5 text-gray-600 sm:text-[15px]">
              {description}
            </p>
          </div>

          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm sm:h-7 sm:w-7 sm:text-sm"
                  style={{ backgroundColor: CLUB_GREEN }}
                >
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm leading-5 text-gray-800 sm:text-[15px] sm:leading-6">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <ScreenshotGuide title={title} {...image} />
      </div>
    </section>
  );
}

export default function AyudaPage() {
  return (
    <main className="min-h-[calc(100vh-var(--app-header-height))] bg-gray-50 pb-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeaderCard title="Ayuda" contentClassName="space-y-2">
          <p className="text-sm leading-6 text-gray-600 sm:text-base">
            Guía rápida para usar la app.
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
              <h2 className="text-xl font-bold text-gray-900">
                ¿Problema con la app?
              </h2>
              <p className="mt-1.5 text-sm leading-5 text-gray-700">
                Contacta directamente con David.
              </p>
              <p className="mt-1 text-sm font-semibold text-green-900">
                +34 691 653 518
              </p>
            </div>

            <a
              href={DEVELOPER_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm outline-none transition hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99] sm:w-auto"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              WhatsApp
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
