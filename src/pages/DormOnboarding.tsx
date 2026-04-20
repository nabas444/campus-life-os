import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { GraduationCap, Loader2, Building2, KeyRound } from "lucide-react";
import { toast } from "sonner";

const DormOnboarding = () => {
  const { user, dorms, refresh, signOut, isSystemAdmin } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dorms.length > 0) navigate("/dashboard", { replace: true });
  }, [dorms, navigate]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (code.trim().length < 4) {
      toast.error("Enter a valid invite code");
      return;
    }
    setLoading(true);

    // Look up invite
    const { data: invite, error: inviteErr } = await supabase
      .from("dorm_invites")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (inviteErr || !invite) {
      setLoading(false);
      toast.error("Invite code not found");
      return;
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      setLoading(false);
      toast.error("This invite has expired");
      return;
    }
    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      setLoading(false);
      toast.error("This invite has reached its limit");
      return;
    }

    // Insert membership
    const { error: memberErr } = await supabase.from("dorm_members").insert({
      user_id: user.id,
      dorm_id: invite.dorm_id,
      room_number: room.trim() || null,
    });

    if (memberErr) {
      setLoading(false);
      if (memberErr.code === "23505") {
        toast.error("You're already a member of this dorm");
      } else {
        toast.error(memberErr.message);
      }
      return;
    }

    // If invite grants elevated role, add it
    if (invite.role_granted !== "student") {
      await supabase.from("user_roles").insert({
        user_id: user.id,
        role: invite.role_granted,
      });
    }

    // Increment use count
    await supabase
      .from("dorm_invites")
      .update({ uses_count: invite.uses_count + 1 })
      .eq("id", invite.id);

    await refresh();
    setLoading(false);
    toast.success("Joined your dorm!");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-parchment p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-hero shadow-md">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl font-semibold text-primary">Campus Life</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Operating System</div>
          </div>
        </div>

        <Card className="border-border bg-card p-8 shadow-elegant">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-primary">Join your dorm</h1>
              <p className="text-sm text-muted-foreground">Enter the invite code from your dorm admin</p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Invite code
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. STERLING-A4F"
                className="font-mono uppercase tracking-wider"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room">Room number (optional)</Label>
              <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. 304B" />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Join dorm
            </Button>
          </form>

          {isSystemAdmin && (
            <div className="mt-6 rounded-md border border-dashed border-border bg-secondary/40 p-4 text-sm">
              You're a <strong>system admin</strong>.{" "}
              <button
                onClick={() => navigate("/admin")}
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                Skip and go to admin →
              </button>
            </div>
          )}

          <button
            onClick={signOut}
            className="mt-6 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Don't have a code? Ask your dorm admin to generate one.
        </p>
      </div>
    </div>
  );
};

export default DormOnboarding;
