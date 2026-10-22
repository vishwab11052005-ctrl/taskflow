import type { Project, Task, User, TaskStatus, Priority } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "taskflow_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function register(name: string, email: string, password: string) {
  const data = await request<{ access_token: string; user: User }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });
  saveToken(data.access_token);
  return data.user;
}

export async function login(email: string, password: string) {
  const data = await request<{ access_token: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  saveToken(data.access_token);
  return data.user;
}

export const api = {
  me: () => request<User>("/api/auth/me"),
  projects: () => request<Project[]>("/api/projects"),
  createProject: (payload: { name: string; description: string; color: string }) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(payload) }),
  deleteProject: (id: number) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  tasks: (projectId: number) => request<Task[]>(`/api/projects/${projectId}/tasks`),
  createTask: (projectId: number, payload: TaskPayload) =>
    request<Task>(`/api/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: number, payload: TaskPayload) =>
    request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTask: (id: number) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
  analyzeTask: (title: string, description: string) =>
    request<{ priority: Priority; category: string; tags: string[]; explanation: string }>("/api/ai/analyze-task", {
      method: "POST", body: JSON.stringify({ title, description })
    }),
  generateSubtasks: (title: string, description: string) =>
    request<{ subtasks: { title: string; description: string }[] }>("/api/ai/generate-subtasks", {
      method: "POST", body: JSON.stringify({ title, description })
    }),
  projectInsights: (projectId: number) =>
    request<{ summary?: string; risks?: string[]; blockers?: string[]; next_actions?: string[] }>("/api/ai/project-insights", {
      method: "POST", body: JSON.stringify({ project_id: projectId })
    })
};

export type TaskPayload = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  category: string;
  tags: string[];
  due_date: string | null;
};
