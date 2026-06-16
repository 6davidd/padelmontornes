import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  normalizeTournamentEvent,
  type TournamentEventRow,
} from "@/lib/tournament-sabado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

const TOURNAMENT_SELECT =
  "id,slug,name,date,public_enabled,state,created_at,updated_at";

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const cleanSlug = slug.trim();

    if (!cleanSlug) {
      return NextResponse.json(
        { ok: false, error: "Falta el torneo." },
        { status: 400 }
      );
    }

    const res = await supabaseAdmin
      .from("tournament_events")
      .select(TOURNAMENT_SELECT)
      .eq("slug", cleanSlug)
      .eq("public_enabled", true)
      .maybeSingle();

    if (res.error) {
      return NextResponse.json(
        { ok: false, error: res.error.message },
        { status: 500 }
      );
    }

    if (!res.data) {
      return NextResponse.json(
        { ok: false, error: "Torneo no disponible." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      tournament: normalizeTournamentEvent(res.data as TournamentEventRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado.",
      },
      { status: 500 }
    );
  }
}
