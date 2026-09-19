// Per-account "mark as read" state for the Notification list.
import type { NotificationReadOverride } from "@/lib/notifications/serialize";

export async function loadReadOverrides(
  normalizedEmail: string,
): Promise<Record<string, boolean>> {
  const response = await fetch("/api/notification-read-overrides");
  const { items } = (await response.json()) as { items: NotificationReadOverride[] };
  const overrides: Record<string, boolean> = {};
  for (const item of items) {
    if (item.email === normalizedEmail) {
      overrides[item.notificationId] = item.isRead;
    }
  }
  return overrides;
}

export async function setReadOverride(
  normalizedEmail: string,
  notificationId: string,
  isRead: boolean,
) {
  await fetch("/api/notification-read-overrides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, notificationId, isRead }),
  });
}
