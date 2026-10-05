/**
 * IncomingCallScreen
 * Shown as an overlay when someone is calling the logged-in user.
 */
import { useCall } from '../context/CallContext';

export default function IncomingCallScreen() {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="incoming-card">
        {/* Pulsing avatar */}
        <div className="pulse-ring" aria-hidden="true">
          <div className="caller-avatar">
            {incomingCall.caller_name.charAt(0).toUpperCase()}
          </div>
        </div>

        <p className="incoming-label">Incoming Audio Call</p>
        <h2 className="incoming-caller">{incomingCall.caller_name}</h2>

        <div className="incoming-actions">
          <button
            className="btn-reject"
            onClick={rejectCall}
            aria-label="Reject call"
          >
            <span className="btn-icon">✕</span>
            Decline
          </button>
          <button
            className="btn-accept"
            onClick={acceptCall}
            aria-label="Accept call"
          >
            <span className="btn-icon">✓</span>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
