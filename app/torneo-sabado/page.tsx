import type { Metadata } from "next";
import TorneoSabadoPublicClient from "./TorneoSabadoPublicClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Torneo sábado | Padel Montornés",
  description: "Cuadro público del torneo de sábado de Padel Montornés.",
};

export default function TorneoSabadoPage() {
  return <TorneoSabadoPublicClient />;
}
