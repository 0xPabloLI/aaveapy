import { useState, type FormEvent, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDashboardPassword,
  setDashboardPassword,
  clearDashboardPassword,
} from "@/lib/seoApi";

interface Props {
  children: (signOut: () => void) => ReactNode;
}

/**
 * Simple password gate for /admin/seo. Password is checked server-side by the
 * seo-proxy edge function against SEO_DASHBOARD_PASSWORD. We just store the
 * entered value in sessionStorage (cleared on tab close) and send it as
 * X-Dashboard-Password on every request.
 */
export default function SeoDashboardGate({ children }: Props) {
  const [authed, setAuthed] = useState(() => !!getDashboardPassword());
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pw) return;
    setSubmitting(true);
    setError(null);
    setDashboardPassword(pw);
    try {
      // Probe a lightweight endpoint to validate the password.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seo-proxy/semrush?keyword=__probe__`;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(url, {
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          "X-Dashboard-Password": pw,
        },
      });
      if (res.status === 401) {
        clearDashboardPassword();
        setError("Incorrect password");
      } else if (!res.ok) {
        // Allow through on upstream errors — password itself was accepted.
        setAuthed(true);
      } else {
        setAuthed(true);
      }
    } catch {
      setError("Network error");
      clearDashboardPassword();
    } finally {
      setSubmitting(false);
    }
  }

  function signOut() {
    clearDashboardPassword();
    setAuthed(false);
    setPw("");
  }

  if (authed) return <>{children(signOut)}</>;

  return (
    <>
      <Helmet>
        <title>SEO Dashboard · Sign in</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-card border border-border/60 rounded-xl p-6 space-y-4"
        >
          <div>
            <h1 className="text-lg font-semibold">SEO Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter dashboard password to continue.
            </p>
          </div>
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting || !pw}>
            {submitting ? "Checking…" : "Sign in"}
          </Button>
        </form>
      </div>
    </>
  );
}
