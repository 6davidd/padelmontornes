import type { Metadata } from "next";
import { getRequestSession } from "@/lib/auth-server";
import TorneoPublicClient from "./TorneoPublicClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Torneo | Padel Montornés",
  description: "Cuadro público del torneo de Padel Montornés.",
};

export default async function TorneoPage() {
  const session = await getRequestSession();

  return <TorneoPublicClient showAppBackLink={Boolean(session)} />;
}
