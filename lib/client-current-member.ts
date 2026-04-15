import { supabase } from "./supabase";
import { getClientUser } from "./client-session";
import type { MemberRole } from "./auth-shared";

export type CurrentMember = {
  user_id: string;
  full_name: string;
  alias: string | null;
  email: string | null;
  is_active: boolean;
  role: MemberRole;
};

let cachedCurrentMember: CurrentMember | null | undefined;
let currentMemberRequest: Promise<CurrentMember | null> | null = null;

export function setCachedCurrentMember(member: CurrentMember | null) {
  cachedCurrentMember = member;
}

export function resetCachedCurrentMember() {
  cachedCurrentMember = undefined;
  currentMemberRequest = null;
}

export async function getCurrentMember(): Promise<CurrentMember | null> {
  if (cachedCurrentMember !== undefined) {
    return cachedCurrentMember;
  }

  if (!currentMemberRequest) {
    currentMemberRequest = (async () => {
      const user = await getClientUser();

      if (!user) {
        cachedCurrentMember = null;
        return null;
      }

      const memberRes = await supabase
        .from("members")
        .select("user_id,full_name,alias,email,is_active,role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberRes.error || !memberRes.data) {
        return null;
      }

      cachedCurrentMember = memberRes.data as CurrentMember;
      return cachedCurrentMember;
    })().finally(() => {
      currentMemberRequest = null;
    });
  }

  return currentMemberRequest;
}
