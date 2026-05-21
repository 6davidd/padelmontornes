export const NOTIFICATION_PREFERENCE_KEYS = [
  "booking_created_email",
  "added_to_match_email",
  "match_reminder_email",
  "match_completed_email",
] as const;

export type NotificationPreferenceKey =
  (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

export type NotificationPreferenceType =
  | "booking_created"
  | "added_to_match"
  | "match_reminder"
  | "match_completed";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export type NotificationPreferenceRow = {
  member_user_id?: string | null;
} & Partial<Record<NotificationPreferenceKey, boolean | null>>;

export const NOTIFICATION_PREFERENCE_DEFAULTS: NotificationPreferences = {
  booking_created_email: true,
  added_to_match_email: true,
  match_reminder_email: true,
  match_completed_email: true,
};

export const NOTIFICATION_PREFERENCE_SELECT = [
  "member_user_id",
  ...NOTIFICATION_PREFERENCE_KEYS,
].join(",");

export const NOTIFICATION_PREFERENCE_COLUMN_BY_TYPE: Record<
  NotificationPreferenceType,
  NotificationPreferenceKey
> = {
  booking_created: "booking_created_email",
  added_to_match: "added_to_match_email",
  match_reminder: "match_reminder_email",
  match_completed: "match_completed_email",
};

export function normalizeNotificationPreferences(
  row?: NotificationPreferenceRow | null
): NotificationPreferences {
  return {
    booking_created_email: row?.booking_created_email !== false,
    added_to_match_email: row?.added_to_match_email !== false,
    match_reminder_email: row?.match_reminder_email !== false,
    match_completed_email: row?.match_completed_email !== false,
  };
}

export function getNotificationPreferenceValue(
  row: NotificationPreferenceRow | null | undefined,
  type: NotificationPreferenceType
) {
  const column = NOTIFICATION_PREFERENCE_COLUMN_BY_TYPE[type];
  return row?.[column] !== false;
}
