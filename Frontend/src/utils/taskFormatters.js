/** Converts API values such as "in_progress" into readable interface text. */
export function formatTaskValue(value, fallback = "No priority") {
  return (value || fallback)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTaskPriority(priority) {
  return formatTaskValue(priority, "No priority");
}
