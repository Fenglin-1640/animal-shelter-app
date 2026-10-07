import { StatusChip } from "@/components/shared/status-chip";
import { NOTIFICATION_CATEGORY } from "@/lib/notifications/notification-style";
import type { NotificationItem } from "@/lib/notifications/types";
import { formatDate } from "@/lib/shared/dates";

export function NotificationCard({
  item,
  isRead,
  onToggleRead,
}: {
  item: NotificationItem;
  isRead: boolean;
  onToggleRead: () => void;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusChip label={item.type} category={NOTIFICATION_CATEGORY[item.type]} />
        <span className="text-xs text-text-muted">
          {isRead ? "Read" : "Unread"} &middot; {formatDate(item.createdAt)}
        </span>
      </div>

      <h3 className="text-base font-semibold text-text">{item.title}</h3>
      <p className="text-sm text-text-muted">{item.detail}</p>
      {item.dueDate && (
        <p className="text-xs font-semibold text-text-muted">
          Due {formatDate(item.dueDate)}
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={onToggleRead}
          className="mt-1 h-8 rounded-[12px] border border-border bg-page px-3 text-xs font-semibold text-text hover:bg-surface-active"
        >
          {isRead ? "Mark as unread" : "Mark as read"}
        </button>
      </div>
    </article>
  );
}
