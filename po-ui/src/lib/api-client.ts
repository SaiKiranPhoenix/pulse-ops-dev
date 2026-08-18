import axios, { AxiosError, type AxiosInstance } from "axios";

const accessTokenStorageKey = "pulseops.accessToken";

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

export function setAccessToken(accessToken: string): void {
  localStorage.setItem(accessTokenStorageKey, accessToken);
}

export function clearAccessToken(): void {
  localStorage.removeItem(accessTokenStorageKey);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(accessTokenStorageKey);
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as { readonly error?: { readonly message?: string } };
    return responseData.error?.message ?? "Request failed";
  }

  return "Unexpected request failure";
}
