// Per-account "mark as read" state for the Notification list.
import type { NotificationReadOverride } from "@/lib/notifications/serialize";
import { getJson, send } from "@/lib/shared/http";

export async function loadReadOverrides(
  normalizedEmail: string,
): Promise<Record<string, boolean>> {
  const { items } = await getJson<{ items: NotificationReadOverride[] }>("/api/notification-read-overrides");
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
  await send("/api/notification-read-overrides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalizedEmail, notificationId, isRead }),
  });
}
