// ── User ──────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string;
  display: string;       // computed: display_name || username
  is_online: boolean;
  avatar: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password2: string;
  display_name?: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ── API errors ────────────────────────────────────────────────────────────────
export interface ApiError {
  [field: string]: string | string[];
}

// ── Call ──────────────────────────────────────────────────────────────────────
export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'accepted'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'rejected'
  | 'missed'
  | 'failed'
  | 'disconnected';

export interface CallRecord {
  id: number;
  caller: User;
  receiver: User;
  call_type: 'audio';   // video branch handles 'video'
  status: CallStatus;
  started_at: string;
  ended_at: string | null;
}

// ── WebSocket Messages ────────────────────────────────────────────────────────
// Messages the frontend receives from the server

export interface WsPresence {
  type: 'presence';
  user_id: number;
  username: string;
  is_online: boolean;
}

export interface WsIncomingCall {
  type: 'incoming_call';
  call_id: number;
  caller_id: number;
  caller_name: string;
  call_type: 'audio';   // video branch handles 'video'
}

export interface WsCallAccepted {
  type: 'call_accepted';
  call_id: number;
  receiver_id: number;
}

export interface WsCallRejected {
  type: 'call_rejected';
  call_id: number;
}

export interface WsCallEnded {
  type: 'call_ended';
  call_id: number;
}

export interface WsOffer {
  type: 'offer';
  sdp: RTCSessionDescriptionInit;
  call_id: number;
  from_id: number;
}

export interface WsAnswer {
  type: 'answer';
  sdp: RTCSessionDescriptionInit;
  call_id: number;
  from_id: number;
}

export interface WsIceCandidate {
  type: 'ice_candidate';
  candidate: RTCIceCandidateInit;
  call_id: number;
  from_id: number;
}

export interface WsError {
  type: 'error';
  message: string;
}

export type WsMessage =
  | WsPresence
  | WsIncomingCall
  | WsCallAccepted
  | WsCallRejected
  | WsCallEnded
  | WsOffer
  | WsAnswer
  | WsIceCandidate
  | WsError;

// ── Active call state (used by useAudioCall) ──────────────────────────────────
export interface ActiveCall {
  callId: number;
  peerId: number;
  peerName: string;
  isCaller: boolean;
  status: CallStatus;
  isMuted: boolean;
}
