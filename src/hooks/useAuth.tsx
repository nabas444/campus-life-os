import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type DormMembership = {
  dorm_id: string;
  dorm_name: string;
  room_number: string | null;
};

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  dorms: DormMembership[];
  primaryDormId: string | null;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [dorms, setDorms] = useState<DormMembership[]>([]);

  const loadProfile = async (uid: string) => {
    const [{ data: roleRows }, { data: memberRows }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("dorm_members")
        .select("dorm_id, room_number, dorms(name)")
        .eq("user_id", uid),
    ]);

    setRoles((roleRows ?? []).map((r) => r.role));
    setDorms(
      (memberRows ?? []).map((m: any) => ({
        dorm_id: m.dorm_id,
        dorm_name: m.dorms?.name ?? "Dorm",
        room_number: m.room_number,
      })),
    );
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer Supabase calls — avoid deadlock
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setRoles([]);
        setDorms([]);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        roles,
        dorms,
        primaryDormId: dorms[0]?.dorm_id ?? null,
        isAdmin: roles.includes("dorm_admin") || roles.includes("system_admin"),
        isSystemAdmin: roles.includes("system_admin"),
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
