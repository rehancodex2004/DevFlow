/**
 * The workflow is defined once so every task view stays in sync when a new
 * status is introduced. Add or reorder a status here instead of editing each
 * board independently.
 */
export const TASK_WORKFLOW = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "in_review", label: "In review" },
  { id: "done", label: "Done" },
  { id: "cancelled", label: "Cancelled" },
];

export const TASK_PRIORITIES = [
  { id: "no_priority", label: "No priority" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];
