import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioCall } from '../hooks/useAudioCall';
import { useAuth } from './AuthContext';
import type {
  ActiveCall,
  User,
  WsMessage,
  WsIncomingCall,
  WsOffer,
  WsAnswer,
  WsIceCandidate,
} from '../types';

interface AudioCallHandlers {
  handleCallAccepted: (receiverId: number, callId: number) => Promise<void>;
  handleOffer:        (msg: WsOffer) => Promise<void>;
  handleAnswer:       (msg: WsAnswer) => Promise<void>;
  handleIceCandidate: (msg: WsIceCandidate) => Promise<void>;
  handleRemoteHangup: (callId?: number) => void;
  getActiveCallId:    () => number | null;
}

interface CallContextValue {
  callState:    ActiveCall | null;
  startCall:    (receiver: User) => Promise<void>;
  endCall:      () => Promise<void>;
  toggleMute:   () => void;
  incomingCall: WsIncomingCall | null;
  acceptCall:   () => Promise<void>;
  rejectCall:   () => Promise<void>;
  onlineUsers:  Set<number>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [incomingCall, setIncomingCall] = useState<WsIncomingCall | null>(null);
  const [onlineUsers, setOnlineUsers]   = useState<Set<number>>(new Set());
  const incomingCallRef                 = useRef<WsIncomingCall | null>(null);
  const audioHandlersRef                = useRef<AudioCallHandlers | null>(null);
  const userRef                         = useRef(user);
  userRef.current = user;

  // Keep incomingCallRef in sync with state
  const setIncoming = useCallback((msg: WsIncomingCall | null) => {
    incomingCallRef.current = msg;
    setIncomingCall(msg);
  }, []);

  // ── WebSocket message router ─────────────────────────────────────────────
  const handleMessage = useCallback((msg: WsMessage) => {
    console.log('[WS] received:', msg.type, msg);
    const h = audioHandlersRef.current;
    const currentUserId = userRef.current?.id;

    switch (msg.type) {

      case 'presence':
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (msg.is_online) next.add(msg.user_id);
          else                next.delete(msg.user_id);
          return next;
        });
        break;

      case 'incoming_call':
        // Ignore if we are the caller (should not happen but guard anyway)
        if (msg.caller_id === currentUserId) break;
        // Only show if not already in a call
        if (!h?.getActiveCallId()) {
          setIncoming(msg);
        }
        break;

      case 'call_accepted':
        h?.handleCallAccepted(msg.receiver_id, msg.call_id);
        break;

      case 'call_rejected': {
        // Only process if this rejection is for our active call
        const activeId = h?.getActiveCallId();
        if (activeId && activeId === msg.call_id) {
          h?.handleRemoteHangup(msg.call_id);
        }
        break;
      }

      case 'call_ended': {
        // Only process if this end is for our active call
        const activeId = h?.getActiveCallId();
        if (activeId && activeId === msg.call_id) {
          h?.handleRemoteHangup(msg.call_id);
        }
        break;
      }

      case 'offer':
        h?.handleOffer(msg);
        break;

      case 'answer':
        h?.handleAnswer(msg);
        break;

      case 'ice_candidate':
        h?.handleIceCandidate(msg);
        break;

      case 'error':
        console.error('[SignalingServer]', msg.message);
        break;
    }
  }, [setIncoming]);

  const { sendMessage } = useWebSocket({
    onMessage: handleMessage,
    enabled:   isAuthenticated,
  });

  const {
    callState,
    activeCallId,
    startCall:    _startCall,
    acceptCall:   _acceptCall,
    rejectCall:   _rejectCall,
    endCall,
    toggleMute,
    handleCallAccepted,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleRemoteHangup,
  } = useAudioCall({
    currentUserId: user?.id,
    sendMessage,
    onCallStateChange: () => {},
  });

  // Keep ref in sync every render
  audioHandlersRef.current = {
    handleCallAccepted,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleRemoteHangup,
    getActiveCallId: () => activeCallId,
  };

  // ── public methods ───────────────────────────────────────────────────────

  const startCall = useCallback(
    async (receiver: User) => { await _startCall(receiver); },
    [_startCall],
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const snapshot = incomingCall;
    setIncoming(null);
    await _acceptCall(snapshot.call_id, snapshot.caller_id, snapshot.caller_name);
  }, [incomingCall, _acceptCall, setIncoming]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;
    const { call_id, caller_id } = incomingCall;
    setIncoming(null);
    await _rejectCall(call_id, caller_id);
  }, [incomingCall, _rejectCall, setIncoming]);

  return (
    <CallContext.Provider value={{
      callState,
      startCall,
      endCall,
      toggleMute,
      incomingCall,
      acceptCall,
      rejectCall,
      onlineUsers,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be inside <CallProvider>');
  return ctx;
}
