import { useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import type { Task, TaskStatus, Priority } from "../types";
import type { TaskPayload } from "../lib/api";

type Props = {
  open: boolean;
  initial?: Task | null;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: TaskPayload) => Promise<void>;
  onAnalyze: (title: string, description: string) => Promise<{ priority: Priority; category: string; tags: string[]; explanation: string }>;
};

export default function TaskModal({ open, initial, busy, onClose, onSave, onAnalyze }: Props) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [status, setStatus] = useState<TaskStatus>(initial?.status || "To Do");
  const [priority, setPriority] = useState<Priority>(initial?.priority || "Medium");
  const [category, setCategory] = useState(initial?.category || "General");
  const [tags, setTags] = useState(initial?.tags.join(", ") || "");
  const [dueDate, setDueDate] = useState(initial?.due_date || "");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave({ title, description, status, priority, category, tags: tags.split(",").map(tag => tag.trim()).filter(Boolean), due_date: dueDate || null });
  }

  async function analyze() {
    if (!title.trim()) {
      setAiNote("Add a task title first.");
      return;
    }
    setAiBusy(true);
    setAiNote("");
    try {
      const result = await onAnalyze(title, description);
      setPriority(result.priority);
      setCategory(result.category || "General");
      setTags(result.tags.join(", "));
      setAiNote(result.explanation || "Suggestions applied. Review them before saving.");
    } catch (error) {
      setAiNote(error instanceof Error ? error.message : "AI analysis failed.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <motion.section className="task-modal glass-panel" initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.22 }}>
          <div className="modal-header"><div><div className="eyebrow">TASK WORKSPACE</div><h2>{initial ? "Edit task" : "Create a task"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
          <form onSubmit={submit} className="task-form">
            <label>Task title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to happen?" minLength={2} required /></label>
            <label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add context, acceptance criteria, or details…" rows={3} /></label>
            <div className="form-grid">
              <label>Status<select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}><option>To Do</option><option>In Progress</option><option>Blocked</option><option>Completed</option></select></label>
              <label>Priority<select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></label>
              <label>Category<input value={category} onChange={e => setCategory(e.target.value)} placeholder="Design" /></label>
              <label>Due date<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
            </div>
            <label>Tags <span className="label-hint">separate with commas</span><input value={tags} onChange={e => setTags(e.target.value)} placeholder="frontend, ux, launch" /></label>
            <button type="button" className="ai-suggest-button" disabled={aiBusy} onClick={analyze}><Sparkles size={16} /> {aiBusy ? "Thinking…" : "Suggest with AI"}</button>
            {aiNote && <div className="ai-note">{aiNote}</div>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Create task"}</button></div>
          </form>
        </motion.section>
      </div>}
    </AnimatePresence>
  );
}
