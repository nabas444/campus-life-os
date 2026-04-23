import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  User as UserIcon,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";

type TodoScope = "personal" | "dorm";

interface TodoList {
  id: string;
  scope: TodoScope;
  name: string;
  description: string | null;
  dorm_id: string | null;
  owner_id: string;
  color: string | null;
  created_at: string;
}

interface TodoItem {
  id: string;
  list_id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  assigned_to: string | null;
  position: number;
  created_by: string;
  created_at: string;
}

interface DormMember {
  user_id: string;
  full_name: string | null;
}

const dueLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return `Today · ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Tomorrow · ${format(d, "HH:mm")}`;
  return format(d, "MMM d · HH:mm");
};

const Todos = () => {
  const { user, primaryDormId, dorms } = useAuth();
  const [lists, setLists] = useState<TodoList[]>([]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [members, setMembers] = useState<DormMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TodoScope>("personal");
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [createListOpen, setCreateListOpen] = useState(false);

  const dormName = dorms[0]?.dorm_name ?? "Dorm";

  // Load data
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const queries: Promise<unknown>[] = [
        supabase
          .from("todo_lists")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("todo_items")
          .select("*")
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
      ];
      if (primaryDormId) {
        queries.push(
          supabase
            .from("dorm_members")
            .select("user_id, profiles:profiles!inner(full_name)")
            .eq("dorm_id", primaryDormId),
        );
      }
      const results = await Promise.all(queries);
      if (cancelled) return;
      const ls = (results[0] as { data: TodoList[] | null }).data ?? [];
      const its = (results[1] as { data: TodoItem[] | null }).data ?? [];
      setLists(ls);
      setItems(its);
      if (results[2]) {
        const mems =
          ((results[2] as { data: { user_id: string; profiles: { full_name: string | null } | null }[] | null })
            .data ?? []).map((m) => ({
            user_id: m.user_id,
            full_name: m.profiles?.full_name ?? null,
          }));
        setMembers(mems);
      }
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel("todos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todo_lists" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todo_items" },
        load,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user, primaryDormId]);

  const personalLists = useMemo(
    () => lists.filter((l) => l.scope === "personal"),
    [lists],
  );
  const dormLists = useMemo(
    () => lists.filter((l) => l.scope === "dorm" && l.dorm_id === primaryDormId),
    [lists, primaryDormId],
  );

  // Auto-pick active list when tab changes
  useEffect(() => {
    const pool = tab === "personal" ? personalLists : dormLists;
    if (pool.length === 0) {
      setActiveListId(null);
      return;
    }
    if (!pool.some((l) => l.id === activeListId)) {
      setActiveListId(pool[0].id);
    }
  }, [tab, personalLists, dormLists, activeListId]);

  const memberName = (uid: string | null) => {
    if (!uid) return null;
    if (uid === user?.id) return "You";
    return members.find((m) => m.user_id === uid)?.full_name ?? "Member";
  };

  const createList = async (
    name: string,
    description: string,
    scope: TodoScope,
  ) => {
    if (!user) return;
    if (scope === "dorm" && !primaryDormId) {
      toast.error("Join a dorm first");
      return;
    }
    const { data, error } = await supabase
      .from("todo_lists")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        scope,
        dorm_id: scope === "dorm" ? primaryDormId : null,
        owner_id: user.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`List "${data.name}" created`);
    setActiveListId(data.id);
    setCreateListOpen(false);
  };

  const deleteList = async (list: TodoList) => {
    if (!confirm(`Delete list "${list.name}" and all its items?`)) return;
    const { error } = await supabase
      .from("todo_lists")
      .delete()
      .eq("id", list.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("List deleted");
  };

  const addItem = async (
    listId: string,
    title: string,
    notes: string,
    dueAt: string,
    assignedTo: string | null,
  ) => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("todo_items").insert({
      list_id: listId,
      title: title.trim(),
      notes: notes.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      assigned_to: assignedTo,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
  };

  const toggleItem = async (item: TodoItem) => {
    if (!user) return;
    const isCompleted = !!item.completed_at;
    const { error } = await supabase
      .from("todo_items")
      .update({
        completed_at: isCompleted ? null : new Date().toISOString(),
        completed_by: isCompleted ? null : user.id,
      })
      .eq("id", item.id);
    if (error) toast.error(error.message);
  };

  const deleteItem = async (item: TodoItem) => {
    const { error } = await supabase
      .from("todo_items")
      .delete()
      .eq("id", item.id);
    if (error) toast.error(error.message);
  };

  const visibleLists = tab === "personal" ? personalLists : dormLists;
  const activeList = visibleLists.find((l) => l.id === activeListId) ?? null;
  const activeItems = activeList
    ? items.filter((i) => i.list_id === activeList.id)
    : [];

  // Stats
  const myOpenCount = items.filter(
    (i) =>
      !i.completed_at &&
      (i.created_by === user?.id || i.assigned_to === user?.id),
  ).length;
  const overdueCount = items.filter(
    (i) => !i.completed_at && i.due_at && isPast(new Date(i.due_at)),
  ).length;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            Todos
          </h1>
          <p className="text-sm text-muted-foreground">
            Personal lists for yourself · Shared lists for {dormName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {myOpenCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <ClipboardList className="h-3 w-3" />
              {myOpenCount} open for you
            </Badge>
          )}
          {overdueCount > 0 && (
            <Badge className="gap-1 bg-destructive/15 text-destructive hover:bg-destructive/20">
              <CalendarClock className="h-3 w-3" />
              {overdueCount} overdue
            </Badge>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TodoScope)}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="personal" className="gap-2">
                <UserIcon className="h-4 w-4" />
                Mine
                {personalLists.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                    {personalLists.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="dorm" className="gap-2" disabled={!primaryDormId}>
                <Users className="h-4 w-4" />
                {dormName}
                {dormLists.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                    {dormLists.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" size="sm">
                  <Plus className="h-4 w-4" />
                  New list
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Create a list</DialogTitle>
                </DialogHeader>
                <CreateListForm
                  defaultScope={tab}
                  hasDorm={!!primaryDormId}
                  dormName={dormName}
                  onSubmit={createList}
                />
              </DialogContent>
            </Dialog>
          </div>

          {(["personal", "dorm"] as const).map((scope) => (
            <TabsContent key={scope} value={scope} className="mt-0">
              {visibleLists.length === 0 && tab === scope ? (
                <Card className="p-12 text-center">
                  <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No {scope === "personal" ? "personal" : "shared dorm"} lists yet.
                  </p>
                  <Button
                    variant="soft"
                    size="sm"
                    className="mt-4"
                    onClick={() => setCreateListOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create your first list
                  </Button>
                </Card>
              ) : tab === scope ? (
                <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                  {/* Sidebar: list picker */}
                  <Card className="h-fit p-2">
                    {visibleLists.map((l) => {
                      const itemCount = items.filter((i) => i.list_id === l.id).length;
                      const openCount = items.filter(
                        (i) => i.list_id === l.id && !i.completed_at,
                      ).length;
                      const isActive = l.id === activeListId;
                      return (
                        <button
                          key={l.id}
                          onClick={() => setActiveListId(l.id)}
                          className={cn(
                            "group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-base",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-secondary",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{l.name}</div>
                            <div
                              className={cn(
                                "text-[11px]",
                                isActive
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground",
                              )}
                            >
                              {openCount} open · {itemCount} total
                            </div>
                          </div>
                          {openCount > 0 && (
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                isActive
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-accent/15 text-accent-foreground",
                              )}
                            >
                              {openCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </Card>

                  {/* Active list */}
                  <div>
                    {activeList ? (
                      <ListView
                        list={activeList}
                        items={activeItems}
                        members={members}
                        currentUserId={user?.id ?? null}
                        memberName={memberName}
                        canDeleteList={
                          activeList.owner_id === user?.id
                        }
                        onAddItem={addItem}
                        onToggleItem={toggleItem}
                        onDeleteItem={deleteItem}
                        onDeleteList={() => deleteList(activeList)}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AppShell>
  );
};

const CreateListForm = ({
  defaultScope,
  hasDorm,
  dormName,
  onSubmit,
}: {
  defaultScope: TodoScope;
  hasDorm: boolean;
  dormName: string;
  onSubmit: (name: string, description: string, scope: TodoScope) => Promise<void>;
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<TodoScope>(defaultScope);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        await onSubmit(name, description, scope);
        setSubmitting(false);
      }}
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ln">Name</Label>
        <Input
          id="ln"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Groceries, Cleaning rota"
          maxLength={80}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ld">Description (optional)</Label>
        <Textarea
          id="ld"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this list for?"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Visibility</Label>
        <Select value={scope} onValueChange={(v) => setScope(v as TodoScope)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="personal">
              <span className="flex items-center gap-2">
                <UserIcon className="h-3.5 w-3.5" />
                Personal — only you
              </span>
            </SelectItem>
            <SelectItem value="dorm" disabled={!hasDorm}>
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Shared with {dormName}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit" variant="hero" disabled={submitting || !name.trim()}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create list
        </Button>
      </DialogFooter>
    </form>
  );
};

const ListView = ({
  list,
  items,
  members,
  currentUserId,
  memberName,
  canDeleteList,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onDeleteList,
}: {
  list: TodoList;
  items: TodoItem[];
  members: DormMember[];
  currentUserId: string | null;
  memberName: (uid: string | null) => string | null;
  canDeleteList: boolean;
  onAddItem: (
    listId: string,
    title: string,
    notes: string,
    dueAt: string,
    assignedTo: string | null,
  ) => Promise<void>;
  onToggleItem: (item: TodoItem) => Promise<void>;
  onDeleteItem: (item: TodoItem) => Promise<void>;
  onDeleteList: () => void;
}) => {
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("none");
  const [showDetails, setShowDetails] = useState(false);

  const open = items.filter((i) => !i.completed_at);
  const done = items.filter((i) => i.completed_at);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onAddItem(
      list.id,
      newTitle,
      newNotes,
      newDue,
      newAssignee === "none" ? null : newAssignee,
    );
    setNewTitle("");
    setNewNotes("");
    setNewDue("");
    setNewAssignee("none");
    setShowDetails(false);
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-primary">
            {list.name}
          </h2>
          {list.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{list.description}</p>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            {open.length} open · {done.length} done
          </div>
        </div>
        {canDeleteList && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteList}
            title="Delete list"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Add item */}
      <form onSubmit={submit} className="mb-5 space-y-2 rounded-md border border-dashed border-border p-3">
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "Less" : "More"}
          </Button>
          <Button type="submit" variant="hero" size="sm" disabled={!newTitle.trim()}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        {showDetails && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="due" className="text-xs">Due</Label>
              <Input
                id="due"
                type="datetime-local"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
              />
            </div>
            {list.scope === "dorm" && (
              <div className="space-y-1">
                <Label className="text-xs">Assign to</Label>
                <Select value={newAssignee} onValueChange={setNewAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Anyone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Anyone</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.user_id === currentUserId ? "Me" : m.full_name ?? "Member"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="notes" className="text-xs">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional details..."
              />
            </div>
          </div>
        )}
      </form>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No items yet. Add one above ✨
        </p>
      ) : (
        <div className="space-y-1">
          {open.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              showAssignee={list.scope === "dorm"}
              memberName={memberName}
              currentUserId={currentUserId}
              onToggle={() => onToggleItem(it)}
              onDelete={() => onDeleteItem(it)}
            />
          ))}
          {done.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Completed
              </div>
              {done.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  showAssignee={list.scope === "dorm"}
                  memberName={memberName}
                  currentUserId={currentUserId}
                  onToggle={() => onToggleItem(it)}
                  onDelete={() => onDeleteItem(it)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const ItemRow = ({
  item,
  showAssignee,
  memberName,
  currentUserId,
  onToggle,
  onDelete,
}: {
  item: TodoItem;
  showAssignee: boolean;
  memberName: (uid: string | null) => string | null;
  currentUserId: string | null;
  onToggle: () => void;
  onDelete: () => void;
}) => {
  const completed = !!item.completed_at;
  const overdue = !completed && item.due_at && isPast(new Date(item.due_at));
  const assignedToMe = item.assigned_to === currentUserId;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-md border border-transparent px-2 py-2 transition-base hover:border-border hover:bg-secondary/40",
        completed && "opacity-60",
      )}
    >
      <Checkbox
        checked={completed}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm",
            completed && "line-through text-muted-foreground",
          )}
        >
          {item.title}
        </div>
        {item.notes && (
          <div className="mt-0.5 text-xs text-muted-foreground">{item.notes}</div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          {item.due_at && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 font-normal",
                overdue && "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              <CalendarClock className="h-3 w-3" />
              {dueLabel(item.due_at)}
            </Badge>
          )}
          {showAssignee && item.assigned_to && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 font-normal",
                assignedToMe && "border-accent/40 bg-accent/10 text-accent-foreground",
              )}
            >
              <UserIcon className="h-3 w-3" />
              {memberName(item.assigned_to)}
            </Badge>
          )}
          {completed && item.completed_by && (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              done by {memberName(item.completed_by)}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default Todos;
