import {
  CATEGORY_STYLE,
  NOTIFICATION_CATEGORY,
} from "@/lib/notifications/notification-style";
import type { NotificationItem } from "@/lib/notifications/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function CategoryIcon({ category }: { category: "caution" | "progress" | "attention" }) {
  if (category === "attention") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z" />
      </svg>
    );
  }
  if (category === "progress") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v5h-5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function NotificationCard({
  item,
  isRead,
  onToggleRead,
}: {
  item: NotificationItem;
  isRead: boolean;
  onToggleRead: () => void;
}) {
  const category = NOTIFICATION_CATEGORY[item.type];
  const style = CATEGORY_STYLE[category];

  return (
    <article className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[0_2px_8px_rgba(200,182,173,0.2)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold text-text ${style.border} ${style.background}`}
        >
          <span className={style.icon}>
            <CategoryIcon category={category} />
          </span>
          {item.type}
        </span>
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
