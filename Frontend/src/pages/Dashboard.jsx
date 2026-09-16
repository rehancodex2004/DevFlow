import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { TASK_WORKFLOW } from "../constants/taskWorkflow";

import "../styles/dashboard.css";

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function isOverdue(task) {
  const dueDate = toDate(task.due_date);
  return Boolean(dueDate) && task.status !== "done" && task.status !== "cancelled" && dueDate < new Date();
}

function isDueToday(task) {
  const dueDate = toDate(task.due_date);
  return Boolean(dueDate) && isSameDay(dueDate, new Date());
}

function formatPriority(value) {
  return (value || "medium").split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function TaskRow({ task }) {
  return (
    <Link to={`/tasks/${task.id}`} className="dash-task-row">
      <span className={`status-dot status-${task.status}`} aria-hidden="true" />
      <span className="dash-task-title">{task.title}</span>
      <span className="dash-task-project">{task.project_name || "Project"}</span>
      <span className={`priority-badge ${task.priority || "medium"}`}>{formatPriority(task.priority)}</span>
    </Link>
  );
}

/** A compact semantic bar chart built from task records already visible to the user. */
function StatusDistribution({ items, total }) {
  if (!total) return <div className="dash-empty">No task status data yet.</div>;

  return (
    <div className="dash-status-chart" role="img" aria-label={`Task status distribution across ${total} tasks`}>
      {items.map((item) => {
        const percent = Math.round((item.count / total) * 100);
        return (
          <div className="dash-status-row" key={item.id}>
            <div className="dash-status-label">
              <span className={`status-dot status-${item.id}`} aria-hidden="true" />
              <span>{item.label}</span>
            </div>
            <div className="dash-status-track" aria-hidden="true"><span className={`dash-status-fill status-${item.id}`} style={{ width: `${percent}%` }} /></div>
            <span className="dash-status-value">{item.count}<small>{percent}%</small></span>
          </div>
        );
      })}
    </div>
  );
}

/** Counts last-updated task records instead of inventing activity events the API does not expose. */
function ActivityTrend({ days }) {
  const maximum = Math.max(...days.map((day) => day.count), 1);
  const total = days.reduce((sum, day) => sum + day.count, 0);

  if (!total) return <div className="dash-empty">No task updates recorded in the last seven days.</div>;

  return (
    <div className="dash-activity-chart" role="img" aria-label={`${total} task updates in the last seven days`}>
      {days.map((day) => (
        <div className="dash-activity-day" key={day.key}>
          <span className="dash-activity-count">{day.count || ""}</span>
          <div className="dash-activity-column"><span style={{ height: `${Math.max((day.count / maximum) * 100, day.count ? 12 : 0)}%` }} /></div>
          <span className="dash-activity-label">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [taskRes, projectRes] = await Promise.all([api.getMyTasks(), api.projects()]);
        if (!cancelled) {
          setTasks(taskRes.data || []);
          setProjects(projectRes.data || []);
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || "Unable to load your dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const myTasks = useMemo(
    () => tasks.filter((task) => Number(task.assignee_id) === Number(user?.id)),
    [tasks, user],
  );
  const overdue = useMemo(() => tasks.filter(isOverdue), [tasks]);
  const dueToday = useMemo(() => myTasks.filter(isDueToday), [myTasks]);
  const active = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.status !== "cancelled"),
    [tasks],
  );

  const statusSummary = useMemo(
    () => TASK_WORKFLOW.map((status) => ({
      ...status,
      count: tasks.filter((task) => task.status === status.id).length,
    })),
    [tasks],
  );

  const activityTrend = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const count = tasks.filter((task) => {
        const updatedAt = toDate(task.updated_at || task.created_at);
        return updatedAt && isSameDay(updatedAt, date);
      }).length;

      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString(undefined, { weekday: "narrow" }),
        count,
      };
    });
  }, [tasks]);

  const recentTasks = useMemo(
    () => [...tasks].sort((a, b) => {
      const bDate = toDate(b.updated_at || b.created_at)?.getTime() || 0;
      const aDate = toDate(a.updated_at || a.created_at)?.getTime() || 0;
      return bDate - aDate;
    }).slice(0, 6),
    [tasks],
  );

  const projectHealth = useMemo(() => projects.map((project) => {
    const projectTasks = tasks.filter((task) => Number(task.project_id) === Number(project.id));
    const total = projectTasks.length;
    const done = projectTasks.filter((task) => task.status === "done").length;
    const overdueCount = projectTasks.filter(isOverdue).length;
    let health = "Healthy";
    if (overdueCount > 0) health = "At risk";
    if (total > 0 && overdueCount / total > 0.3) health = "Needs attention";

    return { ...project, total, done, overdueCount, percent: total ? Math.round((done / total) * 100) : 0, health };
  }).sort((a, b) => b.overdueCount - a.overdueCount || b.total - a.total), [projects, tasks]);

  if (loading) return <div className="screen-loader">Loading your workspace…</div>;

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1>Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="muted">Track delivery and task health here. Workspace administration stays in Organizations.</p>
        </div>
      </header>

      {error && <div className="dash-error" role="alert">{error}</div>}

      <section className="dash-stat-row" aria-label="Workspace summary">
        <div className="dash-stat"><span className="dash-stat-value">{projects.length}</span><span className="dash-stat-label">Projects</span></div>
        <div className="dash-stat"><span className="dash-stat-value">{tasks.length}</span><span className="dash-stat-label">Visible tasks</span></div>
        <div className="dash-stat"><span className="dash-stat-value">{active.length}</span><span className="dash-stat-label">Active tasks</span></div>
        <div className={`dash-stat ${overdue.length ? "dash-stat-danger" : "dash-stat-success"}`}><span className="dash-stat-value">{overdue.length}</span><span className="dash-stat-label">Overdue</span></div>
      </section>

      <div className="dash-grid">
        <section className="section-card dash-section">
          <div className="dash-section-header"><div><h3>Task status</h3><p>All visible tasks</p></div><Link to="/tasks" className="link-quiet">Open board</Link></div>
          <StatusDistribution items={statusSummary} total={tasks.length} />
        </section>

        <section className="section-card dash-section">
          <div className="dash-section-header"><div><h3>Activity trend</h3><p>Tasks updated in the last 7 days</p></div></div>
          <ActivityTrend days={activityTrend} />
        </section>

        <section className="section-card dash-section">
          <div className="dash-section-header"><div><h3>My work</h3><p>{dueToday.length ? `${dueToday.length} due today` : "No tasks due today"}</p></div><Link to="/tasks" className="link-quiet">View all</Link></div>
          {myTasks.length === 0 ? (
            <div className="dash-empty">No tasks are assigned to you yet.</div>
          ) : (
            <div className="dash-task-list">
              {[...myTasks].sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a))).slice(0, 6).map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          )}
        </section>

        <section className="section-card dash-section">
          <div className="dash-section-header"><div><h3>Recently changed</h3><p>Latest task updates</p></div><Link to="/tasks" className="link-quiet">View all</Link></div>
          {recentTasks.length ? <div className="dash-task-list">{recentTasks.map((task) => <TaskRow key={task.id} task={task} />)}</div> : <div className="dash-empty">No tasks have been created yet.</div>}
        </section>

        <section className="section-card dash-section dash-section--wide">
          <div className="dash-section-header"><div><h3>Project progress</h3><p>Completion and overdue work by project</p></div><Link to="/projects" className="link-quiet">View projects</Link></div>
          {projectHealth.length === 0 ? (
            <div className="dash-empty">No projects yet.</div>
          ) : (
            <div className="dash-project-list">
              {projectHealth.slice(0, 6).map((project) => (
                <Link to={`/projects/${project.id}`} key={project.id} className="dash-project-row">
                  <div className="dash-project-top"><span className="dash-project-name">{project.name}</span><span className={`health-badge health-${project.health.replace(" ", "-").toLowerCase()}`}>{project.health}</span></div>
                  <div className="dash-project-bar" aria-label={`${project.percent}% complete`}><div className="dash-project-bar-fill" style={{ width: `${project.percent}%` }} /></div>
                  <div className="dash-project-meta">{project.done}/{project.total} tasks complete{project.overdueCount > 0 ? ` · ${project.overdueCount} overdue` : ""}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
