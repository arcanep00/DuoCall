import { useEffect, useRef, useCallback } from 'react';
import type { WsMessage } from '../types';

const WS_BASE       = 'ws://127.0.0.1:8000/ws/signaling/';
const MAX_RETRIES   = 5;
const BASE_DELAY_MS = 2000;

interface UseWebSocketOptions {
  onMessage: (msg: WsMessage) => void;
  enabled: boolean;
}

export function useWebSocket({ onMessage, enabled }: UseWebSocketOptions) {
  const wsRef        = useRef<WebSocket | null>(null);
  const retriesRef   = useRef(0);
  const mountedRef   = useRef(false);
  const onMessageRef = useRef(onMessage);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const disconnect = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose   = null;
      wsRef.current.onopen    = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror   = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close(1000, 'intentional');
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Already open or connecting — do nothing
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
       wsRef.current.readyState === WebSocket.CONNECTING)
    ) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('[WS] No token — skipping connect.');
      return;
    }

    console.log(`[WS] Connecting (attempt ${retriesRef.current + 1})…`);
    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(1000, 'unmounted'); return; }
      console.log('[WS] Connected ✓');
      retriesRef.current = 0;
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string) as WsMessage;
        onMessageRef.current(msg);
      } catch {
        console.error('[WS] Bad JSON:', ev.data);
      }
    };

    ws.onerror = () => {
      console.error('[WS] Error on socket.');
    };

    ws.onclose = (ev) => {
      wsRef.current = null;
      console.log(`[WS] Closed — code=${ev.code} reason="${ev.reason}"`);

      // Don't reconnect on intentional or auth-rejected closes
      if (!mountedRef.current) return;
      if (ev.code === 1000 || ev.code === 4001) return;

      if (retriesRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** retriesRef.current;
        retriesRef.current += 1;
        console.log(`[WS] Retry in ${delay}ms…`);
        timerRef.current = setTimeout(connect, delay);
      } else {
        console.error('[WS] Max retries reached.');
      }
    };
  }, [disconnect]);

  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;
    retriesRef.current = 0;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  const sendMessage = useCallback((data: object): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    console.warn('[WS] Not open — dropped:', data);
    return false;
  }, []);

  return { sendMessage };
}
