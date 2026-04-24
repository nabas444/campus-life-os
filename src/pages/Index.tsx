import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Landing from "./Landing";

const Index = () => {
  const { user, loading, dorms, isSystemAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-parchment">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    // System admins go straight to admin even without a dorm membership.
    if (dorms.length === 0 && !isSystemAdmin) return <Navigate to="/onboarding/dorm" replace />;
    return <Navigate to={isSystemAdmin && dorms.length === 0 ? "/admin" : "/dashboard"} replace />;
  }

  return <Landing />;
};

export default Index;
