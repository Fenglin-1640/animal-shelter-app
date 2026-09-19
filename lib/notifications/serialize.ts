export interface NotificationReadOverrideRow {
  id: string;
  email: string;
  notificationId: string;
  isRead: number;
}

export interface NotificationReadOverride {
  email: string;
  notificationId: string;
  isRead: boolean;
}

export function toNotificationReadOverride(
  row: NotificationReadOverrideRow,
): NotificationReadOverride {
  return {
    email: row.email,
    notificationId: row.notificationId,
    isRead: row.isRead === 1,
  };
}

export function toNotificationReadOverrideRow(
  override: NotificationReadOverride,
): NotificationReadOverrideRow {
  return {
    id: `${override.email}:${override.notificationId}`,
    email: override.email,
    notificationId: override.notificationId,
    isRead: override.isRead ? 1 : 0,
  };
}
