"""
SignalingConsumer
=================
Each logged-in user connects to ws://host/ws/signaling/
This consumer handles:
  - Presence  : marks user online/offline, broadcasts to all others
  - Call flow : call_offer → call_ringing → call_accepted/rejected → call_ended
  - WebRTC    : forwards offer, answer, ice_candidate between the two peers
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone

logger = logging.getLogger(__name__)
User = get_user_model()


# ── helpers ──────────────────────────────────────────────────────────────────

def user_group(user_id: int) -> str:
    """Each user has their own channel group so we can push to them directly."""
    return f"user_{user_id}"


def broadcast_group() -> str:
    """All connected users belong to this group for presence broadcasts."""
    return "broadcast_all"


# ── consumer ─────────────────────────────────────────────────────────────────

class SignalingConsumer(AsyncWebsocketConsumer):

    # ── connect / disconnect ─────────────────────────────────────────────────

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user = user
        self.user_id = user.id

        # Join personal group + broadcast group
        await self.channel_layer.group_add(user_group(self.user_id), self.channel_name)
        await self.channel_layer.group_add(broadcast_group(), self.channel_name)

        await self.accept()

        # Mark online in DB and tell everyone
        await self._set_online(True)
        await self._broadcast_presence(online=True)

        logger.info("WS connected: user=%s", self.user.username)

    async def disconnect(self, close_code):
        if not hasattr(self, "user"):
            return

        await self._set_online(False)
        await self._broadcast_presence(online=False)

        await self.channel_layer.group_discard(user_group(self.user_id), self.channel_name)
        await self.channel_layer.group_discard(broadcast_group(), self.channel_name)

        logger.info("WS disconnected: user=%s code=%s", self.user.username, close_code)

    # ── incoming messages from the browser ──────────────────────────────────

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            await self._send_error("Invalid JSON")
            return

        msg_type = data.get("type")
        handlers = {
            # Call lifecycle
            "call_offer":    self._handle_call_offer,
            "call_accepted": self._handle_call_accepted,
            "call_rejected": self._handle_call_rejected,
            "call_ended":    self._handle_call_ended,
            # WebRTC negotiation
            "offer":         self._handle_webrtc_offer,
            "answer":        self._handle_webrtc_answer,
            "ice_candidate": self._handle_ice_candidate,
        }
        handler = handlers.get(msg_type)
        if handler:
            await handler(data)
        else:
            await self._send_error(f"Unknown message type: {msg_type}")

    # ── call lifecycle handlers ──────────────────────────────────────────────

    async def _handle_call_offer(self, data: dict):
        """
        Browser sends: { type: "call_offer", receiver_id: <int>, call_id: <int> }
        We forward an incoming_call notification to the receiver.
        """
        receiver_id = data.get("receiver_id")
        call_id     = data.get("call_id")

        if not receiver_id or not call_id:
            await self._send_error("call_offer requires receiver_id and call_id")
            return

        # Check receiver exists and is online
        receiver = await self._get_user(receiver_id)
        if not receiver:
            await self._send_error("Receiver not found")
            return

        await self.channel_layer.group_send(
            user_group(receiver_id),
            {
                "type":        "ws_incoming_call",
                "call_id":     call_id,
                "caller_id":   self.user_id,
                "caller_name": self.user.display,
                "call_type":   "audio",
            },
        )
        logger.debug("call_offer: %s → %s (call %s)", self.user_id, receiver_id, call_id)

    async def _handle_call_accepted(self, data: dict):
        """
        Receiver accepted. Tell the caller to start WebRTC.
        { type: "call_accepted", caller_id: <int>, call_id: <int> }
        """
        caller_id = data.get("caller_id")
        call_id   = data.get("call_id")

        await self._update_call_status(call_id, "accepted")

        await self.channel_layer.group_send(
            user_group(caller_id),
            {
                "type":        "ws_call_accepted",
                "call_id":     call_id,
                "receiver_id": self.user_id,
            },
        )

    async def _handle_call_rejected(self, data: dict):
        """
        Receiver rejected. Tell the caller.
        { type: "call_rejected", caller_id: <int>, call_id: <int> }
        """
        caller_id = data.get("caller_id")
        call_id   = data.get("call_id")

        await self._update_call_status(call_id, "rejected")

        await self.channel_layer.group_send(
            user_group(caller_id),
            {
                "type":    "ws_call_rejected",
                "call_id": call_id,
            },
        )

    async def _handle_call_ended(self, data: dict):
        """
        Either party ended the call.
        { type: "call_ended", peer_id: <int>, call_id: <int> }
        """
        peer_id = data.get("peer_id")
        call_id = data.get("call_id")

        await self._end_call(call_id, ended_by_id=self.user_id)

        await self.channel_layer.group_send(
            user_group(peer_id),
            {
                "type":    "ws_call_ended",
                "call_id": call_id,
            },
        )

    # ── WebRTC negotiation handlers ──────────────────────────────────────────

    async def _handle_webrtc_offer(self, data: dict):
        """
        Caller sends SDP offer to receiver.
        { type: "offer", target_id: <int>, sdp: <object>, call_id: <int> }
        """
        await self._relay_to_peer(data, "ws_webrtc_offer")

    async def _handle_webrtc_answer(self, data: dict):
        """
        Receiver sends SDP answer back to caller.
        { type: "answer", target_id: <int>, sdp: <object>, call_id: <int> }
        """
        await self._relay_to_peer(data, "ws_webrtc_answer")

    async def _handle_ice_candidate(self, data: dict):
        """
        Either side sends an ICE candidate to the other.
        { type: "ice_candidate", target_id: <int>, candidate: <object>, call_id: <int> }
        """
        await self._relay_to_peer(data, "ws_ice_candidate")

    # ── channel layer event handlers (messages FROM other consumers) ─────────
    # Each method name maps to the "type" field in group_send calls above.
    # Django Channels converts "ws_incoming_call" → method "ws_incoming_call".

    async def ws_incoming_call(self, event: dict):
        await self._send_json({
            "type":        "incoming_call",
            "call_id":     event["call_id"],
            "caller_id":   event["caller_id"],
            "caller_name": event["caller_name"],
            "call_type":   event["call_type"],
        })

    async def ws_call_accepted(self, event: dict):
        await self._send_json({
            "type":        "call_accepted",
            "call_id":     event["call_id"],
            "receiver_id": event["receiver_id"],
        })

    async def ws_call_rejected(self, event: dict):
        await self._send_json({
            "type":    "call_rejected",
            "call_id": event["call_id"],
        })

    async def ws_call_ended(self, event: dict):
        await self._send_json({
            "type":    "call_ended",
            "call_id": event["call_id"],
        })

    async def ws_webrtc_offer(self, event: dict):
        await self._send_json({
            "type":    "offer",
            "sdp":     event["sdp"],
            "call_id": event["call_id"],
            "from_id": event["from_id"],
        })

    async def ws_webrtc_answer(self, event: dict):
        await self._send_json({
            "type":    "answer",
            "sdp":     event["sdp"],
            "call_id": event["call_id"],
            "from_id": event["from_id"],
        })

    async def ws_ice_candidate(self, event: dict):
        await self._send_json({
            "type":      "ice_candidate",
            "candidate": event["candidate"],
            "call_id":   event["call_id"],
            "from_id":   event["from_id"],
        })

    async def ws_presence(self, event: dict):
        """Broadcast presence update to everyone."""
        await self._send_json({
            "type":      "presence",
            "user_id":   event["user_id"],
            "username":  event["username"],
            "is_online": event["is_online"],
        })

    # ── private helpers ──────────────────────────────────────────────────────

    async def _relay_to_peer(self, data: dict, event_type: str):
        """Forward a WebRTC negotiation message to target_id."""
        target_id = data.get("target_id")
        if not target_id:
            await self._send_error(f"{event_type} requires target_id")
            return

        payload = {
            "type":    event_type,
            "call_id": data.get("call_id"),
            "from_id": self.user_id,
        }
        # Attach the right payload key per message type
        if "sdp" in data:
            payload["sdp"] = data["sdp"]
        if "candidate" in data:
            payload["candidate"] = data["candidate"]

        await self.channel_layer.group_send(user_group(target_id), payload)

    async def _send_json(self, data: dict):
        await self.send(text_data=json.dumps(data))

    async def _send_error(self, msg: str):
        await self._send_json({"type": "error", "message": msg})

    async def _broadcast_presence(self, online: bool):
        await self.channel_layer.group_send(
            broadcast_group(),
            {
                "type":      "ws_presence",
                "user_id":   self.user_id,
                "username":  self.user.username,
                "is_online": online,
            },
        )

    # ── DB helpers (run in thread pool) ─────────────────────────────────────

    @database_sync_to_async
    def _set_online(self, online: bool):
        User.objects.filter(pk=self.user_id).update(is_online=online)

    @database_sync_to_async
    def _get_user(self, user_id: int):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def _update_call_status(self, call_id: int, status: str):
        from .models import Call
        Call.objects.filter(pk=call_id).update(status=status)

    @database_sync_to_async
    def _end_call(self, call_id: int, ended_by_id: int):
        from .models import Call
        Call.objects.filter(pk=call_id).update(
            status="ended",
            ended_at=timezone.now(),
            ended_by_id=ended_by_id,
        )
