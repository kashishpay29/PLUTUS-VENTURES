import React, { Suspense, lazy } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

const Login = lazy(() => import("@/pages/Login"));

const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const TicketBoard = lazy(() => import("@/pages/admin/TicketBoard"));
const TicketCreate = lazy(() => import("@/pages/admin/TicketCreate"));
const TicketDetail = lazy(() => import("@/pages/admin/TicketDetail"));
const EngineersPage = lazy(() => import("@/pages/admin/EngineersPage"));
const DevicesPage = lazy(() => import("@/pages/admin/DevicesPage"));
const LivePage = lazy(() => import("@/pages/admin/LivePage"));
const AnalyticsPage = lazy(() => import("@/pages/admin/AnalyticsPage"));
const CompaniesPage = lazy(() => import("@/pages/admin/CompaniesPage"));
const CompanyNew = lazy(() => import("@/pages/admin/CompanyNew"));
const CompanyDetail = lazy(() => import("@/pages/admin/CompanyDetail"));
const DeviceHistoryPage = lazy(() => import("@/pages/admin/DeviceHistoryPage"));
const SubAdminsPage = lazy(() => import("@/pages/admin/SubAdminsPage"));
const SubAdminAnalyticsPage = lazy(() => import("@/pages/admin/SubAdminAnalyticsPage"));
const TicketAdminsPage = lazy(() => import("@/pages/admin/TicketAdminsPage"));
const CompanyAdminsPage = lazy(() => import("@/pages/admin/CompanyAdminsPage"));

const CompanyLayout = lazy(() => import("@/pages/company/CompanyLayout"));
const CompanyDashboard = lazy(() => import("@/pages/company/CompanyDashboard"));
const CompanyTickets = lazy(() => import("@/pages/company/CompanyTickets"));
const CompanyAnalytics = lazy(() => import("@/pages/company/CompanyAnalytics"));

const EngineerLayout = lazy(() => import("@/pages/engineer/EngineerLayout"));
const EngineerHome = lazy(() => import("@/pages/engineer/EngineerHome"));
const EngineerTickets = lazy(() => import("@/pages/engineer/EngineerTickets"));
const EngineerTicketDetail = lazy(() => import("@/pages/engineer/EngineerTicketDetail"));
const EngineerAttendance = lazy(() => import("@/pages/engineer/EngineerAttendance"));
const EngineerProfile = lazy(() => import("@/pages/engineer/EngineerProfile"));

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-white">
      <div className="text-sm text-slate-500">Loading...</div>
    </div>
  );
}

function Protected({ role, children }) {
  const { user } = useAuth();
  if (user === null) {
    return <LoadingScreen />;
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (role === "admin" && !["admin", "sub_admin", "ticket_admin"].includes(user.role)) {
    if (user.role === "engineer") return <Navigate to="/engineer" replace />;
    if (user.role === "company_admin") return <Navigate to="/company" replace />;
    return <Navigate to="/login" replace />;
  }
  if (role === "engineer" && user.role !== "engineer") {
    return <Navigate to="/admin" replace />;
  }
  if (role === "company_admin" && user.role !== "company_admin") {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

function RoleGate({ roles, children }) {
  const { user } = useAuth();
  if (user === null) return <LoadingScreen />;
  if (user === false) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/admin" replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return <LoadingScreen />;
  if (user === false) return <Navigate to="/login" replace />;
  if (["admin", "sub_admin", "ticket_admin"].includes(user.role)) return <Navigate to="/admin" replace />;
  if (user.role === "company_admin") return <Navigate to="/company" replace />;
  return <Navigate to="/engineer" replace />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster richColors position="top-right" />
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/admin" element={<Protected role="admin"><AdminLayout /></Protected>}>
                <Route index element={<AdminDashboard />} />
                <Route path="tickets" element={<TicketBoard />} />
                <Route path="tickets/new" element={<TicketCreate />} />
                <Route path="tickets/:id" element={<TicketDetail />} />
                <Route path="companies" element={<RoleGate roles={["admin", "sub_admin"]}><CompaniesPage /></RoleGate>} />
                <Route path="companies/new" element={<RoleGate roles={["admin", "sub_admin"]}><CompanyNew /></RoleGate>} />
                <Route path="companies/:id" element={<RoleGate roles={["admin", "sub_admin"]}><CompanyDetail /></RoleGate>} />
                <Route path="engineers" element={<RoleGate roles={["admin", "sub_admin"]}><EngineersPage /></RoleGate>} />
                <Route path="devices" element={<RoleGate roles={["admin"]}><DevicesPage /></RoleGate>} />
                <Route path="device-history" element={<DeviceHistoryPage />} />
                <Route path="live" element={<RoleGate roles={["admin", "sub_admin"]}><LivePage /></RoleGate>} />
                <Route path="analytics" element={<RoleGate roles={["admin", "sub_admin"]}><AnalyticsPage /></RoleGate>} />
                <Route path="sub-admins" element={<RoleGate roles={["admin"]}><SubAdminsPage /></RoleGate>} />
                <Route path="sub-admins/:id/analytics" element={<RoleGate roles={["admin"]}><SubAdminAnalyticsPage /></RoleGate>} />
                <Route path="ticket-admins" element={<RoleGate roles={["admin"]}><TicketAdminsPage /></RoleGate>} />
                <Route path="company-admins" element={<RoleGate roles={["admin"]}><CompanyAdminsPage /></RoleGate>} />
              </Route>

              <Route path="/company" element={<Protected role="company_admin"><CompanyLayout /></Protected>}>
                <Route index element={<CompanyDashboard />} />
                <Route path="tickets" element={<CompanyTickets />} />
                <Route path="tickets/:id" element={<TicketDetail />} />
                <Route path="analytics" element={<CompanyAnalytics />} />
              </Route>

              <Route path="/engineer" element={<Protected role="engineer"><EngineerLayout /></Protected>}>
                <Route index element={<EngineerHome />} />
                <Route path="tickets" element={<EngineerTickets />} />
                <Route path="tickets/:id" element={<EngineerTicketDetail />} />
                <Route path="attendance" element={<EngineerAttendance />} />
                <Route path="profile" element={<EngineerProfile />} />
              </Route>

              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
