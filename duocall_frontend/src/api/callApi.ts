import api from './axiosInstance';
import type { CallRecord } from '../types';

/** POST /api/calls/ — create a new audio call record, returns call with id */
export const createCall = async (receiverId: number): Promise<CallRecord> => {
  console.log('[callApi] createCall → receiver:', receiverId);
  try {
    const r = await api.post<CallRecord>('/calls/', { receiver: receiverId });
    console.log('[callApi] createCall ✓ id:', r.data.id);
    return r.data;
  } catch (err: unknown) {
    const e = err as { response?: { status: number; data: unknown } };
    console.error('[callApi] createCall ✗ status:', e.response?.status, 'data:', JSON.stringify(e.response?.data));
    throw err;
  }
};

/** POST /api/calls/<id>/action/ */
export const callAction = async (
  callId: number,
  action: 'accept' | 'reject' | 'end' | 'ringing',
): Promise<CallRecord> => {
  console.log('[callApi] callAction → callId:', callId, 'action:', action);
  try {
    const r = await api.post<CallRecord>(`/calls/${callId}/action/`, { action });
    console.log('[callApi] callAction ✓ status:', r.data.status);
    return r.data;
  } catch (err: unknown) {
    const e = err as { response?: { status: number; data: unknown } };
    console.error('[callApi] callAction ✗ status:', e.response?.status, 'data:', JSON.stringify(e.response?.data));
    throw err;
  }
};
