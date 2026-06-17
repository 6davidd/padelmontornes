import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth-shared";
import { isISODate } from "@/lib/booking-window";
import { getAuthenticatedMemberFromRequest } from "@/lib/server-route-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createInitialTournamentPayload,
  normalizeTournamentEvent,
  normalizeTournamentState,
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

type UpdateBody = {
  name?: unknown;
  date?: unknown;
  publicEnabled?: unknown;
  state?: unknown;
};

const TOURNAMENT_SELECT =
  "id,slug,name,date,public_enabled,state,created_at,updated_at";

async function requireAdmin(req: Request) {
  const auth = await getAuthenticatedMemberFromRequest(req);

  if (!auth.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      ),
    };
  }

  if (!isAdminRole(auth.member.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const };
}

function getCleanSlug(slug: string) {
  return slug.trim();
}

function isSupportedTournamentSlug(slug: string) {
  return slug === TORNEO_SLUG;
}

function tournamentNotAvailableResponse() {
  return NextResponse.json(
    { ok: false, error: "Torneo no disponible." },
    { status: 404 }
  );
}

async function getTournament(slug: string) {
  return supabaseAdmin
    .from("tournament_events")
    .select(TOURNAMENT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return admin.response;
    }

    const { slug } = await context.params;
    const cleanSlug = getCleanSlug(slug);

    if (!cleanSlug) {
      return NextResponse.json(
        { ok: false, error: "Falta el torneo." },
        { status: 400 }
      );
    }

    if (!isSupportedTournamentSlug(cleanSlug)) {
      return tournamentNotAvailableResponse();
    }

    const res = await getTournament(cleanSlug);

    if (res.error) {
      return NextResponse.json(
        { ok: false, error: res.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tournament: res.data
        ? normalizeTournamentEvent(res.data as TournamentEventRow)
        : null,
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

export async function POST(req: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return admin.response;
    }

    const { slug } = await context.params;
    const cleanSlug = getCleanSlug(slug);

    if (!cleanSlug) {
      return NextResponse.json(
        { ok: false, error: "Falta el torneo." },
        { status: 400 }
      );
    }

    if (!isSupportedTournamentSlug(cleanSlug)) {
      return tournamentNotAvailableResponse();
    }

    const existingRes = await getTournament(cleanSlug);

    if (existingRes.error) {
      return NextResponse.json(
        { ok: false, error: existingRes.error.message },
        { status: 500 }
      );
    }

    if (existingRes.data) {
      return NextResponse.json({
        ok: true,
        created: false,
        tournament: normalizeTournamentEvent(existingRes.data as TournamentEventRow),
      });
    }

    const body = (await req.json().catch(() => null)) as
      | { name?: unknown; date?: unknown }
      | null;
    const requestedDate = typeof body?.date === "string" ? body.date : undefined;
    const payload = createInitialTournamentPayload({
      slug: cleanSlug,
      name: typeof body?.name === "string" ? body.name : undefined,
      date: requestedDate && isISODate(requestedDate) ? requestedDate : undefined,
    });

    const insertRes = await supabaseAdmin
      .from("tournament_events")
      .insert(payload)
      .select(TOURNAMENT_SELECT)
      .single();

    if (insertRes.error) {
      const duplicate = insertRes.error.code === "23505";

      if (duplicate) {
        const retryRes = await getTournament(cleanSlug);

        if (!retryRes.error && retryRes.data) {
          return NextResponse.json({
            ok: true,
            created: false,
            tournament: normalizeTournamentEvent(
              retryRes.data as TournamentEventRow
            ),
          });
        }
      }

      return NextResponse.json(
        { ok: false, error: insertRes.error.message },
        { status: duplicate ? 409 : 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      created: true,
      tournament: normalizeTournamentEvent(insertRes.data as TournamentEventRow),
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

async function updateTournament(req: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return admin.response;
    }

    const { slug } = await context.params;
    const cleanSlug = getCleanSlug(slug);

    if (!cleanSlug) {
      return NextResponse.json(
        { ok: false, error: "Falta el torneo." },
        { status: 400 }
      );
    }

    if (!isSupportedTournamentSlug(cleanSlug)) {
      return tournamentNotAvailableResponse();
    }

    const parsedBody = await req.json().catch(() => null);

    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return NextResponse.json(
        { ok: false, error: "La petición no es válida." },
        { status: 400 }
      );
    }

    const body = parsedBody as UpdateBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const date =
      body.date === null || body.date === ""
        ? null
        : typeof body.date === "string" && isISODate(body.date)
        ? body.date
        : undefined;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Indica el nombre del torneo." },
        { status: 400 }
      );
    }

    if (typeof date === "undefined") {
      return NextResponse.json(
        { ok: false, error: "Indica una fecha válida." },
        { status: 400 }
      );
    }

    if (typeof body.publicEnabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "El estado público no es válido." },
        { status: 400 }
      );
    }

    const updateRes = await supabaseAdmin
      .from("tournament_events")
      .update({
        name,
        date,
        public_enabled: body.publicEnabled,
        state: normalizeTournamentState(body.state),
        updated_at: new Date().toISOString(),
      })
      .eq("slug", cleanSlug)
      .select(TOURNAMENT_SELECT)
      .maybeSingle();

    if (updateRes.error) {
      return NextResponse.json(
        { ok: false, error: updateRes.error.message },
        { status: 500 }
      );
    }

    if (!updateRes.data) {
      return NextResponse.json(
        { ok: false, error: "No se ha encontrado el torneo." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      tournament: normalizeTournamentEvent(updateRes.data as TournamentEventRow),
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

export const PUT = updateTournament;
export const PATCH = updateTournament;
