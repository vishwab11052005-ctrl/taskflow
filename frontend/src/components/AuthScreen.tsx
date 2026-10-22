import { useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Atom, Eye, EyeOff, Sparkles } from "lucide-react";

type Props = {
  onSubmit: (mode: "login" | "register", name: string, email: string, password: string) => Promise<void>;
  busy: boolean;
  error: string;
};

export default function AuthScreen({ onSubmit, busy, error }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(mode, name, email, password);
  }

  return (
    <main className="auth-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <motion.section className="auth-card glass-panel" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.65, ease: "easeOut" }}>
        <div className="brand-mark"><Atom size={24} /><span>taskflow<span className="brand-ai">.ai</span></span></div>
        <div className="auth-heading">
          <div className="eyebrow"><Sparkles size={14} /> YOUR FOCUS, IN FLOW</div>
          <h1>{mode === "login" ? "Make space for" : "Build your"}<br /><span>{mode === "login" ? "great work." : "great work."}</span></h1>
          <p>A calmer workspace for ambitious projects.</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && <label>Your name<input value={name} onChange={e => setName(e.target.value)} placeholder="Alex Morgan" minLength={2} required /></label>}
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
          <label>Password<div className="password-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={mode === "register" ? 8 : 1} required /><button type="button" className="icon-button password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Enter workspace" : "Create your workspace"} <ArrowRight size={17} /></button>
        </form>
        <p className="auth-switch">{mode === "login" ? "New to TaskFlow?" : "Already have an account?"} <button onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create account" : "Sign in"}</button></p>
        <div className="auth-footnote"><span className="status-dot" /> Private by design · Built for deep work</div>
      </motion.section>
      <div className="auth-caption">PLAN WITH CLARITY. SHIP WITH CONFIDENCE.</div>
    </main>
  );
}
