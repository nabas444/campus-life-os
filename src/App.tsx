import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DormOnboarding from "./pages/DormOnboarding";
import Dashboard from "./pages/Dashboard";
import IssuesList from "./pages/IssuesList";
import IssueDetail from "./pages/IssueDetail";
import NewIssue from "./pages/NewIssue";
import Notifications from "./pages/Notifications";
import Admin from "./pages/Admin";
import AdminInventory from "./pages/AdminInventory";
import Borrow from "./pages/Borrow";
import BorrowRequests from "./pages/BorrowRequests";
import Resources from "./pages/Resources";
import ResourceDetail from "./pages/ResourceDetail";
import MyBookings from "./pages/MyBookings";
import Announcements from "./pages/Announcements";
import Feed from "./pages/Feed";
import Chat from "./pages/Chat";
import Utilities from "./pages/Utilities";
import AdminUtilities from "./pages/AdminUtilities";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/onboarding/dorm"
              element={
                <ProtectedRoute>
                  <DormOnboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/issues"
              element={
                <ProtectedRoute>
                  <IssuesList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/issues/new"
              element={
                <ProtectedRoute>
                  <NewIssue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/issues/:id"
              element={
                <ProtectedRoute>
                  <IssueDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <ProtectedRoute>
                  <AdminInventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/borrow"
              element={
                <ProtectedRoute>
                  <Borrow />
                </ProtectedRoute>
              }
            />
            <Route
              path="/borrow/requests"
              element={
                <ProtectedRoute>
                  <BorrowRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources"
              element={
                <ProtectedRoute>
                  <Resources />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources/:id"
              element={
                <ProtectedRoute>
                  <ResourceDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources/my"
              element={
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/feed"
              element={
                <ProtectedRoute>
                  <Feed />
                </ProtectedRoute>
              }
            />
            <Route
              path="/announcements"
              element={
                <ProtectedRoute>
                  <Announcements />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:type/:id"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/utilities"
              element={
                <ProtectedRoute>
                  <Utilities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/utilities"
              element={
                <ProtectedRoute>
                  <AdminUtilities />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
