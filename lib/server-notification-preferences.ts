import "server-only";

import {
  NOTIFICATION_PREFERENCE_COLUMN_BY_TYPE,
  type NotificationPreferenceKey,
  type NotificationPreferenceType,
} from "@/lib/notification-preferences";
import { supabaseAdmin } from "@/lib/supabase-admin";

type NotificationPreferenceQueryRow = {
  member_user_id: string;
} & Partial<Record<NotificationPreferenceKey, boolean | null>>;

function uniqueUserIds(userIds: string[]) {
  return Array.from(
    new Set(userIds.map((userId) => userId.trim()).filter(Boolean))
  );
}

export async function isMemberNotificationEnabled(
  memberUserId: string | null | undefined,
  type: NotificationPreferenceType
) {
  if (!memberUserId) {
    return true;
  }

  const column = NOTIFICATION_PREFERENCE_COLUMN_BY_TYPE[type];
  const res = await supabaseAdmin
    .from("notification_preferences")
    .select(column)
    .eq("member_user_id", memberUserId)
    .maybeSingle();

  if (res.error) {
    console.error("Error cargando preferencias de notificacion:", res.error);
    return true;
  }

  const row = res.data as Partial<
    Record<NotificationPreferenceKey, boolean | null>
  > | null;

  return row?.[column] !== false;
}

export async function getNotificationPreferencesForMembers(
  memberUserIds: string[],
  type: NotificationPreferenceType
) {
  const userIds = uniqueUserIds(memberUserIds);
  const enabledByUserId = new Map(userIds.map((userId) => [userId, true]));

  if (userIds.length === 0) {
    return enabledByUserId;
  }

  const column = NOTIFICATION_PREFERENCE_COLUMN_BY_TYPE[type];
  const res = await supabaseAdmin
    .from("notification_preferences")
    .select(`member_user_id,${column}`)
    .in("member_user_id", userIds);

  if (res.error) {
    console.error("Error cargando preferencias de notificacion:", res.error);
    return enabledByUserId;
  }

  for (const row of (res.data ?? []) as NotificationPreferenceQueryRow[]) {
    if (row[column] === false) {
      enabledByUserId.set(row.member_user_id, false);
    }
  }

  return enabledByUserId;
}
