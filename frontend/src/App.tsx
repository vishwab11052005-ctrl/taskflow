import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, motion } from "framer-motion";

import {
  Activity,
  AlertCircle,
  ArrowDownUp,
  Atom,
  BarChart3,
  Bell,
  CheckCircle2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";

import AuthScreen from "./components/AuthScreen";
import TaskModal from "./components/TaskModal";

import {
  api,
  getToken,
  login,
  register,
  saveToken,
} from "./lib/api";

import type {
  Project,
  Task,
  User,
  TaskStatus,
} from "./types";

import type { TaskPayload } from "./lib/api";

const statuses: TaskStatus[] = [
  "To Do",
  "In Progress",
  "Blocked",
  "Completed",
];

const colors = [
  "#8b7cff",
  "#53c8bd",
  "#ffb86b",
  "#f28aaf",
];

type TaskAssignment = { mode: "individual" | "assigned"; assignee: string };

const TASK_ASSIGNMENTS_STORAGE_KEY = "taskflow.taskAssignments.v1";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] =
    useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<Record<string, TaskAssignment>>(() => {
    try {
      const saved = window.localStorage.getItem(TASK_ASSIGNMENTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) as Record<string, TaskAssignment> : {};
    } catch {
      return {};
    }
  });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
  const [calendarTask, setCalendarTask] = useState<Task | null>(null);
  const [celebrationTask, setCelebrationTask] = useState<Task | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [notificationTasks, setNotificationTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All tasks");
  const [showProjectForm, setShowProjectForm] =
    useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] =
    useState("");
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] =
    useState<Task | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [preferences, setPreferences] = useState(() => {
    const defaults = { accent: "purple", compactCards: false, celebrations: true, defaultFilter: "All tasks" };
    try {
      const stored = window.localStorage.getItem("taskflow.preferences.v1");
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch { return defaults; }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.taskflowAccent = preferences.accent;
    root.dataset.taskflowCompact = preferences.compactCards ? "true" : "false";
  }, [preferences.accent, preferences.compactCards]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationPopupPosition, setNotificationPopupPosition] = useState({ top: 76, right: 16 });
  const [profilePopupPosition, setProfilePopupPosition] = useState({ top: 76, right: 16 });

  const openNotificationsPopup = () => {
    const rect = notificationButtonRef.current?.getBoundingClientRect();
    if (rect) setNotificationPopupPosition({ top: Math.round(rect.bottom + 10), right: Math.max(12, Math.round(window.innerWidth - rect.right)) });
    setNotificationsOpen((open) => !open);
    setProfileOpen(false);
  };

  const openProfilePopup = () => {
    const rect = profileButtonRef.current?.getBoundingClientRect();
    if (rect) setProfilePopupPosition({ top: Math.round(rect.bottom + 10), right: Math.max(12, Math.round(window.innerWidth - rect.right)) });
    setProfileOpen((open) => !open);
    setNotificationsOpen(false);
  };


  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const [insights, setInsights] = useState<{
    summary?: string;
    risks?: string[];
    blockers?: string[];
    next_actions?: string[];
  } | null>(null);

  const [insightsBusy, setInsightsBusy] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(TASK_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(taskAssignments));
    } catch {
      // Assignment UI remains usable for the current session if storage is unavailable.
    }
  }, [taskAssignments]);

  const updateTaskAssignment = (taskId: string | number, patch: Partial<TaskAssignment>) => {
    const key = String(taskId);
    setTaskAssignments((current) => {
      const previous = current[key] ?? { mode: "individual", assignee: "" };
      const next = { ...previous, ...patch };
      if (next.mode === "individual") next.assignee = "";
      return { ...current, [key]: next };
    });
  };

  useEffect(() => {
    if (!profileOpen && !notificationsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insideProfile =
        profileMenuRef.current?.contains(target) ||
        profileButtonRef.current?.contains(target) ||
        document.querySelector(".profile-popover")?.contains(target) ||
        document.querySelector(".taskflow-profile-panel")?.contains(target);
      const insideNotifications =
        notificationButtonRef.current?.contains(target) ||
        document.querySelector(".notification-popover")?.contains(target);

      if (!insideProfile && !insideNotifications) {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen, notificationsOpen]);


  const loadProjects = useCallback(async () => {
    const result = await api.projects();

    setProjects(result);

    setActiveProject((current) =>
      current &&
      result.some((project) => project.id === current)
        ? current
        : result[0]?.id ?? null
    );
  }, []);

  const loadTasks = useCallback(
    async (projectId: number) => {
      const result = await api.tasks(projectId);
      setTasks(result);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAllNotificationTasks() {
      if (!user || projects.length === 0) {
        setNotificationTasks([]);
        return;
      }

      try {
        const taskGroups = await Promise.all(
          projects.map((project) => api.tasks(project.id))
        );

        if (!cancelled) {
          setNotificationTasks(taskGroups.flat());
        }
      } catch {
        if (!cancelled) {
          setNotificationTasks(tasks);
        }
      }
    }

    void loadAllNotificationTasks();

    return () => {
      cancelled = true;
    };
  }, [user, projects]);

  useEffect(() => {
    async function init() {
      if (!getToken()) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await api.me();
        const projectsData = await api.projects();

        setUser(currentUser);
        setProjects(projectsData);
        setActiveProject(projectsData[0]?.id ?? null);
      } catch {
        saveToken(null);
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, []);

  useEffect(() => {
    if (user && activeProject) {
      setError("");

      void loadTasks(activeProject).catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load tasks."
        );
      });

      setInsights(null);
    } else {
      setTasks([]);
    }
  }, [user, activeProject, loadTasks]);

  const active =
    projects.find(
      (project) => project.id === activeProject
    ) ?? null;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const calendarDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mondayOffset = (today.getDay() + 6) % 7;
    today.setDate(today.getDate() - mondayOffset + calendarWeekOffset * 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date;
    });
  }, [calendarWeekOffset]);

  const calendarDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatCalendarDate = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const searchableText = [
        task.title,
        task.description,
        task.category,
        ...task.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !query || searchableText.includes(query);

      const matchesStatus =
        statusFilter === "All tasks" ||
        task.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [tasks, search, statusFilter]);

  const completed = tasks.filter(
    (task) => task.status === "Completed"
  ).length;

  const blocked = tasks.filter(
    (task) => task.status === "Blocked"
  ).length;

  const overdue = tasks.filter(
    (task) =>
      task.due_date &&
      task.due_date <
        new Date().toISOString().slice(0, 10) &&
      task.status !== "Completed"
  ).length;

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  const notifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return notificationTasks
      .filter((task) => task.due_date && task.status !== "Completed")
      .map((task) => {
        const dueDate = new Date(`${task.due_date}T00:00:00`);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.round(
          (dueDate.getTime() - today.getTime()) / 86400000
        );

        if (daysUntilDue < 0) {
          return {
            id: task.id,
            title: task.title,
            message: `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"}`,
            kind: "overdue" as const,
            dueDate: task.due_date,
          };
        }

        if (daysUntilDue <= 3) {
          return {
            id: task.id,
            title: task.title,
            message:
              daysUntilDue === 0
                ? "Due today"
                : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
            kind: "upcoming" as const,
            dueDate: task.due_date,
          };
        }

        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === "overdue" ? -1 : 1;
        }
        return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      });
  }, [notificationTasks]);

  async function handleAuth(
    mode: "login" | "register",
    name: string,
    email: string,
    password: string
  ) {
    setAuthBusy(true);
    setAuthError("");

    try {
      const loggedIn =
        mode === "register"
          ? await register(name, email, password)
          : await login(email, password);

      setUser(loggedIn);

      const projectData = await api.projects();

      setProjects(projectData);
      setActiveProject(projectData[0]?.id ?? null);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : "Authentication failed."
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function createProject(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!projectName.trim()) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const project = await api.createProject({
        name: projectName.trim(),
        description: projectDescription,
        color: colors[
          projects.length % colors.length
        ],
      });

      setProjects((current) => [
        project,
        ...current,
      ]);

      setActiveProject(project.id);
      setProjectName("");
      setProjectDescription("");
      setShowProjectForm(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create project."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(payload: TaskPayload) {
    if (!activeProject) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      if (editingTask) {
        await api.updateTask(
          editingTask.id,
          payload
        );
      } else {
        await api.createTask(
          activeProject,
          payload
        );
      }

      await loadTasks(activeProject);
      await loadProjects();

      setTaskModal(false);
      setEditingTask(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save task."
      );
    } finally {
      setBusy(false);
    }
  }

  async function completeTaskFromCard(task: Task) {
    if (task.status === "Completed" || completingTaskId === String(task.id)) return;
    setCompletingTaskId(String(task.id));
    setError("");
    const payload = {
      title: task.title,
      description: task.description,
      status: "Completed" as TaskStatus,
      priority: task.priority,
      category: task.category,
      tags: task.tags,
      due_date: task.due_date,
    };
    // Update immediately so the board feels responsive, then persist to the API.
    setTasks((current) => current.map((item) =>
      String(item.id) === String(task.id) ? { ...item, status: "Completed" } : item
    ));
    try {
      await api.updateTask(task.id, payload);
      await loadTasks(task.project_id);
      await loadProjects();
      setCelebrationTask({ ...task, status: "Completed" });
    } catch (err) {
      setTasks((current) => current.map((item) =>
        String(item.id) === String(task.id) ? { ...item, status: task.status } : item
      ));
      setError(err instanceof Error ? err.message : "Could not complete task.");
      await loadTasks(task.project_id).catch(() => undefined);
    } finally {
      setCompletingTaskId(null);
    }
  }

  async function deleteTask(task: Task) {
    if (
      !window.confirm(
        `Delete "${task.title}"?`
      )
    ) {
      return;
    }

    try {
      await api.deleteTask(task.id);

      setTasks((current) =>
        current.filter(
          (item) => item.id !== task.id
        )
      );

      await loadProjects();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete task."
      );
    }
  }

  async function deleteProject() {
    if (
      !active ||
      !window.confirm(
        `Delete project "${active.name}" and all its tasks?`
      )
    ) {
      return;
    }

    try {
      await api.deleteProject(active.id);

      const remaining = projects.filter(
        (project) => project.id !== active.id
      );

      setProjects(remaining);
      setActiveProject(remaining[0]?.id ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete project."
      );
    }
  }

  async function getInsights() {
    if (!activeProject) {
      return;
    }

    setInsightsBusy(true);
    setError("");

    try {
      setInsights(
        await api.projectInsights(activeProject)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate insights."
      );
    } finally {
      setInsightsBusy(false);
    }
  }

  function logout() {
    saveToken(null);

    setUser(null);
    setProjects([]);
    setTasks([]);
    setNotificationTasks([]);
    setActiveProject(null);
    setInsights(null);
    setSearch("");
    setStatusFilter("All tasks");
    setProfileOpen(false);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-orb" />
        <span>Preparing your workspace</span>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onSubmit={handleAuth}
        busy={authBusy}
        error={authError}
      />
    );
  }

  return (
    <div className="app-shell">
      <style>{`
        /* TaskFlow AI: consistent scrollbar styling across the whole app */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(157, 143, 255, 0.62) rgba(255, 255, 255, 0.045);
        }
        *::-webkit-scrollbar {
          width: 9px;
          height: 9px;
        }
        *::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.045);
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.025);
        }
        *::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(167, 153, 255, 0.78), rgba(83, 200, 189, 0.62));
          border: 2px solid rgba(18, 20, 31, 0.82);
          border-radius: 999px;
          min-height: 28px;
        }
        *::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #b8adff, #6bd6cb);
        }
        /* Hide platform-specific up/down scrollbar buttons (the yellow arrows in the screenshot). */
        *::-webkit-scrollbar-button,
        *::-webkit-scrollbar-button:single-button,
        *::-webkit-scrollbar-corner {
          display: none;
          width: 0;
          height: 0;
          background: transparent;
        }
        /* Keep keyboard focus and status dropdown arrows on-brand. */
        select:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible {
          outline: 2px solid rgba(167, 153, 255, 0.78);
          outline-offset: 2px;
        }
      `}</style>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <AnimatePresence>
        {mobileNav && (
          <motion.div
            className="mobile-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileNav(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`sidebar glass-panel ${
          mobileNav ? "sidebar-open" : ""
        }`}
      >
        <div className="brand-mark">
          <span className="brand-symbol">
            <Atom size={20} />
          </span>

          <span>
            taskflow<span className="brand-ai">.ai</span>
          </span>
        </div>

        <div className="workspace-switch">
          <div className="workspace-avatar">T</div>

          <div className="workspace-meta">
            <strong>Studio workspace</strong>
            <span>Free plan</span>
          </div>

          <ChevronDown size={15} />
        </div>

        <div className="side-label">WORKSPACE</div>

        <button
          className="nav-item active"
          onClick={() => {
            setStatusFilter("All tasks");
            setMobileNav(false);
          }}
        >
          <LayoutDashboard size={17} />
          Overview
          <span className="nav-pill">Ctrl 1</span>
        </button>

        <button
          className="nav-item"
          onClick={() => {
            setShowProjectForm(true);
            setMobileNav(false);
          }}
        >
          <FolderKanban size={17} />
          Projects
          <Plus
            size={15}
            className="nav-trailing"
          />
        </button>

        <button
          className="nav-item"
          onClick={() => {
            setStatusFilter("Blocked");
            setMobileNav(false);
          }}
        >
          <Activity size={17} />
          Blocked tasks
          <span className="count-badge">
            {blocked}
          </span>
        </button>

        <div className="side-label projects-label">
          YOUR PROJECTS

          <button
            onClick={() => setShowProjectForm(true)}
            aria-label="Add project"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-nav ${
                activeProject === project.id
                  ? "selected"
                  : ""
              }`}
              onClick={() => {
                setActiveProject(project.id);
                setMobileNav(false);
              }}
            >
              <span
                className="project-dot"
                style={{
                  background: project.color,
                }}
              />

              <span className="project-nav-name">
                {project.name}
              </span>

              <span className="project-count">
                {project.task_count}
              </span>
            </button>
          ))}

          {!projects.length && (
            <div className="empty-side">
              Your projects will appear here.
            </div>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">
              <Sparkles size={16} />
            </div>

            <strong>A little more clarity</strong>

            <p>
              Let AI help you find the next right move.
            </p>

            <button
              onClick={getInsights}
              disabled={!activeProject || insightsBusy}
            >
              Explore AI insights
              <ArrowDownUp size={13} />
            </button>
          </div>

          <button
            className="nav-item"
            onClick={() => { setSettingsOpen(true); setMobileNav(false); }}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
          >
            <Settings2 size={17} />
            Settings
            <span className="nav-pill">Ctrl ,</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>
              {active?.name || "Overview"}
            </strong>
          </div>

          <div className="topbar-actions">
            <div
              className={`search-box ${
                search ? "search-box-active" : ""
              }`}
            >
              <Search size={16} />

              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search tasks…"
                aria-label="Search tasks by title, description, category, or tag"
              />

              {search ? (
                <button
                  className="search-clear"
                  onClick={() => {
                    setSearch("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  type="button"
                >
                  <X size={13} />
                </button>
              ) : (
                <kbd>Ctrl K</kbd>
              )}
            </div>

            <div className="notification-menu-wrap">
              <button
                ref={notificationButtonRef}
                className={`icon-button notification-button ${
                  notificationsOpen ? "notification-button-open" : ""
                }`}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={(event) => { event.stopPropagation(); openNotificationsPopup(); }}
                type="button"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="notification-count">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
                <i />
              </button>

              {notificationsOpen &&
                createPortal(
                    <motion.section
                      className="notification-popover glass-panel"
                      style={{
                        position: "fixed",
                        top: `${notificationPopupPosition.top}px`,
                        right: `${notificationPopupPosition.right}px`,
                        zIndex: 2147483647,
                        display: "block",
                        visibility: "visible",
                        pointerEvents: "auto",
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      role="dialog"
                      aria-label="Task notifications"
                    >
                      <div className="notification-popover-header">
                        <div>
                          <strong>Notifications</strong>
                          <span>
                            {notifications.length === 0
                              ? "You're all caught up"
                              : `${notifications.length} deadline alert${notifications.length === 1 ? "" : "s"}`}
                          </span>
                        </div>
                        <button
                          className="icon-button"
                          onClick={() => setNotificationsOpen(false)}
                          aria-label="Close notifications"
                          type="button"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="notification-list">
                        {notifications.length === 0 ? (
                          <div className="notification-empty">
                            <span className="notification-empty-icon">
                              <CheckCircle2 size={20} />
                            </span>
                            <strong>No deadline alerts</strong>
                            <p>
                              Tasks due within the next 3 days or already overdue will appear here.
                            </p>
                          </div>
                        ) : (
                          notifications.map((item) => (
                            <button
                              className="notification-item"
                              key={item.id}
                              type="button"
                              onClick={() => {
                                const task = notificationTasks.find(
                                  (candidate) => candidate.id === item.id
                                );
                                if (task) {
                                  setActiveProject(task.project_id);
                                  setSearch(task.title);
                                  setStatusFilter("All tasks");
                                }
                                setNotificationsOpen(false);
                              }}
                            >
                              <span
                                className={`notification-status-icon ${
                                  item.kind === "overdue"
                                    ? "notification-overdue"
                                    : "notification-upcoming"
                                }`}
                              >
                                {item.kind === "overdue" ? (
                                  <AlertCircle size={16} />
                                ) : (
                                  <Clock3 size={16} />
                                )}
                              </span>
                              <span className="notification-item-content">
                                <strong>{item.title}</strong>
                                <span>{item.message}</span>
                                <small>Due {item.dueDate}</small>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.section>,
                    document.body
                  )}
            </div>

            <div
              className="profile-menu-wrap"
              ref={profileMenuRef}
            >
              <button
                ref={profileButtonRef}
                className={`top-avatar ${
                  profileOpen ? "top-avatar-open" : ""
                }`}
                onClick={(event) => { event.stopPropagation(); openProfilePopup(); }}
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
                type="button"
              >
                {user.name.charAt(0).toUpperCase()}
              </button>

              {profileOpen && createPortal(
                  <div
                    className="taskflow-profile-panel"
                    style={{
                      position: "fixed",
                      top: `${profilePopupPosition.top}px`,
                      right: `${profilePopupPosition.right}px`,
                      zIndex: 2147483647,
                      display: "block",
                      visibility: "visible",
                      opacity: 1,
                      pointerEvents: "auto",
                      width: "min(320px, calc(100vw - 24px))",
                      padding: "18px",
                      color: "#f7f7fb",
                      background: "#171923",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: "16px",
                      boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-label="Profile menu"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          display: "grid",
                          placeItems: "center",
                          flex: "0 0 42px",
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #8b7cff, #53c8bd)",
                          color: "#11121a",
                          fontWeight: 800,
                          fontSize: "18px",
                        }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                        <strong style={{ color: "#fff", fontSize: "15px" }}>{user.name}</strong>
                        <span style={{ color: "#b8bbca", fontSize: "12px", overflowWrap: "anywhere" }}>{user.email}</span>
                      </div>
                    </div>

                    <div style={{ height: "1px", background: "rgba(255,255,255,0.12)", margin: "16px 0" }} />

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                      <span style={{ color: "#aeb2c4", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Account email</span>
                      <strong style={{ color: "#f7f7fb", fontSize: "13px", overflowWrap: "anywhere" }}>{user.email}</strong>
                    </div>

                    <button
                      onClick={logout}
                      type="button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "11px 12px",
                        border: "1px solid rgba(255,120,140,0.35)",
                        borderRadius: "10px",
                        background: "rgba(255,90,120,0.12)",
                        color: "#ffb4c1",
                        font: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      <LogOut size={15} />
                      Log out
                    </button>
                  </div>,
                  document.body
                )}
            </div>
          </div>
        </header>

        <div className="content-wrap">
          {error && (
            <div className="global-error">
              <AlertCircle size={16} />

              <span>{error}</span>

              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {!projects.length ? (
            <motion.section
              className="empty-project glass-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="empty-icon">
                <FolderKanban size={22} />
              </div>

              <div className="eyebrow">
                A FRESH START
              </div>

              <h2>Your workspace starts here.</h2>

              <p>
                Create your first project to organise your
                tasks, track progress, and uncover your
                next steps.
              </p>

              <button
                className="primary-button"
                onClick={() => setShowProjectForm(true)}
              >
                <Plus size={16} />
                Create your first project
              </button>
            </motion.section>
          ) : (
            <>
              <motion.section
                className="welcome-row"
                initial={{
                  opacity: 0,
                  y: 14,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.45,
                }}
              >
                <div>
                  <div className="eyebrow">
                    <span className="status-dot" />
                    YOUR WORKSPACE, IN FOCUS
                  </div>

                  <h1>
                    Good to see you,{" "}
                    <span>
                      {user.name.split(" ")[0]}.
                    </span>
                  </h1>

                  <p>
                    Small steps. Meaningful progress.
                    Let's make today count.
                  </p>
                </div>

                <button
                  className="primary-button new-task-button"
                  onClick={() => {
                    setEditingTask(null);
                    setTaskModal(true);
                  }}
                >
                  <Plus size={16} />
                  New task
                </button>
              </motion.section>

              <section className="stats-grid">
                <StatCard
                  icon={<Activity size={17} />}
                  label="Total tasks"
                  value={String(tasks.length).padStart(2, "0")}
                  detail={`${projects.length} projects in your workspace`}
                  trend="Your workspace"
                  delay={0.05}
                />

                <StatCard
                  icon={<CheckCircle2 size={17} />}
                  label="Completed"
                  value={String(completed).padStart(2, "0")}
                  detail={`${progress}% of current project`}
                  trend="You're moving forward"
                  delay={0.12}
                />

                <StatCard
                  icon={<AlertCircle size={17} />}
                  label="Needs attention"
                  value={String(blocked + overdue).padStart(2, "0")}
                  detail={`${blocked} blocked · ${overdue} overdue`}
                  trend="A moment to unblock"
                  delay={0.19}
                />

                <StatCard
                  icon={<TrendingUp size={17} />}
                  label="Project progress"
                  value={`${progress}%`}
                  detail={active?.name || "Current project"}
                  trend="One step at a time"
                  delay={0.26}
                />
              </section>

              <section className="dashboard-grid">
                <div className="board-panel glass-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">
                        PROJECT BOARD
                      </div>

                      <h2>
                        {active?.name || "Your tasks"}

                        <span className="heading-count">
                          {filteredTasks.length}
                        </span>
                      </h2>

                      <p>
                        {active?.description ||
                          "Keep the next steps visible and the momentum steady."}
                      </p>
                    </div>

                    <div className="panel-tools">
                      <button
                        className="secondary-button compact-button"
                        onClick={() => { setCalendarTask(null); setCalendarOpen(true); }}
                        aria-label="Open calendar view"
                        title="Calendar view"
                        type="button"
                      >
                        <CalendarDays size={15} />
                        Calendar view
                      </button>
                      <button
                        className="icon-button"
                        onClick={deleteProject}
                        aria-label="Delete current project"
                        disabled={!active}
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
                        className="secondary-button compact-button"
                        onClick={() => {
                          setEditingTask(null);
                          setTaskModal(true);
                        }}
                      >
                        <Plus size={15} />
                        Add task
                      </button>
                    </div>
                  </div>

                  <div className="board-filter-row">
                    <div className="filter-tabs">
                      {[
                        "All tasks",
                        ...statuses,
                      ].map((filter) => (
                        <button
                          key={filter}
                          className={
                            statusFilter === filter
                              ? "filter-active"
                              : ""
                          }
                          onClick={() =>
                            setStatusFilter(filter)
                          }
                        >
                          {filter}
                        </button>
                      ))}
                    </div>

                    <button
                      className="sort-button"
                      onClick={() =>
                        setTasks((current) => [
                          ...current,
                        ].reverse())
                      }
                    >
                      <ArrowDownUp size={14} />
                      Sort
                    </button>
                  </div>

                  <div
                    className="trello-board"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(230px, 1fr))",
                      gap: 16,
                      alignItems: "start",
                      overflowX: "auto",
                      padding: "8px 2px 18px",
                    }}
                  >
                    {statuses.map((columnStatus) => {
                      const columnTasks = filteredTasks.filter(
                        (task) => task.status === columnStatus
                      );
                      const statusColor: Record<TaskStatus, string> = {
                        "To Do": "#8b7cff",
                        "In Progress": "#53c8bd",
                        Blocked: "#f28aaf",
                        Completed: "#70c99a",
                      };

                      return (
                        <section
                          key={columnStatus}
                          className="trello-column"
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={async (event) => {
                            event.preventDefault();
                            const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
                            setDraggedTaskId(null);
                            if (!taskId) return;
                            const draggedTask = tasks.find((item) => String(item.id) === String(taskId));
                            if (!draggedTask || draggedTask.status === columnStatus) return;

                            const payload = {
                              title: draggedTask.title,
                              description: draggedTask.description,
                              status: columnStatus,
                              priority: draggedTask.priority,
                              category: draggedTask.category,
                              tags: draggedTask.tags,
                              due_date: draggedTask.due_date,
                            };
                            try {
                              setTasks((current) => current.map((item) =>
                                String(item.id) === String(taskId) ? { ...item, status: columnStatus } : item
                              ));
                              await api.updateTask(draggedTask.id, payload);
                              await loadTasks(draggedTask.project_id);
                              await loadProjects();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Could not move task.");
                              await loadTasks(draggedTask.project_id).catch(() => undefined);
                            }
                          }}
                          style={{
                            minWidth: 0,
                            minHeight: 180,
                            padding: 12,
                            borderRadius: 16,
                            background: "rgba(255,255,255,0.035)",
                            border: "1px solid rgba(255,255,255,0.09)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "3px 3px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                              <span style={{ width: 9, height: 9, flex: "0 0 9px", borderRadius: 99, background: statusColor[columnStatus], boxShadow: `0 0 12px ${statusColor[columnStatus]}55` }} />
                              <strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>{columnStatus}</strong>
                            </div>
                            <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 8, background: "rgba(255,255,255,0.07)", color: "var(--muted, #a7a5b8)" }}>{columnTasks.length}</span>
                          </div>

                          <div style={{ display: "grid", gap: 10 }}>
                            {columnTasks.map((task) => (
                              <article
                                key={task.id}
                                className="trello-task-card"
                                draggable
                                onDragStart={(event) => {
                                  setDraggedTaskId(String(task.id));
                                  event.dataTransfer.setData("text/plain", String(task.id));
                                  event.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => setDraggedTaskId(null)}
                                style={{
                                  cursor: "grab",
                                  padding: 13,
                                  borderRadius: 13,
                                  background: "var(--card, rgba(20,22,35,0.92))",
                                  border: "1px solid rgba(255,255,255,0.10)",
                                  boxShadow: "0 5px 16px rgba(0,0,0,0.12)",
                                  opacity: draggedTaskId === String(task.id) ? 0.5 : 1,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 9, flex: 1, minWidth: 0 }}>
                                    <button
                                      type="button"
                                      aria-label={task.status === "Completed" ? `${task.title} is completed` : `Mark ${task.title} as completed`}
                                      title={task.status === "Completed" ? "Task completed" : "Mark as completed"}
                                      disabled={task.status === "Completed" || completingTaskId === String(task.id)}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void completeTaskFromCard(task);
                                      }}
                                      style={{
                                        display: "grid",
                                        placeItems: "center",
                                        flex: "0 0 20px",
                                        width: 20,
                                        height: 20,
                                        marginTop: 1,
                                        padding: 0,
                                        borderRadius: 6,
                                        border: task.status === "Completed" ? "1px solid #70c99a" : "1px solid rgba(185,176,255,0.65)",
                                        background: task.status === "Completed" ? "linear-gradient(135deg,#70c99a,#53c8bd)" : "rgba(139,124,255,0.08)",
                                        color: "#10131b",
                                        cursor: task.status === "Completed" ? "default" : "pointer",
                                        opacity: completingTaskId === String(task.id) ? 0.55 : 1,
                                      }}
                                    >
                                      {task.status === "Completed" && <CheckCircle2 size={14} />}
                                      {task.status !== "Completed" && <span style={{ width: 6, height: 6, borderRadius: 2, background: "rgba(185,176,255,0.75)" }} />}
                                    </button>
                                    <button
                                      className={`task-title ${task.status === "Completed" ? "task-title-done" : ""}`}
                                      style={{ textAlign: "left", fontWeight: 650, lineHeight: 1.4, flex: 1, minWidth: 0 }}
                                      onClick={() => { setEditingTask(task); setTaskModal(true); }}
                                    >
                                      {task.title}
                                    </button>
                                  </div>
                                  <button className="icon-button task-delete" onClick={() => deleteTask(task)} aria-label={`Delete ${task.title}`} title="Delete task" style={{ flex: "0 0 auto" }}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>

                                {task.description && (
                                  <p style={{ margin: "8px 0 10px", fontSize: 12, lineHeight: 1.5, color: "var(--muted, #a7a5b8)", overflowWrap: "anywhere" }}>
                                    {task.description.length > 120 ? `${task.description.slice(0, 117)}…` : task.description}
                                  </p>
                                )}

                                <div
                                  onClick={(event) => event.stopPropagation()}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "minmax(0, 1fr)",
                                    gap: 7,
                                    marginTop: 10,
                                    padding: "9px 10px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(167,153,255,0.16)",
                                    background: "rgba(139,124,255,0.045)",
                                  }}
                                >
                                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 10, color: "var(--muted, #a7a5b8)" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                      <UserRound size={12} />
                                      WORK MODE
                                    </span>
                                    <select
                                      aria-label={`Work mode for ${task.title}`}
                                      value={(taskAssignments[String(task.id)]?.mode ?? "individual")}
                                      onChange={(event) => updateTaskAssignment(task.id, { mode: event.target.value as TaskAssignment["mode"] })}
                                      style={{ maxWidth: 150, minWidth: 0, padding: "5px 7px", borderRadius: 7, color: "#eeeaff", background: "#171923", border: "1px solid rgba(167,153,255,0.28)", fontSize: 11 }}
                                    >
                                      <option value="individual">Individual work</option>
                                      <option value="assigned">Assign to a person</option>
                                    </select>
                                  </label>
                                  {taskAssignments[String(task.id)]?.mode === "assigned" && (
                                    <input
                                      aria-label={`Assignee for ${task.title}`}
                                      value={taskAssignments[String(task.id)]?.assignee ?? ""}
                                      onChange={(event) => updateTaskAssignment(task.id, { assignee: event.target.value })}
                                      placeholder="Enter person's name or email"
                                      maxLength={120}
                                      style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "8px 9px", borderRadius: 8, color: "#f5f3ff", background: "rgba(10,12,20,0.5)", border: "1px solid rgba(167,153,255,0.22)", fontSize: 11, outlineColor: "#8b7cff" }}
                                    />
                                  )}
                                  <span style={{ fontSize: 10, color: "var(--muted, #a7a5b8)" }}>
                                    {taskAssignments[String(task.id)]?.mode === "assigned"
                                      ? (taskAssignments[String(task.id)]?.assignee?.trim() ? `Assigned to ${taskAssignments[String(task.id)].assignee.trim()}` : "Add a name or email to identify the assignee.")
                                      : "For one person's independent work."}
                                  </span>
                                </div>

                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                                  <span className={`priority priority-${task.priority.toLowerCase()}`} style={{ fontSize: 10 }}><i />{task.priority}</span>
                                  {task.category && <span className="category-label" style={{ fontSize: 10 }}>{task.category}</span>}
                                </div>

                                {!!task.tags.length && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                                    {task.tags.slice(0, 3).map((tag) => <span className="tag-chip" key={tag}>{tag}</span>)}
                                  </div>
                                )}

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                                  {task.due_date ? (
                                    <span className="due-label" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10 }}><Clock3 size={11} />{task.due_date}</span>
                                  ) : <span style={{ fontSize: 10, color: "var(--muted, #a7a5b8)" }}>No due date</span>}
                                  <span style={{ position: "relative", display: "inline-flex", alignItems: "center", flex: "0 0 auto" }}>
                                    <select
                                      aria-label={`Move ${task.title} to another status`}
                                      value={task.status}
                                      onChange={async (event) => {
                                        const nextStatus = event.target.value as TaskStatus;
                                        if (nextStatus === task.status) return;
                                        const payload = { title: task.title, description: task.description, status: nextStatus, priority: task.priority, category: task.category, tags: task.tags, due_date: task.due_date };
                                        try {
                                          setTasks((current) => current.map((item) => String(item.id) === String(task.id) ? { ...item, status: nextStatus } : item));
                                          await api.updateTask(task.id, payload);
                                          await loadTasks(task.project_id);
                                          await loadProjects();
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : "Could not update task status.");
                                          await loadTasks(task.project_id).catch(() => undefined);
                                        }
                                      }}
                                      style={{
                                        appearance: "none",
                                        WebkitAppearance: "none",
                                        maxWidth: 112,
                                        minWidth: 104,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        padding: "7px 27px 7px 10px",
                                        borderRadius: 9,
                                        background: "linear-gradient(135deg, rgba(139,124,255,0.14), rgba(83,200,189,0.07))",
                                        color: "#eeeaff",
                                        border: "1px solid rgba(167,153,255,0.28)",
                                        outline: "none",
                                        cursor: "pointer",
                                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                                      }}
                                    >
                                      {statuses.map((status) => (
                                        <option key={status} value={status} style={{ background: "#171923", color: "#eeeaff" }}>
                                          {status}
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown
                                      size={13}
                                      aria-hidden="true"
                                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#b9b0ff", pointerEvents: "none" }}
                                    />
                                  </span>
                                </div>
                              </article>
                            ))}

                            {columnTasks.length === 0 && (
                              <div style={{ minHeight: 74, display: "grid", placeItems: "center", textAlign: "center", padding: 12, border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 11, color: "var(--muted, #a7a5b8)", fontSize: 11 }}>
                                Drop a task here
                              </div>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>

                  {!filteredTasks.length && (
                    <div className="empty-tasks" style={{ marginTop: 12 }}>
                      <div className="empty-icon"><CheckCircle2 size={22} /></div>
                      <strong>{search || statusFilter !== "All tasks" ? "No matching tasks" : "A clear runway."}</strong>
                      <p>{search || statusFilter !== "All tasks" ? "Try changing your search or filter." : "Create a task to give your project its next step."}</p>
                      {!search && statusFilter === "All tasks" && (
                        <button className="text-button" onClick={() => { setEditingTask(null); setTaskModal(true); }}>
                          Create your first task <ArrowDownUp size={13} />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="board-footer">
                    <span>
                      <span className="status-dot" />
                      Synced with your workspace
                    </span>

                    <span>
                      {completed} of {tasks.length} tasks completed
                    </span>
                  </div>
                </div>

                <aside className="right-column">
                  <section className="progress-panel glass-panel">
                    <div className="panel-heading small-heading">
                      <div>
                        <div className="eyebrow">
                          MOMENTUM
                        </div>

                        <h2>Project pulse</h2>
                      </div>

                      <div className="pulse-icon">
                        <BarChart3 size={17} />
                      </div>
                    </div>

                    <div className="progress-ring-wrap">
                      <svg
                        className="progress-ring"
                        viewBox="0 0 140 140"
                      >
                        <circle
                          className="ring-track"
                          cx="70"
                          cy="70"
                          r="57"
                        />

                        <motion.circle
                          className="ring-progress"
                          cx="70"
                          cy="70"
                          r="57"
                          initial={{
                            pathLength: 0,
                          }}
                          animate={{
                            pathLength: progress / 100,
                          }}
                          transition={{
                            duration: 1,
                            ease: "easeOut",
                          }}
                        />
                      </svg>

                      <div className="ring-center">
                        <strong>{progress}%</strong>
                        <span>complete</span>
                      </div>
                    </div>

                    <div className="progress-legend">
                      <div>
                        <span className="legend-dot legend-complete" />
                        Completed
                        <strong>{completed}</strong>
                      </div>

                      <div>
                        <span className="legend-dot legend-progress" />
                        In progress
                        <strong>
                          {
                            tasks.filter(
                              (task) =>
                                task.status === "In Progress"
                            ).length
                          }
                        </strong>
                      </div>

                      <div>
                        <span className="legend-dot legend-todo" />
                        To do
                        <strong>
                          {
                            tasks.filter(
                              (task) =>
                                task.status === "To Do"
                            ).length
                          }
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section className="ai-panel glass-panel">
                    <div className="ai-orb">
                      <Sparkles size={19} />
                    </div>

                    <div className="eyebrow">
                      TASKFLOW INTELLIGENCE
                    </div>

                    <h2>A clearer next move.</h2>

                    <p>
                      Turn task signals into useful next steps
                      with your local AI assistant.
                    </p>

                    <button
                      className="ai-action-button"
                      onClick={getInsights}
                      disabled={
                        insightsBusy || !activeProject
                      }
                    >
                      {insightsBusy
                        ? "Thinking…"
                        : "Generate project insights"}

                      <ArrowDownUp size={14} />
                    </button>

                    {insights && (
                      <div className="insights-result">
                        <strong>
                          {insights.summary ||
                            "Project insights"}
                        </strong>

                        {insights.risks?.length ? (
                          <div>
                            <span>Risks</span>

                            <ul>
                              {insights.risks
                                .slice(0, 3)
                                .map((item, index) => (
                                  <li key={index}>
                                    {item}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}

                        {insights.blockers?.length ? (
                          <div>
                            <span>Blockers</span>

                            <ul>
                              {insights.blockers
                                .slice(0, 3)
                                .map((item, index) => (
                                  <li key={index}>
                                    {item}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}

                        {insights.next_actions?.length ? (
                          <div>
                            <span>Next actions</span>

                            <ul>
                              {insights.next_actions
                                .slice(0, 3)
                                .map((item, index) => (
                                  <li key={index}>
                                    {item}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div className="ai-foot">
                      <span className="ai-spark">
                        <Sparkles size={12} />
                      </span>

                      Powered by your local Ollama model
                    </div>
                  </section>

                  <section className="focus-panel glass-panel">
                    <div className="focus-top">
                      <div className="focus-icon">
                        <Command size={16} />
                      </div>

                      <span className="eyebrow">
                        A SMALL TIP
                      </span>
                    </div>

                    <h3>Protect your focus.</h3>

                    <p>
                      Choose one meaningful task, finish the
                      next step, then move on. Progress compounds.
                    </p>

                    <div className="focus-bottom">
                      <span>
                        <CircleHelp size={13} />
                        A little at a time
                      </span>

                      <span>01 / 03</span>
                    </div>
                  </section>
                </aside>
              </section>
            </>
          )}

          <footer className="app-footer">
            <span>© 2026 TaskFlow AI</span>

            <span>
              Made for thoughtful work{" "}
              <span className="footer-heart">✦</span>
            </span>

            <span>
              <span className="status-dot" />
              All systems operational
            </span>
          </footer>
        </div>
      </main>

      <AnimatePresence>
        {showProjectForm && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowProjectForm(false);
              }
            }}
          >
            <motion.section
              className="project-modal glass-panel"
              initial={{
                opacity: 0,
                y: 18,
                scale: 0.97,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 10,
              }}
            >
              <div className="modal-header">
                <div>
                  <div className="eyebrow">
                    NEW WORKSPACE PROJECT
                  </div>

                  <h2>Create a project</h2>
                </div>

                <button
                  className="icon-button"
                  onClick={() =>
                    setShowProjectForm(false)
                  }
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                className="task-form"
                onSubmit={createProject}
              >
                <label>
                  Project name

                  <input
                    value={projectName}
                    onChange={(event) =>
                      setProjectName(event.target.value)
                    }
                    placeholder="Website redesign"
                    minLength={2}
                    required
                    autoFocus
                  />
                </label>

                <label>
                  Description

                  <textarea
                    value={projectDescription}
                    onChange={(event) =>
                      setProjectDescription(
                        event.target.value
                      )
                    }
                    placeholder="What does success look like?"
                    rows={3}
                  />
                </label>

                <div className="color-picker">
                  <span>Project accent</span>

                  {colors.map((color) => (
                    <span
                      key={color}
                      className="color-swatch"
                      style={{
                        background: color,
                      }}
                      aria-label={`Project color ${color}`}
                    />
                  ))}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setShowProjectForm(false)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    className="primary-button"
                    disabled={busy}
                  >
                    {busy
                      ? "Creating…"
                      : "Create project"}
                  </button>
                </div>
              </form>
            </motion.section>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {calendarOpen && (
          <motion.div
            className="modal-backdrop taskflow-calendar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setCalendarOpen(false);
                setCalendarTask(null);
              }
            }}
            style={{ zIndex: 10000, padding: 16, overflowY: "auto" }}
          >
            <motion.section
              className="glass-panel"
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-label="Task calendar view"
              style={{ width: "min(1180px, 100%)", margin: "auto", padding: 20, borderRadius: 20, background: "#151722", border: "1px solid rgba(255,255,255,0.12)", color: "#f7f7fb" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                  <div className="eyebrow"><CalendarDays size={13} style={{ verticalAlign: "middle", marginRight: 6 }} />TIMELINE CALENDAR</div>
                  <h2 style={{ margin: "6px 0 4px", fontSize: 22 }}>Schedule overview</h2>
                  <p style={{ margin: 0, color: "#a7a9bb", fontSize: 12 }}>Tasks are placed on their due dates. Your current task data stores due dates, not start/end times, so each task uses a clearly marked 1-hour planning block.</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" className="icon-button" aria-label="Previous week" onClick={() => setCalendarWeekOffset((v) => v - 1)}><ChevronLeft size={17} /></button>
                  <button type="button" className="secondary-button compact-button" onClick={() => setCalendarWeekOffset(0)}>Today</button>
                  <button type="button" className="icon-button" aria-label="Next week" onClick={() => setCalendarWeekOffset((v) => v + 1)}><ChevronRight size={17} /></button>
                  <button type="button" className="icon-button" aria-label="Close calendar" onClick={() => { setCalendarOpen(false); setCalendarTask(null); }}><X size={17} /></button>
                </div>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14 }}>
                <div style={{ minWidth: 850, display: "grid", gridTemplateColumns: "66px repeat(7, minmax(105px, 1fr))" }}>
                  <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.035)" }} />
                  {calendarDays.map((day) => {
                    const todayKey = calendarDateKey(new Date());
                    const dayKey = calendarDateKey(day);
                    return <div key={dayKey} style={{ padding: "10px 8px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.10)", borderLeft: "1px solid rgba(255,255,255,0.07)", background: dayKey === todayKey ? "rgba(139,124,255,0.12)" : "rgba(255,255,255,0.035)", color: dayKey === todayKey ? "#c5bcff" : "#e8e8f0", fontSize: 11, fontWeight: 700 }}>{formatCalendarDate(day)}</div>;
                  })}
                  {Array.from({ length: 11 }, (_, row) => {
                    const hour = row + 8;
                    return <Fragment key={hour}>
                      <div style={{ height: 62, padding: "7px 8px", color: "#898da2", fontSize: 10, textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{`${String(hour).padStart(2, "0")}:00`}</div>
                      {calendarDays.map((day) => {
                        const dayKey = calendarDateKey(day);
                        const dayTasks = filteredTasks.filter((task) => task.due_date === dayKey);
                        return <div key={`${dayKey}-${hour}`} style={{ height: 62, position: "relative", padding: 4, borderLeft: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)", background: hour % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent" }}>
                          {hour === 9 && dayTasks.map((task) => {
                            const accent = task.status === "Completed" ? "#70c99a" : task.status === "Blocked" ? "#f28aaf" : task.status === "In Progress" ? "#53c8bd" : "#8b7cff";
                            return <button key={task.id} type="button" onClick={() => setCalendarTask(task)} title={`Open ${task.title} details`} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 7px", marginBottom: 4, borderRadius: 7, border: `1px solid ${accent}66`, borderLeft: `3px solid ${accent}`, background: `${accent}1c`, color: "#f6f5ff", fontSize: 10, lineHeight: 1.35, cursor: "pointer", overflowWrap: "anywhere" }}><strong style={{ display: "block" }}>{task.title}</strong><span style={{ color: "#b8bbcc" }}>09:00–10:00 · 1h planned</span></button>;
                          })}
                        </div>;
                      })}
                    </Fragment>;
                  })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, color: "#a7a9bb", fontSize: 11 }}><span>● <span style={{ color: "#bdb3ff" }}>To Do</span></span><span>● <span style={{ color: "#76e0d4" }}>In Progress</span></span><span>● <span style={{ color: "#ffacc4" }}>Blocked</span></span><span>● <span style={{ color: "#8de0aa" }}>Completed</span></span><span style={{ marginLeft: "auto" }}>Select a task block to view its details.</span></div>

              {calendarTask && (
                <div style={{ marginTop: 16, padding: 16, borderRadius: 14, background: "rgba(139,124,255,0.09)", border: "1px solid rgba(139,124,255,0.28)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div className="eyebrow">TASK DURATION DETAILS</div>
                      <h3 style={{ margin: "5px 0 8px", fontSize: 17 }}>{calendarTask.title}</h3>
                    </div>
                    <button type="button" className="icon-button" aria-label="Close task duration details" onClick={() => setCalendarTask(null)}><X size={15} /></button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
                    <div style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}><span style={{ display: "block", color: "#a7a9bb", fontSize: 10, marginBottom: 5 }}>PLANNED TIME</span><strong>09:00 AM – 10:00 AM</strong></div>
                    <div style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}><span style={{ display: "block", color: "#a7a9bb", fontSize: 10, marginBottom: 5 }}>DURATION</span><strong>1 hour (planning estimate)</strong></div>
                    <div style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}><span style={{ display: "block", color: "#a7a9bb", fontSize: 10, marginBottom: 5 }}>DUE DATE</span><strong>{calendarTask.due_date || "Not set"}</strong></div>
                    <div style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}><span style={{ display: "block", color: "#a7a9bb", fontSize: 10, marginBottom: 5 }}>STATUS</span><strong>{calendarTask.status}</strong></div>
                  </div>
                  <p style={{ margin: "10px 0 0", color: "#a7a9bb", fontSize: 11 }}>The current backend stores a due date but does not store task start time, end time, or duration. The one-hour block is a visual planning estimate, not saved schedule data.</p>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}><button type="button" className="secondary-button compact-button" onClick={() => { setEditingTask(calendarTask); setTaskModal(true); setCalendarOpen(false); setCalendarTask(null); }}>Edit task</button><button type="button" className="primary-button" onClick={() => setCalendarTask(null)}>Done</button></div>
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrationTask && (
          <motion.div
            className="modal-backdrop"
            style={{ zIndex: 2147483646, display: "grid", placeItems: "center", overflow: "hidden" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => { if (event.target === event.currentTarget) setCelebrationTask(null); }}
            role="presentation"
          >
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
              {Array.from({ length: 34 }, (_, index) => {
                const palette = ["#8b7cff", "#53c8bd", "#ffb86b", "#f28aaf", "#70c99a", "#f5e6a8"];
                const left = (index * 37 + 7) % 100;
                const delay = (index % 9) * 0.07;
                return <motion.span key={index}
                  initial={{ opacity: 0, y: -35, x: 0, rotate: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [0, 180 + (index % 5) * 35], x: [(index % 2 ? -1 : 1) * (18 + index % 6 * 9)], rotate: [0, (index % 2 ? -1 : 1) * (160 + index * 11)], scale: [0.6, 1, 0.8] }}
                  transition={{ duration: 1.8 + (index % 5) * 0.16, delay, ease: "easeOut" }}
                  style={{ position: "absolute", left: `${left}%`, top: -18, width: index % 3 === 0 ? 8 : 6, height: index % 3 === 0 ? 12 : 7, borderRadius: index % 2 ? 99 : 2, background: palette[index % palette.length] }}
                />;
              })}
            </div>
            <motion.section
              className="glass-panel"
              initial={{ opacity: 0, y: 22, scale: 0.82, rotate: -2 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              style={{ position: "relative", width: "min(420px, calc(100vw - 32px))", padding: "30px 24px 24px", textAlign: "center", borderRadius: 22, border: "1px solid rgba(139,124,255,0.34)", background: "linear-gradient(145deg, rgba(30,31,49,0.98), rgba(19,25,35,0.98))", boxShadow: "0 24px 90px rgba(0,0,0,0.48)" }}
              role="dialog" aria-modal="true" aria-label="Task completed celebration"
            >
              <motion.div
                initial={{ scale: 0, rotate: -24 }}
                animate={{ scale: [0, 1.18, 1], rotate: [ -24, 8, 0] }}
                transition={{ duration: 0.55, ease: "backOut" }}
                style={{ width: 76, height: 76, margin: "0 auto 16px", display: "grid", placeItems: "center", borderRadius: 24, background: "linear-gradient(135deg, rgba(112,201,154,0.24), rgba(83,200,189,0.18))", border: "1px solid rgba(112,201,154,0.42)", color: "#83e3b0" }}
              >
                <CheckCircle2 size={42} strokeWidth={2.4} />
              </motion.div>
              <div style={{ color: "#9b8cff", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>MILESTONE UNLOCKED</div>
              <h2 style={{ margin: "8px 0", color: "#f7f6ff", fontSize: 25, letterSpacing: "-0.04em" }}>Nicely done! 🎉</h2>
              <p style={{ margin: "0 auto 8px", color: "#c2c1d2", fontSize: 13, lineHeight: 1.6 }}>You completed</p>
              <strong style={{ display: "block", color: "#fff", fontSize: 16, lineHeight: 1.45, overflowWrap: "anywhere" }}>{celebrationTask.title}</strong>
              <p style={{ margin: "12px 0 22px", color: "#a7a9bb", fontSize: 12 }}>One more step forward. Keep the momentum going.</p>
              <button type="button" className="primary-button" onClick={() => setCelebrationTask(null)} style={{ justifyContent: "center", minWidth: 130 }}><CheckCircle2 size={15} /> Continue</button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }} style={{ zIndex: 10000 }}>
            <motion.section className="glass-panel" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }} role="dialog" aria-modal="true" aria-label="TaskFlow settings" style={{ width: "min(520px, calc(100vw - 28px))", maxHeight: "min(82vh, 720px)", overflowY: "auto", padding: 24, borderRadius: 20, border: "1px solid rgba(139,124,255,0.28)", background: "linear-gradient(145deg, rgba(29,30,47,.99), rgba(17,21,32,.99))", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 22 }}>
                <div><div className="eyebrow">PERSONALIZE YOUR WORKSPACE</div><h2 style={{ margin: "7px 0 5px" }}>Settings</h2><p style={{ margin: 0, color: "var(--muted, #a7a5b8)", fontSize: 13 }}>Adjust how TaskFlow looks and behaves on this browser.</p></div>
                <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={17}/></button>
              </div>
              <div style={{ display: "grid", gap: 18 }}>
                <label style={{ display: "grid", gap: 8, fontSize: 13, fontWeight: 650 }}>Accent color
                  <select value={preferences.accent} onChange={e => setPreferences((v: any) => ({ ...v, accent: e.target.value }))} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.13)", background: "#202133", color: "#f5f4ff" }}>
                    <option value="purple">Violet (default)</option><option value="teal">Teal</option><option value="blue">Ocean blue</option><option value="rose">Rose</option>
                  </select>
                </label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 13, border: "1px solid rgba(255,255,255,.09)", borderRadius: 12 }}><span><strong style={{ display: "block", fontSize: 13 }}>Compact task cards</strong><small style={{ color: "var(--muted, #a7a5b8)" }}>Use a denser layout on the board.</small></span><input type="checkbox" checked={preferences.compactCards} onChange={e => setPreferences((v: any) => ({ ...v, compactCards: e.target.checked }))}/></label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: 13, border: "1px solid rgba(255,255,255,.09)", borderRadius: 12 }}><span><strong style={{ display: "block", fontSize: 13 }}>Completion celebration</strong><small style={{ color: "var(--muted, #a7a5b8)" }}>Show the confetti popup when a task is completed.</small></span><input type="checkbox" checked={preferences.celebrations} onChange={e => setPreferences((v: any) => ({ ...v, celebrations: e.target.checked }))}/></label>
                <label style={{ display: "grid", gap: 8, fontSize: 13, fontWeight: 650 }}>Default task filter
                  <select value={preferences.defaultFilter} onChange={e => setPreferences((v: any) => ({ ...v, defaultFilter: e.target.value }))} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.13)", background: "#202133", color: "#f5f4ff" }}>
                    <option>All tasks</option><option>To Do</option><option>In Progress</option><option>Blocked</option><option>Completed</option>
                  </select>
                </label>
              </div>
              {settingsSaved && <p role="status" style={{ color: "#83e3b0", fontSize: 12, marginBottom: 0 }}>Preferences saved on this browser.</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 22 }}><button type="button" className="secondary-button" onClick={() => { setPreferences({ accent: "purple", compactCards: false, celebrations: true, defaultFilter: "All tasks" }); setSettingsSaved(false); }}>Reset</button><button type="button" className="primary-button" onClick={() => { try { window.localStorage.setItem("taskflow.preferences.v1", JSON.stringify(preferences)); } catch {} setStatusFilter(preferences.defaultFilter); document.documentElement.dataset.taskflowAccent = preferences.accent; document.documentElement.dataset.taskflowCompact = preferences.compactCards ? "true" : "false"; setSettingsSaved(true); }}>Save preferences</button></div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        :root { --taskflow-accent: #8b7cff; }
        :root[data-taskflow-accent="purple"] { --taskflow-accent: #8b7cff; --accent: #8b7cff; --accent-color: #8b7cff; }
        :root[data-taskflow-accent="teal"] { --taskflow-accent: #53c8bd; --accent: #53c8bd; --accent-color: #53c8bd; }
        :root[data-taskflow-accent="blue"] { --taskflow-accent: #69a9ff; --accent: #69a9ff; --accent-color: #69a9ff; }
        :root[data-taskflow-accent="rose"] { --taskflow-accent: #f28aaf; --accent: #f28aaf; --accent-color: #f28aaf; }
        :root { accent-color: var(--taskflow-accent); }
        .primary-button, .new-task-button { background: var(--taskflow-accent) !important; border-color: var(--taskflow-accent) !important; }
        .nav-item.active { color: var(--taskflow-accent) !important; border-color: var(--taskflow-accent) !important; }
        .icon-button:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible { outline-color: var(--taskflow-accent) !important; }
        :root[data-taskflow-compact="true"] .trello-task-card { padding: 8px !important; }
      `}</style>
      <TaskModal
        key={`${taskModal}-${editingTask?.id ?? "new"}`}
        open={taskModal}
        initial={editingTask}
        busy={busy}
        onClose={() => {
          setTaskModal(false);
          setEditingTask(null);
        }}
        onSave={saveTask}
        onAnalyze={api.analyzeTask}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  trend,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  trend: string;
  delay: number;
}) {
  return (
    <motion.article
      className="stat-card glass-panel"
      initial={{
        opacity: 0,
        y: 14,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.45,
        delay,
      }}
      whileHover={{
        y: -3,
        transition: {
          duration: 0.18,
        },
      }}
    >
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>

        <span className="stat-trend">
          <TrendingUp size={12} />
          Live
        </span>
      </div>

      <div className="stat-label">{label}</div>

      <div className="stat-value">{value}</div>

      <div className="stat-detail">{detail}</div>

      <div className="stat-foot">
        <span>{trend}</span>

        <span className="mini-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </motion.article>
  );
}
