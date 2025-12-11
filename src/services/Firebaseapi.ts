
import { getAuthToken } from "./authToken"; 

const API_BASE = import.meta.env.VITE_API_URL

type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

interface ApiOptions<TBody = unknown> {
  method?: ApiMethod; 
  body?: TBody;
  tokenOverride?: string;
}

async function apiFetch<TResponse, TBody = unknown>(
  path: string,
  options: ApiOptions<TBody> = {}
): Promise<TResponse> {
  const { method = "GET", body, tokenOverride } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = tokenOverride ?? getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson =
    response.headers.get("content-type")?.includes("application/json") ?? false;

  if (!response.ok) {
    const errorPayload = isJson ? await response.json().catch(() => null) : null;
    const message =
      errorPayload?.message ||
      errorPayload?.error ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204 || !isJson) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export interface Meeting {
  id: string;
  ownerId: string;
  title: string;
  date: string
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingPayload {
  title: string;
}

export const createMeeting = (payload: CreateMeetingPayload) =>
  apiFetch<{ message: string; meeting: Meeting }>("/meetings", {
    method: "POST",
    body: payload,
  });

export const listMeetings = () => apiFetch<Meeting[]>("/meetings");

export const getMeeting = (id: string) =>
  apiFetch<Meeting>(`/meetings/${id}`);

export const updateMeeting = (id: string, data: Partial<Meeting>) =>
  apiFetch<{ message: string }>(`/meetings/${id}`, {
    method: "PUT",
    body: data,
  });

export const deleteMeetingApi = (id: string) =>
  apiFetch<{ message: string }>(`/meetings/${id}`, { method: "DELETE" });

export { API_BASE };
