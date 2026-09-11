import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { Layers3, LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, hasSession, needsApiConfiguration, setSession } from "@/lib/api";
import LedgerApp from "./ledger-app";
import "./globals.css";

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await api<{ token: string }>("/api/login", { method: "POST", body: JSON.stringify({ password }) });
      setSession(response.token); setPassword(""); onSuccess();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    {needsApiConfiguration ? <div className="login-notice">Your interface is ready. Connect the ledger server using the GitHub Pages steps in <a href="https://github.com/vedamrit01/ROBUSTTHREED_LEDGER#host-the-interface-on-github-pages">the README</a> to start saving entries.</div> : <>
      <div><label htmlFor="ledger-password" className="form-label">Owner password</label><Input id="ledger-password" autoFocus type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} placeholder="Enter your ledger password" /></div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 size={17} className="animate-spin" /> : <LockKeyhole size={16} />}Open my ledger</Button>
      <p className="login-footnote">Use the owner password you created during setup.</p>
    </>}
  </form>;
}
function App() {
  const [signedIn, setSignedIn] = useState(hasSession);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener("ledger-session-expired", onExpired);
    return () => window.removeEventListener("ledger-session-expired", onExpired);
  }, []);
  async function logout() {
    // Wait for revocation before hiding the current ledger.
    await api("/api/logout", { method: "POST", body: "{}" });
    setSession(""); setSignedIn(false); setExpired(false);
  }
  if (!signedIn) return <main className="login-shell"><section className="login-card">
    <div className="login-brand"><span className="brand-symbol"><Layers3 size={26} /></span><div><strong>Robustthreed<span>.</span></strong><small>BUSINESS LEDGER</small></div></div>
    <div className="login-intro"><span className="login-eyebrow">YOUR OWNER WORKSPACE</span><h1>Make more.<br />Manage less.</h1><p>Payments, expenses, and your business profit. All in one place.</p></div>
    <Login onSuccess={() => { setSignedIn(true); setExpired(false); }} />
    <div className="login-markets">Amazon <span>·</span> Flipkart <span>·</span> Meesho <span>·</span> Direct</div>
  </section></main>;
  return <>
    <LedgerApp onLogout={logout} />
    <Dialog open={expired}><DialogContent showCloseButton={false} onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}><DialogHeader><DialogTitle>Sign in again</DialogTitle><DialogDescription>Your session expired. Sign in to continue; your open entry form will stay here.</DialogDescription></DialogHeader><Login onSuccess={() => { setExpired(false); window.dispatchEvent(new Event("focus")); }} /></DialogContent></Dialog>
  </>;
}
createRoot(document.getElementById("root")!).render(<App />);
