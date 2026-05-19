import { getAccessToken } from "@/lib/auth-session";

/** Same-origin /api in dev (Next rewrites to Cloud Run). Set NEXT_PUBLIC_USE_API_PROXY=false to call backend directly. */
const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === "false") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }
  if (
    process.env.NEXT_PUBLIC_USE_API_PROXY === "true" ||
    process.env.NODE_ENV === "development"
  ) {
    return "";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

export function apiUrl(path: string): string {
  const base = getApiUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

async function fetchWithNetworkErrorHandling(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch") {
      throw new Error(
        "Cannot reach the API. Check that the backend is running and CORS allows this origin."
      );
    }
    throw e;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, ...init } = options;
  const url = apiUrl(path);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetchWithNetworkErrorHandling(url, { ...init, headers });
}

export type TokenResponse = { access_token: string; token_type: string };

export type Business = {
  id: number;
  name: string;
  business_type: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  subscription_plan?: string;
  subscription_status?: string;
  created_at?: string;
  updated_at?: string;
};

export type BusinessCreate = {
  name: string;
  business_type?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  timezone?: string;
};

export type BusinessMember = {
  id: number;
  business_id: number;
  user_id: number;
  role: string;
  permissions?: Record<string, unknown> | null;
  created_at: string;
  user_email?: string | null;
  user_full_name?: string | null;
};

export type CalendarIntegration = {
  id: number;
  business_id: number;
  provider: string;
  provider_account_id?: string | null;
  calendar_id?: string | null;
  is_primary: boolean;
  sync_enabled: boolean;
  created_at: string;
};

export type CallLog = {
  id: number;
  business_id: number;
  customer_id?: number | null;
  phone_number: string;
  direction: string;
  status: string;
  duration_seconds: number;
  transcript?: unknown;
  ai_summary?: string | null;
  intent?: string | null;
  recording_url?: string | null;
  twilio_call_sid?: string | null;
  conversation_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: number;
  business_id: number;
  customer_id?: number | null;
  channel: string;
  messages: unknown[];
  intent?: string | null;
  resolved: boolean;
  created_at: string;
  updated_at: string;
};

/** Per-slot voice persona (stored under ai_voice_settings.voice_profiles). */
export type VoiceProfileSlot = {
  preset_id?: string;
  tone?: "friendly" | "professional" | "energetic";
  speed?: number;
  expressive?: boolean;
};

/** AI voice (Twilio): handoff + optional ElevenLabs stack (plan-gated on server). */
export type AiVoiceSettings = {
  handoff_phone?: string | null;
  handoff_voicemail_only?: boolean;
  voice_stack?: "openai" | "elevenlabs";
  elevenlabs_voice_id?: string | null;
  voice_profiles?: {
    default?: VoiceProfileSlot;
    after_hours?: VoiceProfileSlot;
  };
};

/** Human-friendly preset from GET /voice/options. */
export type VoicePresetItem = {
  id: string;
  label: string;
  subtitle: string;
  provider: string;
  recommended: boolean;
};

/** Subscription-aware voice provider options (GET .../voice/options). */
export type VoiceOptionsApiResponse = {
  stack: string;
  subscription_plan: string;
  subscription_active: boolean;
  elevenlabs_configured: boolean;
  can_use_elevenlabs: boolean;
  allowed_voice_ids: string[];
  default_voice_id: string;
  selected_voice_id: string;
  presets: VoicePresetItem[];
  preview_sample_text: string;
  selected_preset_id: string;
};

export type VoicePreviewResponse = {
  audio_base64: string;
  media_type: string;
  provider_used: string;
};

/** Per-business dashboard palette (Settings). */
export type DashboardTheme = "gold" | "emerald";

