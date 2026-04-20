import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from "@/components/issues/issueMeta";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Enums"]["issue_category"];
type Priority = Database["public"]["Enums"]["issue_priority"];

const schema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(120).optional(),
});

const NewIssue = () => {
  const { user, primaryDormId } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>("utilities");
  const [priority, setPriority] = useState<Priority>("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const valid = list.filter((f) => f.type.startsWith("image/") && f.size < 10 * 1024 * 1024);
    if (valid.length !== list.length) toast.error("Only images under 10MB are allowed");
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !primaryDormId) {
      toast.error("You must be in a dorm to report an issue");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: fd.get("title"),
      description: fd.get("description") || undefined,
      location: fd.get("location") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }

    setSubmitting(true);

    const { data: issue, error } = await supabase
      .from("issues")
      .insert({
        dorm_id: primaryDormId,
        reporter_id: user.id,
        category,
        priority,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        location: parsed.data.location ?? null,
      })
      .select()
      .single();

    if (error || !issue) {
      setSubmitting(false);
      toast.error(error?.message ?? "Could not create issue");
      return;
    }

    // Upload attachments
    if (files.length > 0) {
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${issue.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("issue-attachments")
          .upload(path, file);
        if (upErr) {
          console.error(upErr);
          continue;
        }
        await supabase.from("issue_attachments").insert({
          issue_id: issue.id,
          storage_path: path,
          uploaded_by: user.id,
        });
      }
    }

    setSubmitting(false);
    toast.success("Issue reported");
    navigate(`/issues/${issue.id}`, { replace: true });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <h1 className="font-display text-3xl font-semibold text-primary">Report an issue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Help your dorm fix things faster. Be specific.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Card className="space-y-5 p-6">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" placeholder="e.g. Hot water out on 3rd floor" required maxLength={120} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{c.label}</span>
                          <span className="text-xs text-muted-foreground">{c.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location (optional)</Label>
              <Input id="location" name="location" placeholder="e.g. Bathroom 3B" maxLength={120} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="What's happening? When did it start?"
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label>Photos (optional, up to 5)</Label>
              <div className="flex flex-wrap gap-2">
                {files.map((f, idx) => (
                  <div
                    key={idx}
                    className="relative h-24 w-24 overflow-hidden rounded-md border border-border bg-secondary"
                  >
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 hover:bg-background"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {files.length < 5 && (
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-muted-foreground transition-base hover:border-primary hover:text-primary">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Add photo</span>
                    <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit report
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
};

export default NewIssue;
