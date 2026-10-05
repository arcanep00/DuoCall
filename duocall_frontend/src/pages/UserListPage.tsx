/**
 * UserListPage (replaces the placeholder DashboardPage)
 * Shows all other users, their online status, and an Audio Call button.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { getUsers } from '../api/authApi';
import type { User } from '../types';
import { useNavigate } from 'react-router-dom';

export default function UserListPage() {
  const { user, logout } = useAuth();
  const { startCall, onlineUsers, callState } = useCall();
  const navigate = useNavigate();

  const [users, setUsers]       = useState<User[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState('');
  const [callingId, setCallingId] = useState<number | null>(null);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => setError('Could not load users. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCall(target: User) {
    if (callState) return; // already in a call
    setCallingId(target.id);
    try {
      await startCall(target);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
        setError('Microphone permission denied. Please allow mic access and try again.');
      } else {
        setError('Could not start call. Please try again.');
      }
      setCallingId(null);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  // Clear calling indicator when call state changes
  useEffect(() => {
    if (!callState) setCallingId(null);
  }, [callState]);

  return (
    <div className="dashboard-container">
      {/* Header */}
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

      {/* Main content */}
      <main className="dashboard-main">
        <h2 className="section-title">People</h2>
        <p className="section-subtitle">Select someone to start an audio call.</p>

        {error && (
          <p className="error-banner" role="alert">{error}</p>
        )}

        {isLoading ? (
          <div className="loading-screen" style={{ height: '200px' }}>
            <div className="spinner" aria-label="Loading users…" />
          </div>
        ) : users.length === 0 ? (
          <p className="empty-state">No other users yet. Invite someone!</p>
        ) : (
          <ul className="user-list" role="list">
            {users.map((u) => {
              const isOnline  = onlineUsers.has(u.id) || u.is_online;
              const isCalling = callingId === u.id;
              const busy      = !!callState;

              return (
                <li key={u.id} className="user-row">
                  <div className="user-row-left">
                    {/* Avatar with online indicator */}
                    <div className="user-avatar-wrap">
                      <span className="avatar-circle" aria-hidden="true">
                        {u.display.charAt(0).toUpperCase()}
                      </span>
                      <span
                        className={`online-dot ${isOnline ? 'dot-online' : 'dot-offline'}`}
                        aria-label={isOnline ? 'Online' : 'Offline'}
                      />
                    </div>
                    <div>
                      <p className="user-display">{u.display}</p>
                      <p className="user-status-text">
                        {isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>

                  <button
                    className="btn-call"
                    onClick={() => handleCall(u)}
                    disabled={busy || !isOnline}
                    aria-label={`Call ${u.display}`}
                  >
                    {isCalling ? (
                      <>
                        <span className="call-spin" aria-hidden="true" />
                        Calling…
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">🎤</span> Call
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