export type BusinessSettings = {
  id: number;
  business_id: number;
  business_hours: Record<string, { open: string; close: string; breaks?: unknown[] } | null> | null;
  availability_rules?: Record<string, unknown> | null;
  auto_confirm_appointments: boolean;
  require_confirmation: boolean;
  ai_voice_settings?: AiVoiceSettings | null;
  default_intake_form_id?: number | null;
  ai_intake_enabled: boolean;
  /** Present after API migration `007_dashboard_theme`; defaults to gold in UI if missing. */
  dashboard_theme?: DashboardTheme;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: number;
  business_id: number;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  id: number;
  email: string;
  full_name: string | null;
  role: string | null; // super_admin, admin, owner, staff, customer — only admin/owner can create businesses
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** True if the user can create a new business (admin or owner role). */
export function canCreateBusiness(profile: UserProfile | null): boolean {
  return profile?.role != null && ["super_admin", "admin", "owner"].includes(profile.role);
}

/** True if the user can manage platform users (list and set roles). */
export function canManagePlatformUsers(profile: UserProfile | null): boolean {
  return profile?.role != null && ["super_admin", "admin"].includes(profile.role);
}

/** True if the user is a platform super admin (all businesses, onboarding, etc.). */
export function isSuperAdmin(profile: UserProfile | null): boolean {
  return profile?.role === "super_admin";
}

/** True if the user may change dashboard theme (business owner/admin or platform super admin). */
export function canChangeDashboardTheme(
  profile: UserProfile | null,
  members: BusinessMember[],
): boolean {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  return members.some(
    (m) => m.user_id === profile.id && (m.role === "owner" || m.role === "admin"),
  );
}

/** Platform user as returned by GET /api/auth/users (admin only). */
export type PlatformUser = {
  id: number;
  email: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listPlatformUsers(): Promise<PlatformUser[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch("/api/auth/users", { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (res.status === 403) throw new Error("Only platform admins can view users");
  if (!res.ok) throw new Error("Failed to load users");
  return res.json();
}

export async function setPlatformUserRole(userId: number, role: string): Promise<PlatformUser> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/auth/users/${userId}/role`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to update role");
  }
  return res.json();
}

function getToken(): string | null {
  return getAccessToken();
}

/** All businesses (super_admin only). */
export async function listAllPlatformBusinesses(): Promise<Business[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch("/api/platform/businesses", { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (res.status === 403) throw new Error("Only super admins can list all businesses");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load businesses");
  }
  return res.json();
}

export type PlatformOnboardPayload = {
  business_name: string;
  business_type?: string | null;
  email: string;
  phone?: string | null;
  address: string;
  timezone?: string;
  owner_first_name?: string | null;
  owner_last_name?: string | null;
  password: string;
};

export async function onboardPlatformBusiness(payload: PlatformOnboardPayload): Promise<Business> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch("/api/platform/businesses/onboard", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Onboarding failed");
  }
  return res.json();
}

/** Create a platform user (super_admin only). Use role super_admin for another super admin. */
export async function createPlatformUser(payload: {
  email: string;
  full_name?: string | null;
  password: string;
  role: string;
}): Promise<UserProfile> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch("/api/platform/users", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to create user");
  }
  return res.json();
}

export type RegisterPayload = {
  email: string;
  full_name?: string | null;
  password: string;
};

export async function register(payload: RegisterPayload): Promise<UserProfile> {
  const url = apiUrl("/api/auth/register");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: payload.email,
        full_name: payload.full_name || null,
        password: payload.password,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch") {
      throw new Error(
        `Cannot reach the API at ${url}. Check that the backend is running and CORS allows this origin.`
      );
    }
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const form = new URLSearchParams({ username: email, password });
  const url = apiUrl("/api/auth/token");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch") {
      throw new Error(
        `Cannot reach the API at ${url}. Check that the backend is running and CORS allows this origin. ` +
        "If using the deployed app, ensure BACKEND_CORS_ORIGINS includes the frontend URL and redeploy the frontend with NEXT_PUBLIC_API_URL set to the backend URL."
      );
    }
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Login failed");
  }
  return res.json();
}

export async function createBusiness(payload: BusinessCreate): Promise<Business> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  // FastAPI redirects /api/businesses -> /api/businesses/ (307). Avoid redirect for POST.
  const res = await apiFetch("/api/businesses/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to create business");
  }
  return res.json();
}

export async function updateBusiness(id: number, payload: Partial<BusinessCreate>): Promise<Business> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to update business");
  }
  return res.json();
}

export async function deleteBusiness(id: number): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${id}`, { method: "DELETE", token });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to delete business");
  }
}

/** Single business by id (for dashboard headers and voice preview text). */
export async function fetchBusiness(id: number): Promise<Business> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${id}`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load business");
  }
  return res.json();
}

export async function getProfile(): Promise<UserProfile> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch("/api/auth/users/me", { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

export async function updateProfile(payload: {
  email?: string;
  full_name?: string;
}): Promise<UserProfile> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch("/api/auth/users/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to update profile");
  }
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch("/api/auth/change-password", {
    method: "POST",
    token,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to change password");
  }
}

/** Response from forgot-password: may include reset_token so user can be redirected to reset page. */
export type ForgotPasswordResponse = {
  message: string;
  reset_token?: string;
};

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const res = await fetch(apiUrl("/api/auth/forgot-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Request failed");
  }
  return res.json();
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch(apiUrl("/api/auth/reset-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to reset password");
  }
}

export async function listBusinessCallLogs(
  businessId: number,
  params?: { skip?: number; limit?: number },
): Promise<CallLog[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const search = new URLSearchParams();
  if (params?.skip != null) search.set("skip", String(params.skip));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const q = search.toString();
  const path = `/api/businesses/${businessId}/call-logs${q ? `?${q}` : ""}`;
  const res = await apiFetch(path, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load call logs");
  }
  return res.json();
}

export async function listBusinessConversations(
  businessId: number,
  params?: { skip?: number; limit?: number },
): Promise<Conversation[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const search = new URLSearchParams();
  if (params?.skip != null) search.set("skip", String(params.skip));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const q = search.toString();
  const path = `/api/businesses/${businessId}/conversations${q ? `?${q}` : ""}`;
  const res = await apiFetch(path, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load conversations");
  }
  return res.json();
}

/** Single conversation with full message history (read-only transcript view). */
export async function getBusinessConversation(
  businessId: number,
  conversationId: number,
): Promise<Conversation> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/conversations/${conversationId}`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load conversation");
  }
  return res.json();
}

