// ============================================================
// TASK
// ============================================================

function taskToText(task) {

  return `
Type: Task

Title: ${task.title || ""}

Description:
${task.description || ""}

Status:
${task.status || ""}

Priority:
${task.priority || ""}

Project:
${task.project_name || ""}

Organization:
${task.organization_name || ""}

Assignee:
${task.assignee_name || ""}
`.trim();
}


// ============================================================
// PROJECT
// ============================================================

function projectToText(project) {

  return `
Type: Project

Project Name:
${project.name || ""}

Description:
${project.description || ""}

Status:
${project.status || ""}

Organization:
${project.organization_name || ""}
`.trim();
}


// ============================================================
// ORGANIZATION
// ============================================================

function organizationToText(organization) {

  return `
Type: Organization

Organization Name:
${organization.name || ""}

Description:
${organization.description || ""}
`.trim();
}


// ============================================================
// COMMENT
// ============================================================

function commentToText(comment) {

  return `
Type: Task Comment

Task:
${comment.task_title || ""}

Comment:
${comment.content || ""}

Author:
${comment.user_name || ""}
`.trim();
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  taskToText,
  projectToText,
  organizationToText,
  commentToText
};