// The 6 status semantics from PRD 5.8.3. Chip backgrounds are tinted
// (never solid) so the always-neutral chip text keeps AA contrast in both
// themes; color and icon reinforce the category, text is the real signal.
export type StatusCategory =
  | "success"
  | "progress"
  | "caution"
  | "attention"
  | "complete"
  | "neutral";

export const CATEGORY_STYLE: Record<
  StatusCategory,
  { border: string; background: string; icon: string }
> = {
  success: {
    border: "border-primary",
    background: "bg-primary/15",
    icon: "text-primary",
  },
  progress: {
    border: "border-secondary",
    background: "bg-secondary/15",
    icon: "text-secondary",
  },
  caution: {
    border: "border-gold",
    background: "bg-gold/15",
    icon: "text-gold",
  },
  attention: {
    border: "border-danger",
    background: "bg-danger/15",
    icon: "text-danger",
  },
  complete: {
    border: "border-rose",
    background: "bg-rose/15",
    icon: "text-rose",
  },
  neutral: {
    border: "border-border-strong",
    background: "bg-surface-active",
    icon: "text-text-muted",
  },
};
