export type User = {
  id: number;
  name: string;
  email: string;
};

export type Project = {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
  task_count: number;
  completed_count: number;
};

export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Completed";
export type Priority = "Low" | "Medium" | "High" | "Urgent";

export type Task = {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  category: string;
  tags: string[];
  due_date: string | null;
  project_id: number;
  created_at: string;
};
