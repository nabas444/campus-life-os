import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, CalendarRange, Package } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { RESOURCE_CATEGORIES, RESOURCE_CATEGORY_META, ITEM_CATEGORIES } from "@/components/phase2/meta";
import type { Database } from "@/integrations/supabase/types";

type Resource = Database["public"]["Tables"]["resources"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];
type ResourceCat = Database["public"]["Enums"]["resource_category"];
type ItemCat = Database["public"]["Enums"]["item_category"];

const AdminInventory = () => {
  const { user, isAdmin, primaryDormId } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);

  const load = async () => {
    if (!primaryDormId) return;
    const [r, i] = await Promise.all([
      supabase.from("resources").select("*").eq("dorm_id", primaryDormId).order("name"),
      supabase.from("items").select("*").eq("dorm_id", primaryDormId).is("owner_id", null).order("name"),
    ]);
    setResources((r.data ?? []) as Resource[]);
    setItems((i.data ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [primaryDormId]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const deleteResource = async (id: string) => {
    if (!confirm("Delete this resource? Bookings will also be removed.")) return;
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-primary">Inventory & resources</h1>
        <p className="text-sm text-muted-foreground">Manage what's bookable and shared in your dorm</p>
      </div>

      <Tabs defaultValue="resources">
        <TabsList>
          <TabsTrigger value="resources">
            <CalendarRange className="mr-1.5 h-3.5 w-3.5" /> Bookable resources ({resources.length})
          </TabsTrigger>
          <TabsTrigger value="items">
            <Package className="mr-1.5 h-3.5 w-3.5" /> Dorm inventory ({items.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Dialog open={resourceOpen} onOpenChange={setResourceOpen}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="h-4 w-4" /> Add resource
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">New bookable resource</DialogTitle>
                </DialogHeader>
                <ResourceForm
                  onCreated={() => {
                    setResourceOpen(false);
                    load();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          ) : resources.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No resources yet. Add one to let members book time slots.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {resources.map((r) => {
                const meta = RESOURCE_CATEGORY_META[r.category];
                const Icon = meta.Icon;
                return (
                  <Card key={r.id} className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold text-primary">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {meta.label} · {String(r.open_hour).padStart(2, "0")}:00–
                        {String(r.close_hour).padStart(2, "0")}:00 · cap {r.capacity}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteResource(r.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="items" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Dialog open={itemOpen} onOpenChange={setItemOpen}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="h-4 w-4" /> Add dorm item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">New dorm-owned item</DialogTitle>
                </DialogHeader>
                <DormItemForm
                  onCreated={() => {
                    setItemOpen(false);
                    load();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          ) : items.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No dorm-owned items yet. Add things like vacuum, iron, tools.
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((i) => (
                <Card key={i.id} className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-hero text-primary-foreground">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-semibold text-primary">{i.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.category} · max {i.max_loan_days}d
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem(i.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};

const ResourceForm = ({ onCreated }: { onCreated: () => void }) => {
  const { user, primaryDormId } = useAuth();
  const [category, setCategory] = useState<ResourceCat>("study_room");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !primaryDormId) return;
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const { error } = await supabase.from("resources").insert({
      dorm_id: primaryDormId,
      name: (fd.get("name") as string).trim(),
      description: ((fd.get("description") as string) || "").trim() || null,
      category,
      capacity: parseInt((fd.get("capacity") as string) || "1", 10),
      open_hour: parseInt((fd.get("open_hour") as string) || "6", 10),
      close_hour: parseInt((fd.get("close_hour") as string) || "23", 10),
      default_slot_minutes: parseInt((fd.get("slot") as string) || "30", 10),
      max_booking_minutes: parseInt((fd.get("max_minutes") as string) || "120", 10),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Resource added");
    onCreated();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="e.g. Study Room A" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ResourceCat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" name="capacity" type="number" min={1} defaultValue={1} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="open_hour">Opens at (hr)</Label>
          <Input id="open_hour" name="open_hour" type="number" min={0} max={23} defaultValue={6} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="close_hour">Closes at (hr)</Label>
          <Input id="close_hour" name="close_hour" type="number" min={1} max={24} defaultValue={23} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="slot">Slot length (min)</Label>
          <Input id="slot" name="slot" type="number" min={15} step={15} defaultValue={30} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_minutes">Max booking (min)</Label>
          <Input id="max_minutes" name="max_minutes" type="number" min={30} defaultValue={120} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <DialogFooter>
        <Button type="submit" variant="hero" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Add resource
        </Button>
      </DialogFooter>
    </form>
  );
};

const DormItemForm = ({ onCreated }: { onCreated: () => void }) => {
  const { user, primaryDormId } = useAuth();
  const [category, setCategory] = useState<ItemCat>("other");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !primaryDormId) return;
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const { error } = await supabase.from("items").insert({
      dorm_id: primaryDormId,
      owner_id: null, // dorm-owned
      name: (fd.get("name") as string).trim(),
      description: ((fd.get("description") as string) || "").trim() || null,
      category,
      max_loan_days: parseInt((fd.get("max_loan_days") as string) || "7", 10),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Added");
    onCreated();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="e.g. Vacuum cleaner" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ItemCat)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max_loan_days">Max loan (days)</Label>
          <Input id="max_loan_days" name="max_loan_days" type="number" min={1} defaultValue={3} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <DialogFooter>
        <Button type="submit" variant="hero" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Add to inventory
        </Button>
      </DialogFooter>
    </form>
  );
};

export default AdminInventory;
