import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Landing from "./Landing";

const Index = () => {
  const { user, loading, dorms, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-parchment">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    // Dorm admins & system admins can use the app without joining a dorm via invite
    if (dorms.length === 0 && !isAdmin) return <Navigate to="/onboarding/dorm" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Landing />;
};

export default Index;
