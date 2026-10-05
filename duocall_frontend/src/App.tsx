import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CallProvider } from './context/CallContext';
import ProtectedRoute from './components/ProtectedRoute';
import IncomingCallScreen from './components/IncomingCallScreen';
import ActiveCallScreen from './components/ActiveCallScreen';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserListPage from './pages/UserListPage';

/**
 * AppShell wraps the authenticated area.
 * Both call overlays (incoming + active) live here so they can appear
 * on top of any page without needing per-page logic.
 */
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CallProvider>
      {children}
      <IncomingCallScreen />
      <ActiveCallScreen />
    </CallProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected — wrapped in AppShell for call overlays */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell>
                  <UserListPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
