import type { Metadata } from "next";
import TorneoPage from "../torneo/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Torneo | Padel Montornes",
  description: "Cuadro publico del torneo de Padel Montornes.",
};

export default TorneoPage;
