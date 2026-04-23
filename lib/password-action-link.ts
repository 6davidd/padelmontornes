import type { EmailOtpType } from "@supabase/supabase-js";
import { getPublicAppUrlForPath } from "./public-app-url";

type PasswordActionType = Extract<EmailOtpType, "invite" | "recovery">;

export function buildPasswordActionLink(params: {
  tokenHash: string;
  type: PasswordActionType;
  next?: string | null;
}) {
  const url = new URL(getPublicAppUrlForPath("/reset-password"));
  url.searchParams.set("token_hash", params.tokenHash);
  url.searchParams.set("type", params.type);

  if (params.next?.trim()) {
    url.searchParams.set("next", params.next.trim());
  }

  return url.toString();
}
