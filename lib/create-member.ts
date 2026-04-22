import type { MemberRole } from "./auth-shared";
import { supabaseAdmin } from "./supabase-admin";
import {
  sendMemberInviteEmail,
  validateMemberInviteEmailConfig,
} from "./send-member-invite";

export type MemberCreateRole = Extract<MemberRole, "member" | "admin">;

export type ExistingSystemEmailLookup = {
  memberEmails: Set<string>;
  authEmails: Set<string>;
};

export type CreateMemberParams = {
  fullName: string;
  email: string;
  alias?: string | null;
  role?: MemberCreateRole;
};

export type CreateMemberResult =
  | {
      ok: true;
      userId: string;
      inviteEmailSent: true;
    }
  | {
      ok: false;
      status: number;
      code:
        | "config"
        | "duplicate"
        | "invite_link"
        | "member_insert"
        | "invite_email";
      error: string;
      inviteEmailSent: false;
      userId?: string;
      rolledBack?: boolean;
    };

type CreateMemberFailure = Extract<CreateMemberResult, { ok: false }>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBER_EMAIL_LOOKUP_CHUNK_SIZE = 200;
const AUTH_USERS_PAGE_SIZE = 200;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeAlias(alias?: string | null) {
  const clean = (alias ?? "").trim();
  return clean === "" ? null : clean;
}

export function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email);
}

function getInviteRedirectTo() {
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return new URL("/reset-password", appUrl).toString();
}

async function cleanupInvitedMember(userId: string) {
  await Promise.allSettled([
    supabaseAdmin.from("members").delete().eq("user_id", userId),
    supabaseAdmin.auth.admin.deleteUser(userId),
  ]);
}

async function deleteInvitedUser(userId: string) {
  await Promise.allSettled([supabaseAdmin.auth.admin.deleteUser(userId)]);
}

function uniqueNormalizedEmails(emails: string[]) {
  return Array.from(
    new Set(emails.map((email) => normalizeEmail(email)).filter(Boolean))
  );
}

async function loadExistingMemberEmails(emails: string[]) {
  const memberEmails = new Set<string>();

  for (let index = 0; index < emails.length; index += MEMBER_EMAIL_LOOKUP_CHUNK_SIZE) {
    const chunk = emails.slice(index, index + MEMBER_EMAIL_LOOKUP_CHUNK_SIZE);

    if (chunk.length === 0) {
      continue;
    }

    const res = await supabaseAdmin
      .from("members")
      .select("email")
      .in("email", chunk);

    if (res.error) {
      throw new Error(res.error.message);
    }

    for (const row of (res.data ?? []) as Array<{ email: string | null }>) {
      if (row.email) {
        memberEmails.add(normalizeEmail(row.email));
      }
    }
  }

  return memberEmails;
}

async function loadExistingAuthEmails(emails: string[]) {
  const targetEmails = new Set(emails);
  const authEmails = new Set<string>();
  let page = 1;

  while (targetEmails.size > authEmails.size) {
    const res = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PAGE_SIZE,
    });

    if (res.error) {
      throw new Error(res.error.message);
    }

    const users = res.data.users ?? [];

    for (const user of users) {
      const email = user.email ? normalizeEmail(user.email) : "";

      if (email && targetEmails.has(email)) {
        authEmails.add(email);
      }
    }

    if (users.length < AUTH_USERS_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return authEmails;
}

export async function loadExistingSystemEmailLookup(
  emails: string[]
): Promise<ExistingSystemEmailLookup> {
  const normalizedEmails = uniqueNormalizedEmails(emails);

  if (normalizedEmails.length === 0) {
    return {
      memberEmails: new Set(),
      authEmails: new Set(),
    };
  }

  const [memberEmails, authEmails] = await Promise.all([
    loadExistingMemberEmails(normalizedEmails),
    loadExistingAuthEmails(normalizedEmails),
  ]);

  return {
    memberEmails,
    authEmails,
  };
}