export type LatencySample = {
  duration_ms: number;
  path: string;
  method: string;
  status_code: number;
  business_id: number | null;
  ts: number;
};

export type LatencyMetrics = {
  samples: LatencySample[];
  count: number;
  avg_ms: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
};

/** Recent API request durations for this business (backend middleware; in-memory). */
export async function getBusinessLatencyMetrics(
  businessId: number,
  params?: { limit?: number },
): Promise<LatencyMetrics> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  const q = search.toString();
  const path = `/api/businesses/${businessId}/metrics/latency${q ? `?${q}` : ""}`;
  const res = await apiFetch(path, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load latency metrics");
  }
  return res.json();
}

export async function listBusinessCalendars(businessId: number): Promise<CalendarIntegration[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/calendars`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load calendars");
  }
  return res.json();
}

/** Events from the business primary calendar (Google / Outlook). Requires a connected integration. */
export async function listBusinessCalendarEvents(
  businessId: number,
  options?: { timeMin?: string; timeMax?: string; maxResults?: number },
): Promise<unknown[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const params = new URLSearchParams();
  if (options?.timeMin) params.set("time_min", options.timeMin);
  if (options?.timeMax) params.set("time_max", options.timeMax);
  if (options?.maxResults != null) params.set("max_results", String(options.maxResults));
  const qs = params.toString();
  const res = await apiFetch(
    `/api/businesses/${businessId}/calendars/events${qs ? `?${qs}` : ""}`,
    { token },
  );
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load calendar events");
  }
  return res.json();
}

/** Returns the OAuth URL to redirect the user to connect Google Calendar. */
export async function getGoogleCalendarConnectUrl(businessId: number): Promise<{ authorization_url: string }> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/calendars/google/connect`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to get Google Calendar connect URL");
  }
  return res.json();
}

/** Returns the Twilio voice webhook URL for this business (for "A Call Comes In" configuration). */
export async function getVoiceWebhookUrl(businessId: number): Promise<{ webhook_url: string }> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/voice/webhook-url`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) throw new Error("Failed to get voice webhook URL");
  return res.json();
}

export async function getVoiceOptions(businessId: number): Promise<VoiceOptionsApiResponse> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/voice/options`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load voice options");
  }
  return res.json();
}

/** TTS preview for voice settings (short sample; rate-limited on server). */
export async function previewVoice(
  businessId: number,
  payload: { text?: string; preset_id?: string; speed?: number },
): Promise<VoicePreviewResponse> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/voice/preview`, {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (res.status === 429) throw new Error("Too many previews. Try again in a minute.");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Preview failed");
  }
  return res.json();
}

/** Returns the OAuth URL to redirect the user to connect Outlook calendar. */
export async function getOutlookCalendarConnectUrl(businessId: number): Promise<{ authorization_url: string }> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/calendars/outlook/connect`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to get Outlook calendar connect URL");
  }
  return res.json();
}

export async function getBusinessSettings(businessId: number): Promise<BusinessSettings> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/settings`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load settings");
  }
  return res.json();
}

export type BusinessSettingsUpdate = Partial<{
  business_hours: BusinessSettings["business_hours"];
  availability_rules: BusinessSettings["availability_rules"];
  auto_confirm_appointments: boolean;
  require_confirmation: boolean;
  ai_voice_settings: AiVoiceSettings | null;
  default_intake_form_id: number | null;
  ai_intake_enabled: boolean;
  dashboard_theme: DashboardTheme;
}>;

export async function updateBusinessSettings(
  businessId: number,
  payload: BusinessSettingsUpdate,
): Promise<BusinessSettings> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    token,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to update settings");
  }
  return res.json();
}

export async function listBusinessServices(businessId: number): Promise<Service[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/services`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load services");
  }
  return res.json();
}

