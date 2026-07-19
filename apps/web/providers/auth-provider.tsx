'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { authApi, type LoginRequest, type RegisterRequest } from '../lib/api/auth-api';
import { ApiRequestError } from '../lib/api/types';

export type AuthStatus =
  'loading' | 'authenticated' | 'unauthenticated' | 'refreshing' | 'expired' | 'error';

interface AuthState {
  readonly status: AuthStatus;
  readonly accessToken: string | null;
  readonly error: string | null;
}

interface AuthContextValue extends AuthState {
  readonly isAuthenticated: boolean;
  register(input: RegisterRequest): Promise<void>;
  login(input: LoginRequest): Promise<void>;
  refresh(): Promise<boolean>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [state, setState] = React.useState<AuthState>({
    status: 'loading',
    accessToken: null,
    error: null,
  });

  const applyAccessToken = React.useCallback((accessToken: string) => {
    setState({ status: 'authenticated', accessToken, error: null });
  }, []);

  const refresh = React.useCallback(async () => {
    setState((current) => ({
      ...current,
      status: current.accessToken ? 'refreshing' : 'loading',
      error: null,
    }));

    try {
      const response = await authApi.refresh();
      applyAccessToken(response.accessToken);
      return true;
    } catch (error) {
      setState({
        status: error instanceof ApiRequestError ? 'expired' : 'error',
        accessToken: null,
        error: error instanceof Error ? error.message : 'Session refresh failed.',
      });
      return false;
    }
  }, [applyAccessToken]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.status === 'authenticated' && Boolean(state.accessToken),
      async register(input) {
        const response = await authApi.register(input);
        applyAccessToken(response.accessToken);
      },
      async login(input) {
        const response = await authApi.login(input);
        applyAccessToken(response.accessToken);
      },
      refresh,
      async logout() {
        await authApi.logout(state.accessToken);
        setState({ status: 'unauthenticated', accessToken: null, error: null });
        router.push('/login');
      },
      async logoutAll() {
        await authApi.logoutAll(state.accessToken);
        setState({ status: 'unauthenticated', accessToken: null, error: null });
        router.push('/login');
      },
    }),
    [applyAccessToken, refresh, router, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
