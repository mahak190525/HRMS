import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { DashboardOverview } from '@/pages/dashboard/DashboardOverview';
import { LeaveApplication } from '@/pages/dashboard/LeaveApplication';
import { Documents } from '@/pages/dashboard/Documents';
import { Complaints } from '@/pages/dashboard/Complaints';
import { Performance } from '@/pages/dashboard/Performance';
import { ReferSomeone } from '@/pages/dashboard/ReferSomeone';
import { Settings } from '@/pages/dashboard/Settings';
import { Toaster } from 'sonner';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <LoginForm />} 
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardOverview />} />
        <Route path="dashboard/leave" element={<LeaveApplication />} />
        <Route path="dashboard/documents" element={<Documents />} />
        <Route path="dashboard/complaints" element={<Complaints />} />
        <Route path="dashboard/performance" element={<Performance />} />
        <Route path="dashboard/referrals" element={<ReferSomeone />} />
        <Route path="dashboard/settings" element={<Settings />} />
        <Route path="" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster position="top-right" />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;