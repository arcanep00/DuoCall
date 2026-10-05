/**
 * DashboardPage — Phase 1 placeholder.
 * Shows the logged-in user's name and a logout button.
 * User list and call buttons will be added in Phase 2.
 */
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="logo">DuoCall</h1>
        <div className="user-info">
          <span className="avatar-circle" aria-hidden="true">
            {user?.display.charAt(0).toUpperCase()}
          </span>
          <span className="username">{user?.display}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <p className="welcome">
          Welcome back, <strong>{user?.display}</strong> 👋
        </p>
        <p className="coming-soon">
          User list and calling features are coming in Phase 2.
        </p>
      </main>
    </div>
  );
}
