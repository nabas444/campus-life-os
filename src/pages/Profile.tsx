import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera, Save, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, bio, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setBio((data as any).bio ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (upErr) {
      toast.error(upErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", user.id);
    if (updErr) {
      toast.error(updErr.message);
    } else {
      setAvatarUrl(publicUrl);
      toast.success("Avatar updated");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null, bio: bio.trim() || null })
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      refresh();
    }
    setSaving(false);
  };

  const initials = (fullName || user?.email || "U").slice(0, 2).toUpperCase();

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-primary md:text-4xl">
            Your profile<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            How co-residents see you in chat, todos, and the directory.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex flex-col items-center gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
            <div className="relative">
              <Avatar className="h-24 w-24 border-2 border-primary/10">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={fullName || "avatar"} />
                ) : (
                  <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-base hover:scale-105 disabled:opacity-60"
                aria-label="Change avatar"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatar}
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="font-display text-xl font-semibold text-primary">
                {fullName || "Unnamed resident"}
              </div>
              <div className="text-sm text-muted-foreground">{user?.email}</div>
            </div>
          </div>

          <div className="space-y-5 pt-6">
            <div>
              <Label htmlFor="full_name">Display name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A line or two about you — major, hobbies, anything."
                rows={4}
                maxLength={280}
                className="mt-1.5 resize-none"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{bio.length}/280</div>
            </div>

            <Button onClick={handleSave} disabled={saving} variant="hero" className="w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default Profile;