export function getExistingSystemDuplicateMessage(
  email: string,
  lookup: ExistingSystemEmailLookup
) {
  const normalizedEmail = normalizeEmail(email);

  if (
    lookup.memberEmails.has(normalizedEmail) ||
    lookup.authEmails.has(normalizedEmail)
  ) {
    return "Correo ya existente.";
  }

  return null;
}

export async function findExistingSystemDuplicateMessage(email: string) {
  const lookup = await loadExistingSystemEmailLookup([email]);
  return getExistingSystemDuplicateMessage(email, lookup);
}

async function mapDuplicateOrError(
  email: string,
  status: number,
  code: CreateMemberFailure["code"],
  error: string
): Promise<CreateMemberFailure> {
  try {
    const duplicateMessage = await findExistingSystemDuplicateMessage(email);

    if (duplicateMessage) {
      return {
        ok: false,
        status: 400,
        code: "duplicate",
        error: duplicateMessage,
        inviteEmailSent: false,
      };
    }
  } catch {
    // Si falla la comprobación extra, devolvemos el error original.
  }

  return {
    ok: false,
    status,
    code,
    error,
    inviteEmailSent: false,
  };
}

async function provisionMemberInvite(
  params: CreateMemberParams,
  options?: {
    rollbackOnInviteEmailFailure?: boolean;
  }
): Promise<CreateMemberResult> {
  const configError = validateMemberInviteEmailConfig();

  if (configError) {
    return {
      ok: false,
      status: 500,
      code: "config",
      error: configError,
      inviteEmailSent: false,
    };
  }

  const fullName = params.fullName.trim();
  const email = normalizeEmail(params.email);
  const alias = normalizeAlias(params.alias);
  const role: MemberCreateRole = params.role === "admin" ? "admin" : "member";
  const rollbackOnInviteEmailFailure =
    options?.rollbackOnInviteEmailFailure ?? true;

  const inviteRes = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: {
        full_name: fullName,
        alias,
        role,
      },
      redirectTo: getInviteRedirectTo(),
    },
  });

  if (
    inviteRes.error ||
    !inviteRes.data.user ||
    !inviteRes.data.properties.action_link
  ) {
    const message =
      inviteRes.error?.message || "No se ha podido crear la invitación.";

    return mapDuplicateOrError(email, 500, "invite_link", message);
  }

  const invitedUser = inviteRes.data.user;
  const actionLink = inviteRes.data.properties.action_link;

  const insertMemberRes = await supabaseAdmin.from("members").insert({
    user_id: invitedUser.id,
    full_name: fullName,
    alias,
    email,
    role,
    is_active: true,
  });

  if (insertMemberRes.error) {
    await deleteInvitedUser(invitedUser.id);

    const failure = await mapDuplicateOrError(
      email,
      500,
      "member_insert",
      insertMemberRes.error.message
    );

    return {
      ...failure,
      userId: invitedUser.id,
    };
  }

  const inviteEmailRes = await sendMemberInviteEmail({
    fullName,
    email,
    actionLink,
  });

  if (!inviteEmailRes.ok) {
    if (rollbackOnInviteEmailFailure) {
      await cleanupInvitedMember(invitedUser.id);
    }

    return {
      ok: false,
      status: 500,
      code: "invite_email",
      error: inviteEmailRes.error,
      inviteEmailSent: false,
      userId: invitedUser.id,
      rolledBack: rollbackOnInviteEmailFailure,
    };
  }

  return {
    ok: true,
    userId: invitedUser.id,
    inviteEmailSent: true,
  };
}

export async function createMember(params: CreateMemberParams) {
  const duplicateMessage = await findExistingSystemDuplicateMessage(params.email);

  if (duplicateMessage) {
    return {
      ok: false,
      status: 400,
      code: "duplicate",
      error: duplicateMessage,
      inviteEmailSent: false,
    } satisfies CreateMemberResult;
  }

  return provisionMemberInvite(params);
}

export async function createMemberWithoutDuplicateCheck(
  params: CreateMemberParams
) {
  return provisionMemberInvite(params);
}
