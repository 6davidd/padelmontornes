import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  normalizeTournamentEvent,
  type TournamentEvent,
  TORNEO_SLUG,
  type TournamentEventRow,
} from "@/lib/tournament";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

const TOURNAMENT_SELECT =
  "id,slug,name,date,public_enabled,state,created_at,updated_at";

function sanitizePublicTournament(tournament: TournamentEvent) {
  return {
    ...tournament,
    state: {
      ...tournament.state,
      groups: tournament.state.groups.map((group) => ({
        ...group,
        players: group.players.map((player) => ({
          ...player,
          memberUserIds: [],
        })),
      })),
    },
  } satisfies TournamentEvent;
}

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

    if (cleanSlug !== TORNEO_SLUG) {
      return NextResponse.json(
        { ok: false, error: "Torneo no disponible." },
        { status: 404 }
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
      tournament: sanitizePublicTournament(
        normalizeTournamentEvent(res.data as TournamentEventRow)
      ),
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
