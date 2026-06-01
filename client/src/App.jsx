import { Routes, Route, Navigate } from 'react-router-dom';

import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from './components/RouteGuards';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import AppLayout from './layouts/AppLayout';

import LoginPage from './pages/LoginPage';
import DrivePage from './pages/DrivePage';
import TrashPage from './pages/TrashPage';
import FavoritesPage from './pages/FavoritesPage';
import RecentPage from './pages/RecentPage';
import WorkLogPage from './pages/WorkLogPage';
import SettingsPage from './pages/SettingsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminLogs from './pages/admin/AdminLogs';
import AdminStats from './pages/admin/AdminStats';

export default function App() {
  return (
    <>
      <PWAUpdatePrompt />
      <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/drive" replace />} />
        <Route path="/drive" element={<DrivePage />} />
        <Route path="/drive/folder/:id" element={<DrivePage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/recent" element={<RecentPage />} />
        <Route path="/worklog" element={<WorkLogPage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <AdminRoute>
              <AdminLogs />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/stats"
          element={
            <AdminRoute>
              <AdminStats />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/drive" replace />} />
      </Routes>
    </>
  );
}
