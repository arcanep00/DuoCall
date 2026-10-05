/**
 * useAudioCall
 * ============
 * All WebRTC logic for audio-only calls lives here.
 *
 * Responsibilities:
 *  - Create / manage RTCPeerConnection
 *  - Get microphone stream
 *  - Create SDP offer (caller) and answer (receiver)
 *  - Exchange ICE candidates through the signaling server
 *  - Attach the remote audio stream to an <audio> element
 *  - Mute / unmute local mic
 *  - Clean up everything on hang-up
 *
 * The hook is intentionally side-effect free until a call actually starts —
 * no microphone is opened until startCall() or acceptCall() is invoked.
 */

import { useRef, useCallback, useState } from 'react';
import type { ActiveCall, CallStatus, WsAnswer, WsIceCandidate, WsOffer } from '../types';
import * as callApi from '../api/callApi';

// Public Google STUN — good enough for development.
// Replace with your own STUN/TURN in production.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface UseAudioCallOptions {
  currentUserId?: number; // reserved for future use (e.g. logging)
  sendMessage: (data: object) => boolean;
  onCallStateChange: (call: ActiveCall | null) => void;
}

export function useAudioCall({
  currentUserId: _currentUserId,
  sendMessage,
  onCallStateChange,
}: UseAudioCallOptions) {

  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const remoteAudioRef   = useRef<HTMLAudioElement | null>(null);
  const activeCallRef    = useRef<ActiveCall | null>(null);
  // Queue ICE candidates that arrive before remote desc is set
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);

  const [callState, setCallState] = useState<ActiveCall | null>(null);

  // ── internal helpers ────────────────────────────────────────────────────

  function updateCallState(patch: Partial<ActiveCall> | null) {
    if (patch === null) {
      activeCallRef.current = null;
      setCallState(null);
      onCallStateChange(null);
      return;
    }
    const updated = { ...activeCallRef.current!, ...patch };
    activeCallRef.current = updated;
    setCallState(updated);
    onCallStateChange(updated);
  }

  function updateStatus(status: CallStatus) {
    updateCallState({ status });
  }

  /** Get microphone stream. Throws on denial. */
  async function getMic(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  }

  /** Create a fresh RTCPeerConnection and wire up all callbacks. */
  function createPeerConnection(peerId: number, callId: number): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Send each ICE candidate to the peer via signaling
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendMessage({
          type: 'ice_candidate',
          target_id: peerId,
          call_id: callId,
          candidate: candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') {
        updateStatus('connected');
      } else if (s === 'disconnected') {
        updateStatus('disconnected');
      } else if (s === 'failed') {
        updateStatus('failed');
        cleanup();
      } else if (s === 'closed') {
        updateStatus('ended');
      }
    };

    // When remote audio track arrives, attach it to an <audio> element
    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack fired, streams:', event.streams.length);
      const remoteStream = event.streams[0] ?? new MediaStream([event.track]);

      // Reuse existing element or create a new one attached to the DOM
      let audio = remoteAudioRef.current;
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        // Must be in the DOM for autoplay policy to work in some browsers
        audio.style.display = 'none';
        document.body.appendChild(audio);
        remoteAudioRef.current = audio;
      }

      audio.srcObject = remoteStream;

      // Explicitly call play() — required after setting srcObject
      audio.play().catch((err) => {
        console.warn('[WebRTC] audio.play() failed:', err);
      });

      console.log('[WebRTC] Remote audio attached and playing');
    };

    return pc;
  }

  /** Stop everything and reset state. */
  const cleanup = useCallback(() => {
    // Stop local mic tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    // Detach and remove remote audio element from DOM
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.pause();
      if (remoteAudioRef.current.parentNode) {
        remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
      }
      remoteAudioRef.current = null;
    }

    iceCandidateQueue.current = [];
    updateCallState(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── public API ──────────────────────────────────────────────────────────

  /**
   * Caller side: create call record, set up PeerConnection, send offer.
   */
  const startCall = useCallback(async (receiver: { id: number; display: string }) => {
    try {
      // 1. Get mic FIRST — so permission popup doesn't block the API call
      const stream = await getMic();

      // 2. Create call record on server → get call_id
      console.log('[startCall] creating call, receiver:', receiver.id, 'token:', localStorage.getItem('access_token')?.slice(-10));
      const callRecord = await callApi.createCall(receiver.id);
      const callId     = callRecord.id;

      // 3. Set initial call state
      const initial: ActiveCall = {
        callId,
        peerId:   receiver.id,
        peerName: receiver.display,
        isCaller: true,
        status:   'calling',
        isMuted:  false,
      };
      activeCallRef.current = initial;
      setCallState(initial);
      onCallStateChange(initial);

      // 4. Create peer connection
      const pc = createPeerConnection(receiver.id, callId);

      // 5. Add local audio tracks
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // 6. Create SDP offer and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7. Tell server "I'm calling this person" — server notifies receiver
      sendMessage({
        type:        'call_offer',
        receiver_id: receiver.id,
        call_id:     callId,
      });

    } catch (err) {
      console.error('[AudioCall] startCall failed:', err);
      cleanup();
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMessage, cleanup]);

  /**
   * Receiver side: accept incoming call, create answer.
   */
  const acceptCall = useCallback(async (
    callId: number,
    callerId: number,
    callerName: string,
  ) => {
    try {
      // 1. Get mic FIRST before any API calls
      await getMic();

      // 2. Update server record
      await callApi.callAction(callId, 'accept');

      // 3. Set call state
      const initial: ActiveCall = {
        callId,
        peerId:   callerId,
        peerName: callerName,
        isCaller: false,
        status:   'accepted',
        isMuted:  false,
      };
      activeCallRef.current = initial;
      setCallState(initial);
      onCallStateChange(initial);

      // 4. Tell caller we accepted via WebSocket
      sendMessage({
        type:      'call_accepted',
        caller_id: callerId,
        call_id:   callId,
      });

      // 5. Create peer connection — offer will arrive from caller shortly
      createPeerConnection(callerId, callId);
      updateStatus('connecting');

    } catch (err) {
      console.error('[AudioCall] acceptCall failed:', err);
      cleanup();
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMessage, cleanup]);

  /**
   * Reject an incoming call.
   */
  const rejectCall = useCallback(async (callId: number, callerId: number) => {
    try {
      await callApi.callAction(callId, 'reject');
    } catch { /* best effort */ }
    sendMessage({
      type:      'call_rejected',
      caller_id: callerId,
      call_id:   callId,
    });
    cleanup();
  }, [sendMessage, cleanup]);

  /**
   * End an active call (either party).
   */
  const endCall = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current) return;
    // Clear state immediately so UI updates
    cleanup();
    // Tell server
    try {
      await callApi.callAction(current.callId, 'end');
    } catch { /* best effort */ }
    // Tell peer via WebSocket
    sendMessage({
      type:     'call_ended',
      peer_id:  current.peerId,
      call_id:  current.callId,
    });
  }, [sendMessage, cleanup]);

  /**
   * Toggle local microphone mute.
   */
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    updateCallState({ isMuted: !activeCallRef.current?.isMuted });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WebRTC message handlers (called from useSignaling) ───────────────────

  /**
   * Caller receives: call was accepted → send the SDP offer now.
   */
  const handleCallAccepted = useCallback(async (receiverId: number, callId: number) => {
    const pc = pcRef.current;
    if (!pc) return;
    updateStatus('connecting');

    // Now send the offer we created in startCall
    sendMessage({
      type:      'offer',
      target_id: receiverId,
      call_id:   callId,
      sdp:       pc.localDescription,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMessage]);

  /**
   * Receiver gets the SDP offer from the caller.
   */
  const handleOffer = useCallback(async ({ sdp, from_id, call_id }: WsOffer) => {
    const pc = pcRef.current;
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Flush any queued ICE candidates
    for (const c of iceCandidateQueue.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }
    iceCandidateQueue.current = [];

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendMessage({
      type:      'answer',
      target_id: from_id,
      call_id:   call_id,
      sdp:       answer,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMessage]);

  /**
   * Caller gets the SDP answer from the receiver.
   */
  const handleAnswer = useCallback(async ({ sdp }: WsAnswer) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Flush queued ICE candidates
    for (const c of iceCandidateQueue.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }
    iceCandidateQueue.current = [];
  }, []);

  /**
   * ICE candidate from the peer.
   */
  const handleIceCandidate = useCallback(async ({ candidate }: WsIceCandidate) => {
    const pc = pcRef.current;
    if (!pc) {
      iceCandidateQueue.current.push(candidate);
      return;
    }
    if (pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Remote description not set yet — queue it
      iceCandidateQueue.current.push(candidate);
    }
  }, []);

  /**
   * The other party ended/rejected the call.
   * Guard: only act if there is actually an active call AND call_id matches.
   */
  const handleRemoteHangup = useCallback((callId?: number) => {
    if (!activeCallRef.current) return;
    if (callId !== undefined && activeCallRef.current.callId !== callId) return;
    cleanup();
  }, [cleanup]);

  return {
    callState,
    activeCallId: activeCallRef.current?.callId ?? null,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    handleCallAccepted,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleRemoteHangup,
  };
}
