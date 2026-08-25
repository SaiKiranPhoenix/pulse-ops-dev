import axios, { AxiosError, type AxiosInstance } from "axios";

const accessTokenStorageKey = "pulseops.accessToken";
export const sessionExpiredEventName = "pulseops:session-expired";

export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000",
  timeout: 10_000,
  headers: {
    "content-type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();

  if (accessToken !== null) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      error instanceof AxiosError &&
      error.response?.status === 401 &&
      getAccessToken() !== null
    ) {
      clearAccessToken();
      window.dispatchEvent(new CustomEvent(sessionExpiredEventName));
    }

    return Promise.reject(error);
  },
);

export function setAccessToken(accessToken: string): void {
  localStorage.setItem(accessTokenStorageKey, accessToken);
}

export function clearAccessToken(): void {
  localStorage.removeItem(accessTokenStorageKey);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(accessTokenStorageKey);
}

export function subscribeToSessionExpired(listener: () => void): () => void {
  window.addEventListener(sessionExpiredEventName, listener);
  return () => {
    window.removeEventListener(sessionExpiredEventName, listener);
  };
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as {
      readonly error?: { readonly code?: string; readonly message?: string };
    };

    if (responseData.error?.code === "DEPENDENCY_UNAVAILABLE") {
      return "A PulseOps service is unavailable. Check the stack health and retry.";
    }

    if (responseData.error?.code === "RATE_LIMITED") {
      return "Too many requests. Wait a moment and retry.";
    }

    return responseData.error?.message ?? "Request failed";
  }

  return "Unexpected request failure";
}
