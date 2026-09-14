/// <reference types="vite/client" />

interface Window {
  __PULSEOPS_CONFIG__?: {
    readonly apiBaseUrl?: string;
    readonly realtimeUrl?: string;
  };
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_REALTIME_URL?: string;
  readonly VITE_SOCKET_URL?: string;
}
