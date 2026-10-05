/**
 * ActiveCallScreen
 * Full-screen overlay shown while a call is in progress (calling → connected).
 */
import { useCall } from '../context/CallContext';

const STATUS_LABELS: Record<string, string> = {
  calling:      'Calling…',
  ringing:      'Ringing…',
  accepted:     'Connecting…',
  connecting:   'Connecting…',
  connected:    'Connected',
  disconnected: 'Reconnecting…',
  failed:       'Call failed',
  ended:        'Call ended',
};

export default function ActiveCallScreen() {
  const { callState, endCall, toggleMute } = useCall();

  if (!callState) return null;

  // Only show while a call is in any active state
  const activeStatuses = new Set([
    'calling', 'ringing', 'accepted', 'connecting', 'connected', 'disconnected',
  ]);
  if (!activeStatuses.has(callState.status)) return null;

  const statusLabel = STATUS_LABELS[callState.status] ?? callState.status;
  const isConnected = callState.status === 'connected';

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Active call">
      <div className="active-call-card">
        {/* Peer info */}
        <div className="call-avatar" aria-hidden="true">
          {callState.peerName.charAt(0).toUpperCase()}
        </div>
        <h2 className="call-peer-name">{callState.peerName}</h2>

        {/* Status */}
        <p className={`call-status ${isConnected ? 'status-connected' : 'status-waiting'}`}>
          <span className={`status-dot ${isConnected ? 'dot-green' : 'dot-amber'}`} aria-hidden="true" />
          {statusLabel}
        </p>

        {/* Controls — only meaningful once connected */}
        <div className="call-controls">
          {/* Mute button */}
          <button
            className={`ctrl-btn ${callState.isMuted ? 'ctrl-active' : ''}`}
            onClick={toggleMute}
            disabled={!isConnected}
            aria-label={callState.isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={callState.isMuted}
          >
            <span className="ctrl-icon" aria-hidden="true">
              {callState.isMuted ? '🔇' : '🎤'}
            </span>
            <span className="ctrl-label">
              {callState.isMuted ? 'Unmute' : 'Mute'}
            </span>
          </button>

          {/* End call button */}
          <button
            className="ctrl-btn ctrl-end"
            onClick={endCall}
            aria-label="End call"
          >
            <span className="ctrl-icon" aria-hidden="true">📵</span>
            <span className="ctrl-label">End</span>
          </button>
        </div>
      </div>
    </div>
  );
}
