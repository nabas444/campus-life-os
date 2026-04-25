import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Loader2, Building2, KeyRound, Crown, Shield } from "lucide-react";
import { toast } from "sonner";

const DormOnboarding = () => {
  const { user, dorms, refresh, signOut, isSystemAdmin, isBlockAdmin } = useAuth();
  const navigate = useNavigate();

  // Member tab state
  const [memberCode, setMemberCode] = useState("");
  const [room, setRoom] = useState("");
  const [memberLoading, setMemberLoading] = useState(false);

  // Representative tab state
  const [repCode, setRepCode] = useState("");
  const [dormName, setDormName] = useState("");
  const [block, setBlock] = useState("");
  const [dormNumber, setDormNumber] = useState("");
  const [repLoading, setRepLoading] = useState(false);

  // Block admin tab state
  const [blockCode, setBlockCode] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => {
    if (dorms.length > 0) navigate("/dashboard", { replace: true });
    else if (isBlockAdmin || isSystemAdmin) navigate("/admin", { replace: true });
  }, [dorms, isBlockAdmin, isSystemAdmin, navigate]);

  // ── Member: redeem invite code ──────────────────────────────────────────────
  const handleMemberJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (memberCode.trim().length < 4) {
      toast.error("Enter a valid invite code");
      return;
    }
    setMemberLoading(true);

    const { data: invite, error: inviteErr } = await supabase
      .from("dorm_invites")
      .select("*")
      .eq("code", memberCode.trim().toUpperCase())
      .maybeSingle();

    if (inviteErr || !invite) {
      setMemberLoading(false);
      toast.error("Invite code not found");
      return;
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      setMemberLoading(false);
      toast.error("This invite has expired");
      return;
    }
    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      setMemberLoading(false);
      toast.error("This invite has reached its limit");
      return;
    }

    const { error: memberErr } = await supabase.from("dorm_members").insert({
      user_id: user.id,
      dorm_id: invite.dorm_id,
      room_number: room.trim() || null,
    });

    if (memberErr) {
      setMemberLoading(false);
      if (memberErr.code === "23505") {
        toast.error("You're already a member of this dorm");
      } else {
        toast.error(memberErr.message);
      }
      return;
    }

    if (invite.role_granted !== "student") {
      await supabase.from("user_roles").insert({
        user_id: user.id,
        role: invite.role_granted,
      });
    }

    await supabase
      .from("dorm_invites")
      .update({ uses_count: invite.uses_count + 1 })
      .eq("id", invite.id);

    await refresh();
    setMemberLoading(false);
    toast.success("Joined your dorm!");
    navigate("/dashboard", { replace: true });
  };

  // ── Representative: redeem rep token + create dorm ──────────────────────────
  const handleRepRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (repCode.trim().length < 4) {
      toast.error("Enter a valid representative key");
      return;
    }
    if (dormName.trim().length < 2) {
      toast.error("Enter a dorm name");
      return;
    }
    setRepLoading(true);

    const { error } = await supabase.rpc("redeem_rep_token", {
      _code: repCode.trim().toUpperCase(),
      _dorm_name: dormName.trim(),
      _block: block.trim(),
      _dorm_number: dormNumber.trim(),
    });

    setRepLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await refresh();
    toast.success("Dorm created — you're the representative!");
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
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Operating System
            </div>
          </div>
        </div>

        <Card className="border-border bg-card p-8 shadow-elegant">
          <Tabs defaultValue="member" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="member">
                <Building2 className="mr-1.5 h-3.5 w-3.5" />
                Member
              </TabsTrigger>
              <TabsTrigger value="rep">
                <Crown className="mr-1.5 h-3.5 w-3.5" />
                Representative
              </TabsTrigger>
            </TabsList>

            {/* MEMBER TAB */}
            <TabsContent value="member">
              <h1 className="mb-1 font-display text-2xl font-semibold text-primary">
                Join your dorm
              </h1>
              <p className="mb-5 text-sm text-muted-foreground">
                Enter the membership key from your dorm representative.
              </p>
              <form onSubmit={handleMemberJoin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="member-code" className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    Membership key
                  </Label>
                  <Input
                    id="member-code"
                    value={memberCode}
                    onChange={(e) => setMemberCode(e.target.value.toUpperCase())}
                    placeholder="e.g. STERLING-A4F"
                    className="font-mono uppercase tracking-wider"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="room">Room number (optional)</Label>
                  <Input
                    id="room"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. 304B"
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={memberLoading}
                >
                  {memberLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Join dorm
                </Button>
              </form>
            </TabsContent>

            {/* REPRESENTATIVE TAB */}
            <TabsContent value="rep">
              <h1 className="mb-1 font-display text-2xl font-semibold text-primary">
                Claim your dorm
              </h1>
              <p className="mb-5 text-sm text-muted-foreground">
                Use the representative key from your system admin to create and manage your dorm.
              </p>
              <form onSubmit={handleRepRedeem} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rep-code" className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    Representative key
                  </Label>
                  <Input
                    id="rep-code"
                    value={repCode}
                    onChange={(e) => setRepCode(e.target.value.toUpperCase())}
                    placeholder="e.g. REP-9X2L"
                    className="font-mono uppercase tracking-wider"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dorm-name">Dorm name</Label>
                  <Input
                    id="dorm-name"
                    value={dormName}
                    onChange={(e) => setDormName(e.target.value)}
                    placeholder="e.g. Sterling Hall"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="block">Block</Label>
                    <Input
                      id="block"
                      value={block}
                      onChange={(e) => setBlock(e.target.value)}
                      placeholder="e.g. A"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dorm-number">Dorm number</Label>
                    <Input
                      id="dorm-number"
                      value={dormNumber}
                      onChange={(e) => setDormNumber(e.target.value)}
                      placeholder="e.g. 12"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={repLoading}
                >
                  {repLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create my dorm
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {isSystemAdmin && (
            <div className="mt-6 rounded-md border border-dashed border-border bg-secondary/40 p-4 text-sm">
              You're a <strong>system admin</strong> — no key required.{" "}
              <button
                onClick={() => navigate("/admin")}
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                Skip to admin →
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
          Don't have a key? Ask your dorm representative or system admin.
        </p>
      </div>
    </div>
  );
};

export default DormOnboarding;
