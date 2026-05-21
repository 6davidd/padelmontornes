import { NextResponse } from "next/server";
import {
  getRequestCurrentMember,
  getRequestSession,
} from "@/lib/auth-server";
import { getOpenMatchesCountForMember } from "@/lib/server-open-matches-count";

export async function GET() {
  const session = await getRequestSession();

  if (!session) {
    return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });
  }

  const member = await getRequestCurrentMember();

  if (!member?.is_active) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const count = await getOpenMatchesCountForMember({
    accessToken: session.accessToken,
    currentUserId: member.user_id,
  });

  return NextResponse.json({ ok: true, count });
}
