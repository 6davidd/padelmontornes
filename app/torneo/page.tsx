import type { Metadata } from "next";
import TorneoPublicClient from "./TorneoPublicClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Torneo | Padel Montornés",
  description: "Cuadro público del torneo de Padel Montornés.",
};

export default function TorneoPage() {
  return <TorneoPublicClient />;
}
