"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  canChangeDashboardTheme,
  createBusinessService,
  deleteBusinessService,
  getBusinessSettings,
  getProfile,
  listBusinessServices,
  listBusinessUsers,
  listIntakeForms,
  updateBusinessSettings,
  updateBusinessService,
} from "@/lib/api";
import type {
  BusinessMember,
  BusinessSettings,
  DashboardTheme,
  IntakeFormRecord,
  Service,
  UserProfile,
} from "@/lib/api";
import { buttonClasses } from "@/components/ui/Button";
import { BusinessPageShell } from "@/components/dashboard/BusinessPageShell";
import { useDashboardTheme } from "@/components/DashboardThemeProvider";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

type DayHours = { open: string; close: string; breaks: unknown[] } | null;

function defaultHours(): Record<string, DayHours> {
  const out: Record<string, DayHours> = {};
  for (const d of WEEKDAYS) {
    if (d === "saturday" || d === "sunday") {
      out[d] = null;
    } else {
      out[d] = { open: "09:00", close: "17:00", breaks: [] };
    }
  }
  return out;
}

export default function BusinessSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);

  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [hours, setHours] = useState<Record<string, DayHours>>(defaultHours());
  const [handoffPhone, setHandoffPhone] = useState("");
  const [handoffVoicemailOnly, setHandoffVoicemailOnly] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");

  const [intakeForms, setIntakeForms] = useState<IntakeFormRecord[]>([]);
  const [aiIntakeEnabled, setAiIntakeEnabled] = useState(true);
  const [defaultIntakeFormId, setDefaultIntakeFormId] = useState<number | "">("");
  const [intakeSaving, setIntakeSaving] = useState(false);
  const [intakeMessage, setIntakeMessage] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceDuration, setServiceDuration] = useState(60);
  const [servicePrice, setServicePrice] = useState("");
  const [serviceActive, setServiceActive] = useState(true);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceMessage, setServiceMessage] = useState("");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [members, setMembers] = useState<BusinessMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>("gold");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");

  const { applyTheme, refreshTheme } = useDashboardTheme();

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const s = await getBusinessSettings(businessId);
      setSettings(s);
      setDashboardTheme(s.dashboard_theme === "emerald" ? "emerald" : "gold");
      const h = (s.business_hours || {}) as Record<string, DayHours>;
      setHours({ ...defaultHours(), ...h });
      const av = s.ai_voice_settings;
      setHandoffPhone(av?.handoff_phone ?? "");
      setHandoffVoicemailOnly(av?.handoff_voicemail_only ?? false);
      setAiIntakeEnabled(s.ai_intake_enabled ?? true);
      setDefaultIntakeFormId(s.default_intake_form_id ?? "");
      const forms = await listIntakeForms(businessId).catch(() => [] as IntakeFormRecord[]);
      setIntakeForms(forms);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setSettingsLoading(false);
    }
  }, [businessId]);

  const loadServices = useCallback(async () => {
    setServicesLoading(true);
    setServicesError("");
    try {
      const list = await listBusinessServices(businessId);
      setServices(list);
    } catch (e) {
      setServicesError(e instanceof Error ? e.message : "Failed to load services");
    } finally {
      setServicesLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    loadSettings();
    loadServices();
  }, [businessId, router, loadSettings, loadServices]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, m] = await Promise.all([getProfile(), listBusinessUsers(businessId)]);
        if (!cancelled) {
          setProfile(p);
          setMembers(m);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setMembers([]);
        }
      } finally {
        if (!cancelled) setMembersLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError("");
    try {
      const updated = await updateBusinessSettings(businessId, { business_hours: hours });
      setSettings(updated);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Failed to save hours");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleSaveIntake(e: React.FormEvent) {
    e.preventDefault();
    setIntakeSaving(true);
    setIntakeMessage("");
    try {
      const updated = await updateBusinessSettings(businessId, {
        ai_intake_enabled: aiIntakeEnabled,
        default_intake_form_id:
          defaultIntakeFormId === "" ? null : Number(defaultIntakeFormId),
      });
      setSettings(updated);
      setIntakeMessage("Intake settings saved.");
    } catch (err) {
      setIntakeMessage(err instanceof Error ? err.message : "Failed to save intake settings");
    } finally {
      setIntakeSaving(false);
    }
  }

  async function handleSaveVoice(e: React.FormEvent) {
    e.preventDefault();
    setVoiceSaving(true);
    setVoiceMessage("");
    try {
      const updated = await updateBusinessSettings(businessId, {
        ai_voice_settings: {
          handoff_phone: handoffPhone.trim() || null,
          handoff_voicemail_only: handoffVoicemailOnly,
        },
      });
      setSettings(updated);
      setVoiceMessage("Voice settings saved.");
    } catch (e) {
      setVoiceMessage(e instanceof Error ? e.message : "Failed to save voice settings");
    } finally {
      setVoiceSaving(false);
    }
  }

  async function handleSaveTheme(e: React.FormEvent) {
    e.preventDefault();
    if (!canChangeDashboardTheme(profile, members)) return;
    setThemeSaving(true);
    setThemeMessage("");
    try {
      const updated = await updateBusinessSettings(businessId, { dashboard_theme: dashboardTheme });
      setSettings(updated);
      const saved = updated.dashboard_theme === "emerald" ? "emerald" : "gold";
      applyTheme(saved);
      await refreshTheme();
      setThemeMessage("Appearance saved.");
    } catch (err) {
      setThemeMessage(err instanceof Error ? err.message : "Failed to save appearance");
    } finally {
      setThemeSaving(false);
    }
  }

  const canEditTheme = membersLoaded && canChangeDashboardTheme(profile, members);

  function openAddService() {
    setEditingService(null);
    setServiceName("");
    setServiceDescription("");
    setServiceDuration(60);
    setServicePrice("");
    setServiceActive(true);
    setServiceMessage("");
    setShowServiceForm(true);
  }

  function openEditService(s: Service) {
    setEditingService(s);
    setServiceName(s.name);
    setServiceDescription(s.description ?? "");
    setServiceDuration(s.duration_minutes);
    setServicePrice(s.price != null ? String(s.price) : "");
    setServiceActive(s.is_active);
    setServiceMessage("");
    setShowServiceForm(true);
  }

  function closeServiceForm() {
    setShowServiceForm(false);
    setEditingService(null);
  }

  async function handleSaveService(e: React.FormEvent) {
    e.preventDefault();
    setServiceSaving(true);
    setServiceMessage("");
    try {
      const payload = {
        name: serviceName.trim(),
        description: serviceDescription.trim() || null,
        duration_minutes: serviceDuration,
        price: servicePrice.trim() ? parseFloat(servicePrice) : null,
        is_active: serviceActive,
      };
      if (editingService) {
        await updateBusinessService(businessId, editingService.id, payload);
      } else {
        await createBusinessService(businessId, payload);
      }
      await loadServices();
      closeServiceForm();
    } catch (e) {
      setServiceMessage(e instanceof Error ? e.message : "Failed to save service");
    } finally {
      setServiceSaving(false);
    }
  }

  async function handleDeleteService(serviceId: number) {
    if (!confirm("Delete this service?")) return;
    setServiceSaving(true);
    setServiceMessage("");
    try {
      await deleteBusinessService(businessId, serviceId);
      await loadServices();
      if (editingService?.id === serviceId) closeServiceForm();
    } catch (e) {
      setServiceMessage(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setServiceSaving(false);
    }
  }

  if (settingsLoading && !settings) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading settings…</p>
      </div>
    );
  }

  return (
    <BusinessPageShell
      section="Settings"
      title="Settings"
      description="Hours, voice handoff, services, and intake — edit business details when needed."
    >
      <div className="mb-8 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center">
        <Link href={`/dashboard/${id}/edit`} className={buttonClasses("secondary", "md")}>
          Edit business
        </Link>
      </div>

      <div className="space-y-8">
        {/* Dashboard appearance */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Dashboard appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a color theme for this business dashboard. All team members see the same theme.
          </p>
          {themeMessage && (
            <p
              className={`mt-2 text-sm ${themeMessage.includes("saved") ? "text-primary" : "text-red-600"}`}
            >
              {themeMessage}
            </p>
          )}
          <form onSubmit={handleSaveTheme} className="mt-4 space-y-4">
            <div className="max-w-md">
              <label htmlFor="dashboard_theme" className="mb-1 block text-sm font-medium text-foreground">
                Theme
              </label>
              <select
                id="dashboard_theme"
                name="dashboard_theme"
                value={dashboardTheme}
                disabled={!canEditTheme || !membersLoaded}
                onChange={(e) => setDashboardTheme(e.target.value === "emerald" ? "emerald" : "gold")}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="gold">Gold &amp; blue</option>
                <option value="emerald">Professional emerald</option>
              </select>
            </div>
            {!membersLoaded ? (
              <p className="text-sm text-muted-foreground">Loading permissions…</p>
            ) : !canEditTheme ? (
              <p className="text-sm text-muted-foreground">
                Only business owners and admins can change the dashboard theme.
              </p>
            ) : (
              <button type="submit" className={buttonClasses("primary", "md")} disabled={themeSaving}>
                {themeSaving ? "Saving…" : "Save appearance"}
              </button>
            )}
          </form>
        </div>

        {/* Business hours */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Business hours</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set when you’re open. Leave a day closed to hide it from availability.
          </p>
          {settingsError && (
            <p className="mt-2 text-sm text-red-600">{settingsError}</p>
          )}
          <form onSubmit={handleSaveHours} className="mt-4 space-y-3">
            {WEEKDAYS.map((day) => (
              <div key={day} className="flex flex-wrap items-center gap-2 sm:gap-4">
                <label className="w-24 text-sm font-medium text-foreground sm:w-28">
                  {DAY_LABELS[day]}
                </label>
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={hours[day] !== null}
                    onChange={(e) => {
                      setHours((prev) => ({
                        ...prev,
                        [day]: e.target.checked
                          ? { open: "09:00", close: "17:00", breaks: [] }
                          : null,
                      }));
                    }}
                    className="rounded border-border"
                  />
                  Open
                </label>
                {hours[day] !== null && (
                  <>
                    <input
                      type="time"
                      value={hours[day]!.open}
                      onChange={(e) =>
                        setHours((prev) => ({
                          ...prev,
                          [day]: prev[day]
                            ? { ...prev[day]!, open: e.target.value }
                            : { open: e.target.value, close: "17:00", breaks: [] },
                        }))
                      }
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                      type="time"
                      value={hours[day]!.close}
                      onChange={(e) =>
                        setHours((prev) => ({
                          ...prev,
                          [day]: prev[day]
                            ? { ...prev[day]!, close: e.target.value }
                            : { open: "09:00", close: e.target.value, breaks: [] },
                        }))
                      }
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                  </>
                )}
              </div>
            ))}
            <div className="pt-2">
              <button
                type="submit"
                disabled={settingsSaving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {settingsSaving ? "Saving…" : "Save hours"}
              </button>
            </div>
          </form>
        </div>

        {/* Voice / handoff */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Voice / handoff</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When a caller asks to speak to a person or operator, the AI can transfer to a number or record voicemail.
          </p>
          <form onSubmit={handleSaveVoice} className="mt-4 space-y-4">
            <div>
              <label htmlFor="handoff-phone" className="block text-sm font-medium text-foreground">
                Transfer number (E.164)
              </label>
              <input
                id="handoff-phone"
                type="tel"
                value={handoffPhone}
                onChange={(e) => setHandoffPhone(e.target.value)}
                placeholder="+15551234567"
                className="mt-1 w-full max-w-xs rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave empty to skip transfer and use voicemail only.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="handoff-voicemail-only"
                checked={handoffVoicemailOnly}
                onChange={(e) => setHandoffVoicemailOnly(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="handoff-voicemail-only" className="text-sm text-foreground">
                Voicemail only (do not transfer; record a message instead)
              </label>
            </div>

            {voiceMessage && (
              <p
                className={`text-sm ${voiceMessage.startsWith("Voice") ? "text-emerald-400" : "text-red-400"}`}
              >
                {voiceMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={voiceSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {voiceSaving ? "Saving…" : "Save voice settings"}
            </button>
          </form>
        </div>

        {/* AI customer intake */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">AI customer intake</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a default registration form for chat and voice. Build forms under{" "}
            <Link href={`/dashboard/${id}/intake/forms`} className="text-primary hover:underline">
              Intake forms
            </Link>
            .
          </p>
          <form onSubmit={handleSaveIntake} className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ai-intake-enabled"
                checked={aiIntakeEnabled}
                onChange={(e) => setAiIntakeEnabled(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="ai-intake-enabled" className="text-sm text-foreground">
                Enable AI-guided intake (customers can say &quot;register&quot; or start from chat)
              </label>
            </div>
            <div>
              <label htmlFor="default-intake-form" className="block text-sm font-medium text-foreground">
                Default intake form
              </label>
              <select
                id="default-intake-form"
                value={defaultIntakeFormId === "" ? "" : String(defaultIntakeFormId)}
                onChange={(e) =>
                  setDefaultIntakeFormId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="mt-1 w-full max-w-md rounded-lg border border-border px-3 py-2 text-foreground"
              >
                <option value="">— None —</option>
                {intakeForms.filter((f) => f.is_active).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (id {f.id})
                  </option>
                ))}
              </select>
            </div>
            {intakeMessage && (
              <p
                className={`text-sm ${intakeMessage.endsWith("saved.") ? "text-emerald-600" : "text-red-600"}`}
              >
                {intakeMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={intakeSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {intakeSaving ? "Saving…" : "Save intake settings"}
            </button>
          </form>
        </div>

        {/* Services */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Services</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add services you offer (e.g. Cleaning – 60 min). The AI can use these for scheduling.
          </p>
          {servicesError && (
            <p className="mt-2 text-sm text-red-600">{servicesError}</p>
          )}

          {servicesLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading services…</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {services.length === 0 && !showServiceForm && (
                <li className="text-sm text-muted-foreground">No services yet. Add one below.</li>
              )}
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2"
                >
                  <div>
                    <span className="font-medium text-foreground">{s.name}</span>
                    {s.duration_minutes > 0 && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {s.duration_minutes} min
                      </span>
                    )}
                    {s.price != null && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ${Number(s.price).toFixed(2)}
                      </span>
                    )}
                    {!s.is_active && (
                      <span className="ml-2 text-xs text-amber-600">Inactive</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditService(s)}
                      className="text-sm text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(s.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showServiceForm ? (
            <form onSubmit={handleSaveService} className="mt-4 rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium text-foreground">
                {editingService ? "Edit service" : "Add service"}
              </h3>
              {serviceMessage && (
                <p className="mt-2 text-sm text-red-600">{serviceMessage}</p>
              )}
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground">Name *</label>
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    required
                    maxLength={255}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">Description</label>
                  <input
                    type="text"
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Duration (minutes) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={serviceDuration}
                      onChange={(e) => setServiceDuration(parseInt(e.target.value, 10) || 30)}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">Price (optional)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={servicePrice}
                      onChange={(e) => setServicePrice(e.target.value)}
                      placeholder="0.00"
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="service-active"
                    checked={serviceActive}
                    onChange={(e) => setServiceActive(e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor="service-active" className="text-sm text-foreground">
                    Active (available for booking)
                  </label>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={serviceSaving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {serviceSaving ? "Saving…" : editingService ? "Update" : "Add service"}
                </button>
                <button
                  type="button"
                  onClick={closeServiceForm}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/20"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4">
              <button
                type="button"
                onClick={openAddService}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/20"
              >
                + Add service
              </button>
            </div>
          )}
        </div>
      </div>
    </BusinessPageShell>
  );
}
