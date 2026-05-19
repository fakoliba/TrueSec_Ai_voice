"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  fetchBusiness,
  getBusinessSettings,
  getVoiceOptions,
  previewVoice,
  updateBusinessSettings,
} from "@/lib/api";
import type { Business, BusinessSettings, VoiceOptionsApiResponse, VoicePresetItem } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BusinessPageShell } from "@/components/dashboard/BusinessPageShell";
import { cn } from "@/lib/utils";

export default function BusinessVoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const businessId = Number(id);

  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  const [business, setBusiness] = useState<Business | null>(null);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOptionsApiResponse | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "energetic">("professional");
  const [speed, setSpeed] = useState(1);
  const [expressive, setExpressive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [b, vo, st] = await Promise.all([
        fetchBusiness(businessId),
        getVoiceOptions(businessId),
        getBusinessSettings(businessId),
      ]);
      setBusiness(b);
      setVoiceOptions(vo);
      setSettings(st);

      const av = st.ai_voice_settings;
      const def = av?.voice_profiles?.default;
      setSelectedPresetId(def?.preset_id || vo.selected_preset_id || "openai_professional");
      if (def?.tone) setTone(def.tone);
      if (typeof def?.speed === "number") setSpeed(def.speed);
      if (typeof def?.expressive === "boolean") setExpressive(def.expressive);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    loadAll();
  }, [businessId, router, loadAll]);

  const sampleText = useMemo(() => {
    const tpl =
      voiceOptions?.preview_sample_text ||
      "Hi, thanks for calling {business_name}, how can I help you today?";
    return tpl.replace("{business_name}", business?.name || "our business");
  }, [voiceOptions?.preview_sample_text, business?.name]);

  async function handleSaveVoice() {
    if (!settings) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const prev = settings.ai_voice_settings || {};
      const updated = await updateBusinessSettings(businessId, {
        ai_voice_settings: {
          ...prev,
          voice_profiles: {
            ...prev.voice_profiles,
            default: {
              preset_id: selectedPresetId,
              tone,
              speed,
              expressive,
            },
          },
        },
      });
      setSettings(updated);
      const vo = await getVoiceOptions(businessId);
      setVoiceOptions(vo);
      setSaveMessage("Voice settings saved.");
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestVoice() {
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const res = await previewVoice(businessId, {
        text: sampleText,
        preset_id: selectedPresetId,
        speed,
      });
      const url = `data:${res.media_type};base64,${res.audio_base64}`;
      const audio = new Audio(url);
      await audio.play();
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  const presets: VoicePresetItem[] = voiceOptions?.presets ?? [];

  return (
    <BusinessPageShell
      section="Voice configuration"
      title="Voice configuration"
      description="Choose how your AI sounds on phone calls. Phone routing is configured by your platform admin."
      contentClassName="max-w-3xl"
    >
      <Card className="mb-6">
        <div className="dashboard-hint flex flex-wrap justify-center gap-2 text-sm sm:justify-start">
          <span className={wizardStep === 1 ? "font-semibold text-foreground" : ""}>1. Choose voice</span>
          <span>→</span>
          <span className={wizardStep === 2 ? "font-semibold text-foreground" : ""}>2. Fine-tune & test</span>
        </div>
      </Card>

      {error && <p className="mb-4 text-center text-sm text-red-600 sm:text-left">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          {wizardStep === 1 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground">Choose a voice</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPresetId(p.id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      selectedPresetId === p.id
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground">{p.label}</span>
                      {p.recommended && (
                        <span className="rounded-md bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="dashboard-hint mt-1 text-sm">{p.subtitle}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {p.provider === "elevenlabs" ? "Premium stack" : "Standard"}
                    </p>
                  </button>
                ))}
              </div>

              {!voiceOptions?.can_use_elevenlabs && (
                <p className="dashboard-hint mt-4 text-sm leading-relaxed">
                  Your plan uses OpenAI voices by default. Upgrade to <strong>basic</strong> or{" "}
                  <strong>premium</strong> with ElevenLabs configured on the server for additional premium
                  voices.
                </p>
              )}

              <div className="mt-6">
                <Button type="button" onClick={() => setWizardStep(2)}>
                  Continue
                </Button>
              </div>
            </Card>
          )}

          {wizardStep === 2 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground">Preview &amp; fine-tune</h2>

              <div className="mt-4 rounded-lg border border-border bg-[#f8fafc] p-4">
                <p className="text-sm font-medium text-foreground">Sample script</p>
                <p className="mt-2 text-sm text-foreground">{sampleText}</p>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">Voice style</label>
                  <select
                    value={tone}
                    onChange={(e) =>
                      setTone(e.target.value as "friendly" | "professional" | "energetic")
                    }
                    className="mt-1 w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="friendly">Friendly</option>
                    <option value="professional">Professional</option>
                    <option value="energetic">Energetic</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stored for future routing; preview uses your selected preset above.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Speed: {speed.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={0.75}
                    max={1.35}
                    step={0.05}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="mt-2 w-full max-w-md"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={expressive}
                    onChange={(e) => setExpressive(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">More expressive (saved for later tuning)</span>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button type="button" disabled={previewLoading} onClick={handleTestVoice}>
                  {previewLoading ? "Playing…" : "Test voice"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setWizardStep(1)}>
                  Back
                </Button>
                <Button type="button" disabled={saving} onClick={handleSaveVoice}>
                  {saving ? "Saving…" : "Save voice settings"}
                </Button>
              </div>

              {previewError && <p className="mt-3 text-sm text-red-600">{previewError}</p>}
              {saveMessage && (
                <p
                  className={cn(
                    "mt-3 text-sm",
                    saveMessage.includes("saved") ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {saveMessage}
                </p>
              )}
            </Card>
          )}
        </div>
      )}
    </BusinessPageShell>
  );
}
