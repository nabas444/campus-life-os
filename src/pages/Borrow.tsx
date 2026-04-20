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
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Plus, Package, Search, Building2, User as UserIcon, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ITEM_CATEGORIES, ITEM_CATEGORY_META } from "@/components/phase2/meta";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Item = Database["public"]["Tables"]["items"]["Row"];
type ItemCat = Database["public"]["Enums"]["item_category"];

const Borrow = () => {
  const { user, primaryDormId } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [requestItem, setRequestItem] = useState<Item | null>(null);

  const load = async () => {
    if (!primaryDormId) return;
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("dorm_id", primaryDormId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [primaryDormId]);

  const filtered = items.filter((i) => {
    if (filterCat !== "all" && i.category !== filterCat) return false;
    if (filterOwner === "shared" && i.owner_id !== null) return false;
    if (filterOwner === "peer" && i.owner_id === null) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!primaryDormId) {
    return (
      <AppShell>
        <Card className="p-8 text-center">Join a dorm first.</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Borrow & lend</h1>
          <p className="text-sm text-muted-foreground">
            Items shared by your dorm and your neighbors
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/borrow/requests">My requests</Link>
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="h-4 w-4" /> List item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Lend an item</DialogTitle>
                <DialogDescription>Share something you own with your dorm neighbors.</DialogDescription>
              </DialogHeader>
              <ItemForm
                onCreated={() => {
                  setCreateOpen(false);
                  load();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4 flex flex-col gap-3 p-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="pl-9" />
        </div>
        <Tabs value={filterOwner} onValueChange={setFilterOwner}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="shared">
              <Building2 className="mr-1.5 h-3.5 w-3.5" /> Dorm
            </TabsTrigger>
            <TabsTrigger value="peer">
              <UserIcon className="mr-1.5 h-3.5 w-3.5" /> Members
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {ITEM_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing here yet. Be the first to list something.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} onBorrow={() => setRequestItem(item)} />
          ))}
        </div>
      )}

      {/* Borrow request dialog */}
      <Dialog open={!!requestItem} onOpenChange={(o) => !o && setRequestItem(null)}>
        <DialogContent>
          {requestItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Request to borrow</DialogTitle>
                <DialogDescription>{requestItem.name}</DialogDescription>
              </DialogHeader>
              <BorrowRequestForm
                item={requestItem}
                onDone={() => {
                  setRequestItem(null);
                  load();
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

const ItemCard = ({ item, onBorrow }: { item: Item; onBorrow: () => void }) => {
  const meta = ITEM_CATEGORY_META[item.category];
  const Icon = meta.Icon;
  const isShared = item.owner_id === null;
  return (
    <Card className="group flex flex-col overflow-hidden p-5 transition-base hover:shadow-md">
      <div className="mb-3 flex items-start gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-md",
            isShared ? "bg-gradient-hero text-primary-foreground" : "bg-accent-soft text-accent",
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold text-primary">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            {isShared ? "Dorm inventory" : "Member-owned"} · {meta.label}
          </div>
        </div>
      </div>
      {item.description && (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
      )}
      <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>Max loan: {item.max_loan_days}d</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium",
            item.is_available ? "bg-success/15 text-success" : "bg-muted",
          )}
        >
          {item.is_available ? "Available" : "Out"}
        </span>
      </div>
      <Button onClick={onBorrow} disabled={!item.is_available} className="mt-3" variant="accent">
        Request to borrow
      </Button>
    </Card>
  );
};

const ItemForm = ({ onCreated }: { onCreated: () => void }) => {
  const { user, primaryDormId, isAdmin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<ItemCat>("other");
  const [isShared, setIsShared] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !primaryDormId) return;
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string).trim();
    if (name.length < 2) {
      toast.error("Name too short");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("items").insert({
      dorm_id: primaryDormId,
      owner_id: isShared && isAdmin ? null : user.id,
      name,
      description: ((fd.get("description") as string) || "").trim() || null,
      category,
      max_loan_days: parseInt((fd.get("max_loan_days") as string) || "7", 10),
      condition: ((fd.get("condition") as string) || "").trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Item listed");
    onCreated();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {isAdmin && (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 p-3 text-sm">
          <input
            id="shared"
            type="checkbox"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <label htmlFor="shared">List as dorm inventory (no personal owner)</label>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name">Item name</Label>
        <Input id="name" name="name" placeholder="e.g. Hair dryer" required />
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
          <Input id="max_loan_days" name="max_loan_days" type="number" min={1} max={90} defaultValue={7} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="condition">Condition (optional)</Label>
        <Input id="condition" name="condition" placeholder="e.g. Like new" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} placeholder="Anything to know?" />
      </div>
      <DialogFooter>
        <Button type="submit" variant="hero" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          List item
        </Button>
      </DialogFooter>
    </form>
  );
};

const BorrowRequestForm = ({ item, onDone }: { item: Item; onDone: () => void }) => {
  const { user, primaryDormId } = useAuth();
  const [from, setFrom] = useState<Date | undefined>(new Date());
  const [until, setUntil] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() + Math.min(item.max_loan_days, 3));
    return d;
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !primaryDormId || !from || !until) return;
    if (until <= from) {
      toast.error("Return date must be after start");
      return;
    }
    const days = (until.getTime() - from.getTime()) / 86400000;
    if (days > item.max_loan_days) {
      toast.error(`Max loan is ${item.max_loan_days} days`);
      return;
    }
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    const { error } = await supabase.from("borrow_requests").insert({
      item_id: item.id,
      borrower_id: user.id,
      dorm_id: primaryDormId,
      requested_from: from.toISOString(),
      requested_until: until.toISOString(),
      notes: ((fd.get("notes") as string) || "").trim() || null,
      status: item.owner_id === null ? "approved" : "requested", // Dorm-shared = auto approved
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(item.owner_id === null ? "Reserved!" : "Request sent");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <DatePick label="From" date={from} onChange={setFrom} />
        <DatePick label="Until" date={until} onChange={setUntil} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Note (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Why you need it?" />
      </div>
      <p className="text-xs text-muted-foreground">
        {item.owner_id === null
          ? "This is dorm inventory — your reservation is auto-approved."
          : "The owner will review your request."}
      </p>
      <DialogFooter>
        <Button type="submit" variant="hero" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Send request
        </Button>
      </DialogFooter>
    </form>
  );
};

const DatePick = ({
  label,
  date,
  onChange,
}: {
  label: string;
  date: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  </div>
);

export default Borrow;
