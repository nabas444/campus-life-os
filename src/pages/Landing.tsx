import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, AlertCircle, Building2, Bell, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-parchment">
      {/* Header */}
      <header className="container flex h-20 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-hero shadow-md">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl font-semibold text-primary">Campus Life</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Operating System</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild variant="hero">
                <Link to="/auth?mode=signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="container grid gap-12 py-16 md:grid-cols-2 md:py-24">
        <div className="flex flex-col justify-center animate-fade-in">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" />
            Phase 1 · Now in beta
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] text-primary md:text-6xl">
            The operating system for{" "}
            <span className="italic text-accent">student life.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Report dorm issues, track resolutions, and stay in the loop — all in one place. Built for students,
            dorm admins, and the people running campus.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="xl" variant="hero">
              <Link to="/auth?mode=signup">Create your account</Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link to="/auth">I already have one</Link>
            </Button>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              Private by design
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Multi-dorm
            </div>
          </div>
        </div>

        {/* Visual */}
        <div className="relative animate-scale-in">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-accent opacity-10 blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-display text-sm font-semibold text-primary">Dorm dashboard</div>
                <div className="text-xs text-muted-foreground">Sterling Hall</div>
              </div>
              <Bell className="h-4 w-4 text-accent" />
            </div>
            <div className="space-y-3">
              {[
                { title: "Hot water out — 3rd floor", status: "In progress", color: "bg-warning/15 text-warning" },
                { title: "Wi-Fi unstable in lounge", status: "Pending", color: "bg-info/15 text-info" },
                { title: "Lobby light fixed", status: "Resolved", color: "bg-success/15 text-success" },
              ].map((i) => (
                <div
                  key={i.title}
                  className="flex items-center justify-between rounded-lg border border-border bg-background/60 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
                      <AlertCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-sm font-medium">{i.title}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${i.color}`}>
                    {i.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="container pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: AlertCircle,
              title: "Report what's broken",
              body: "Snap a photo, pick a category, and your dorm admin sees it instantly.",
            },
            {
              icon: Building2,
              title: "Join via invite code",
              body: "Dorm admins generate codes — your space stays private and verified.",
            },
            {
              icon: Bell,
              title: "Stay in the loop",
              body: "Real-time updates the moment something moves from pending to fixed.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-6 transition-base hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-display text-xl font-semibold text-primary">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-background/50 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          Campus Life OS · Phase 1 — Foundation
        </div>
      </footer>
    </div>
  );
};

export default Landing;
