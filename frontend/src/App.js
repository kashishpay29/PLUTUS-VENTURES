import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

import Login from "@/pages/Login";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import TicketBoard from "@/pages/admin/TicketBoard";
import TicketCreate from "@/pages/admin/TicketCreate";
import TicketDetail from "@/pages/admin/TicketDetail";
import EngineersPage from "@/pages/admin/EngineersPage";
import DevicesPage from "@/pages/admin/DevicesPage";
import LivePage from "@/pages/admin/LivePage";
import AnalyticsPage from "@/pages/admin/AnalyticsPage";
import CompaniesPage from "@/pages/admin/CompaniesPage";
import CompanyNew from "@/pages/admin/CompanyNew";
import CompanyDetail from "@/pages/admin/CompanyDetail";
import DeviceHistoryPage from "@/pages/admin/DeviceHistoryPage";
import SubAdminsPage from "@/pages/admin/SubAdminsPage";
import SubAdminAnalyticsPage from "@/pages/admin/SubAdminAnalyticsPage";

import EngineerLayout from "@/pages/engineer/EngineerLayout";
import EngineerHome from "@/pages/engineer/EngineerHome";
import EngineerTickets from "@/pages/engineer/EngineerTickets";
import EngineerTicketDetail from "@/pages/engineer/EngineerTicketDetail";
import EngineerAttendance from "@/pages/engineer/EngineerAttendance";
import EngineerProfile from "@/pages/engineer/EngineerProfile";

function Protected({ role, children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (role === "admin" && !["admin", "sub_admin"].includes(user.role)) {
    return <Navigate to={user.role === "engineer" ? "/engineer" : "/login"} replace />;
  }
  if (role === "engineer" && user.role !== "engineer") {
    return <Navigate to="/admin" replace />;
  }
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/engineer"} replace />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster richColors position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/admin" element={<Protected role="admin"><AdminLayout /></Protected>}>
              <Route index element={<AdminDashboard />} />
              <Route path="tickets" element={<TicketBoard />} />
              <Route path="tickets/new" element={<TicketCreate />} />
              <Route path="tickets/:id" element={<TicketDetail />} />
              <Route path="companies" element={<CompaniesPage />} />
              <Route path="companies/new" element={<CompanyNew />} />
              <Route path="companies/:id" element={<CompanyDetail />} />
              <Route path="engineers" element={<EngineersPage />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="device-history" element={<DeviceHistoryPage />} />
              <Route path="live" element={<LivePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="sub-admins" element={<SubAdminsPage />} />
              <Route path="sub-admins/:id/analytics" element={<SubAdminAnalyticsPage />} />
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
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;