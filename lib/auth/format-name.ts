export function formatDisplayName(
  title: string,
  firstName: string,
  lastName: string,
): string {
  return [title, firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}