export type ServiceCreatePayload = {
  name: string;
  description?: string | null;
  duration_minutes: number;
  price?: number | null;
  is_active?: boolean;
};

export async function createBusinessService(
  businessId: number,
  payload: ServiceCreatePayload,
): Promise<Service> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    token,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to create service");
  }
  return res.json();
}

export type ServiceUpdatePayload = Partial<ServiceCreatePayload> & { is_active?: boolean };

export async function updateBusinessService(
  businessId: number,
  serviceId: number,
  payload: ServiceUpdatePayload,
): Promise<Service> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/services/${serviceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    token,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to update service");
  }
  return res.json();
}

export async function deleteBusinessService(businessId: number, serviceId: number): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/services/${serviceId}`, {
    method: "DELETE",
    token,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to delete service");
  }
}

/** Business customer directory (CRM) — used for voice phone match & imports. */
export type BusinessCustomer = {
  id: number;
  business_id: number;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerImportResult = {
  created: number;
  updated: number;
  row_errors: { line?: string; message?: string }[];
};

export async function listBusinessCustomers(businessId: number): Promise<BusinessCustomer[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/customers`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load customers");
  }
  return res.json();
}

export type CustomerCreatePayload = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
};

export async function createBusinessCustomer(
  businessId: number,
  payload: CustomerCreatePayload,
): Promise<BusinessCustomer> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/customers`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to create customer");
  }
  return res.json();
}

export async function importBusinessCustomersCsv(
  businessId: number,
  file: File,
): Promise<CustomerImportResult> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const url = apiUrl(`/api/businesses/${businessId}/customers/import`);
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Import failed");
  }
  return res.json();
}

export async function deleteBusinessCustomer(businessId: number, customerId: number): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/customers/${customerId}`, {
    method: "DELETE",
    token,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to delete");
  }
}

export async function listBusinessUsers(businessId: number): Promise<BusinessMember[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/users`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load business members");
  }
  return res.json();
}

export type AddBusinessUserPayload = {
  email: string;
  role?: string;
  permissions?: Record<string, unknown> | null;
  /** If the user does not exist, provide these to create a new account and add to the business. */
  full_name?: string | null;
  password?: string | null;
};

export async function addBusinessUser(
  businessId: number,
  payload: AddBusinessUserPayload,
): Promise<BusinessMember> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/users`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to add user to business");
  }
  return res.json();
}

/** One field in an intake form (matches backend IntakeQuestion). */
export type IntakeQuestion = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string | null;
  options?: string[] | null;
  default?: unknown;
};

/** Intake form builder (questions JSON array). */
export type IntakeFormRecord = {
  id: number;
  business_id: number;
  name: string;
  form_type?: string | null;
  questions: IntakeQuestion[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type IntakeSubmissionRecord = {
  id: number;
  business_id: number;
  customer_id?: number | null;
  intake_form_id: number;
  responses: Record<string, unknown>;
  status: string;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
};

export type IntakeSubmissionWithFormName = IntakeSubmissionRecord & { form_name?: string | null };

export async function listIntakeForms(businessId: number): Promise<IntakeFormRecord[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/intake/forms`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load intake forms");
  }
  return res.json();
}

export async function getIntakeForm(businessId: number, formId: number): Promise<IntakeFormRecord> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/intake/forms/${formId}`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load form");
  }
  return res.json();
}

export type IntakeFormCreatePayload = {
  name: string;
  form_type?: string | null;
  questions: IntakeQuestion[] | Record<string, unknown>[];
  is_active?: boolean;
};

export async function createIntakeForm(
  businessId: number,
  payload: IntakeFormCreatePayload,
): Promise<IntakeFormRecord> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/intake/forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    token,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to create form");
  }
  return res.json();
}

export async function updateIntakeForm(
  businessId: number,
  formId: number,
  payload: Partial<IntakeFormCreatePayload>,
): Promise<IntakeFormRecord> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/intake/forms/${formId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    token,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to update form");
  }
  return res.json();
}

export async function deleteIntakeForm(businessId: number, formId: number): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(`/api/businesses/${businessId}/intake/forms/${formId}`, {
    method: "DELETE",
    token,
  });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to delete form");
  }
}

export async function listIntakeSubmissions(
  businessId: number,
  params?: { status?: string; form_id?: number },
): Promise<IntakeSubmissionWithFormName[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const search = new URLSearchParams();
  if (params?.status) search.set("status_filter", params.status);
  if (params?.form_id != null) search.set("form_id", String(params.form_id));
  const q = search.toString();
  const res = await apiFetch(`/api/businesses/${businessId}/intake/submissions${q ? `?${q}` : ""}`, { token });
  if (res.status === 401) throw new Error("Not authenticated");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || "Failed to load submissions");
  }
  return res.json();
}
