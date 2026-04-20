import type { MemberRole } from "./auth-shared";
import { supabaseAdmin } from "./supabase-admin";

export type AuthenticatedMember = {
  user_id: string;
  role: MemberRole;
  is_active: boolean;
  full_name: string;
  alias?: string | null;
  email?: string | null;
};

type AuthFailure = {
  ok: false;
  error: string;
  status: number;
};

type AuthSuccess = {
  ok: true;
  member: AuthenticatedMember;
};

export async function getAuthenticatedMemberFromRequest(
  req: Request
): Promise<AuthFailure | AuthSuccess> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false,
      error: "No autorizado.",
      status: 401,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      error: "No autorizado.",
      status: 401,
    };
  }

  const memberRes = await supabaseAdmin
    .from("members")
    .select("user_id,role,is_active,full_name,alias,email")
    .eq("user_id", user.id)
    .single();

  if (memberRes.error || !memberRes.data || !memberRes.data.is_active) {
    return {
      ok: false,
      error: "No autorizado.",
      status: 403,
    };
  }

  return {
    ok: true,
    member: memberRes.data as AuthenticatedMember,
  };
}
