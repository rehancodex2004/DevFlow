import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import KnowledgeSearchPage from "./pages/KnowledgeSearchPage";

// Auth
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// Organizations
import Organizations from "./pages/Organizations";
import OrganizationDetail from "./pages/OrganizationDetail";

// Projects
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";

import TasksPage from "./pages/TasksPage";

// Tasks
import TaskDetail from "./pages/TaskDetail";
import Profile from "./pages/Profile";
import Invitation from "./pages/Invitation";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* =========================
              PUBLIC ROUTES
          ========================== */}

          <Route path="/login" element={<Login />} />

          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invitations/:token" element={<Invitation />} />

          {/* =========================
              PROTECTED ROUTES
          ========================== */}

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Overview sirf maloomat dikhata hai; organization manage alag page par hoti hai. */}
            <Route path="/overview" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/overview" replace />} />

            {/* Organizations */}
            <Route path="/organizations" element={<Organizations />} />

            <Route path="/organizations/:id" element={<OrganizationDetail />} />

            {/* Projects */}
            <Route path="/projects" element={<Projects />} />

            <Route path="/projects/:id" element={<ProjectDetail />} />

            {/* Tasks */}
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />

            {/* Knowledge Search */}
            <Route path="/knowledge" element={<KnowledgeSearchPage />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* =========================
              UNKNOWN URL
          ========================== */}

          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
