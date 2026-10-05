import api from './axiosInstance';
import type { AuthResponse, AuthTokens, LoginPayload, RegisterPayload, User } from '../types';

// Register a new user
export const register = (payload: RegisterPayload): Promise<AuthResponse> =>
  api.post<AuthResponse>('/auth/register/', payload).then((r) => r.data);

// Login — returns access + refresh tokens and user object
export const login = (payload: LoginPayload): Promise<AuthTokens & { user?: User }> =>
  api.post<AuthTokens>('/auth/login/', payload).then((r) => r.data);

// Logout — blacklists the refresh token on the server
export const logout = (refresh: string): Promise<void> =>
  api.post('/auth/logout/', { refresh }).then(() => undefined);

// Get currently logged-in user's profile
export const getMe = (): Promise<User> =>
  api.get<User>('/auth/me/').then((r) => r.data);

// Get all other users (for the call list)
export const getUsers = (): Promise<User[]> =>
  api.get<User[]>('/users/').then((r) => r.data);
