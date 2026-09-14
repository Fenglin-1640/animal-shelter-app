import { getAnimalById } from "@/lib/animals/animal-store";
import { getMockNotifications } from "@/lib/notifications/mock-notifications";
import type { NotificationItem } from "@/lib/notifications/types";
import { listHoldsNeedingReminder } from "@/lib/statutory-hold/store";

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

// FR-MC-02 step 4 / FR-NOT-01 "Statutory Hold approaching end date" - the
// one notification type with a real, dynamically-computed source so far.
// The other 8 event types remain static mock data (lib/mock-notifications)
// since the features that would generate them for real aren't built yet.
// Computed live from StatutoryHold records rather than persisted as its
// own record, since it's fully derived from data that already exists.
function getStatutoryHoldNotifications(): NotificationItem[] {
  return listHoldsNeedingReminder().flatMap((hold) => {
    const animal = getAnimalById(hold.animalId);
    if (!animal) return [];
    const remaining = daysUntil(hold.holdEndAt);
    const item: NotificationItem = {
      id: `hold-reminder-${hold.id}`,
      type: "Statutory Hold",
      title: "Statutory hold ending soon",
      detail: `${animal.name}'s statutory hold ends in ${remaining} day(s). Confirm owner reclamation or wait for it to expire back to Under Assessment.`,
      createdAt: hold.createdAt,
      dueDate: hold.holdEndAt,
      roles: ["Shelter Staff Member", "Administrator"],
      defaultRead: false,
    };
    return [item];
  });
}

export function getAllNotifications(): NotificationItem[] {
  return [...getStatutoryHoldNotifications(), ...getMockNotifications()];
}
