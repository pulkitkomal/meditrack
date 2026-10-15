import { useState, useEffect, type ReactNode } from "react";
import { authService, analysisService } from "../../services/api";
import type { User } from "../../types";
import { Button } from "../ui/button";
import TagInput from "../ui/TagInput";
import AccountPrivacyCard from "./AccountPrivacyCard";
import TelegramCard from "./TelegramCard";
import { setThemePreference, useThemePreference, type ThemePreference } from "../../lib/theme";
import { apiErrorMessage } from "./ReadingFormModal";

interface ProfilePageProps {
  user: User;
  onBack: () => void;
  onUpdate: (user: User) => void;
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const CONDITION_SUGGESTIONS = ["Type 2 diabetes", "Type 1 diabetes", "Hypertension", "Heart disease", "Thyroid disorder", "Kidney disease", "Anemia", "Liver disease"];
const ALLERGY_SUGGESTIONS = ["Penicillin", "Sulfa drugs", "Aspirin", "Peanuts", "Shellfish", "Latex"];

const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const timezones: string[] = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [detectedTimezone, "UTC"];

const SectionCard = ({ icon, iconClass, title, subtitle, children }: { icon: string; iconClass: string; title: string; subtitle: string; children: ReactNode }) => (
  <section className="card-premium">
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
    {children}
  </section>
);

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block">
    <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
  </label>
);

const ageFrom = (dob: string) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
};

const ProfileForm = ({ user, onUpdate }: { user: User; onUpdate: (user: User) => void }) => {
  const [form, setForm] = useState({
    gender: user.gender || "",
    date_of_birth: user.date_of_birth || "",
    blood_type: BLOOD_TYPES.includes(user.blood_type || "") ? user.blood_type! : "",
    height: user.height?.toString() || "",
    weight: user.weight?.toString() || "",
    emergency_contact: user.emergency_contact || "",
    glucose_unit: user.glucose_unit === "mmol/L" ? "mmol/L" : "mg/dL",
    dry_weight: user.dry_weight?.toString() || "",
    timezone: user.timezone && user.timezone !== "UTC" ? user.timezone : detectedTimezone,
  });
  const [conditions, setConditions] = useState<string[]>(user.medical_conditions || []);
  const [allergies, setAllergies] = useState<string[]>(user.allergies || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const update: Record<string, unknown> = {
      medical_conditions: conditions,
      allergies,
      glucose_unit: form.glucose_unit,
      timezone: form.timezone,
    };
    if (form.gender) update.gender = form.gender;
    if (form.date_of_birth) update.date_of_birth = form.date_of_birth;
    if (form.blood_type) update.blood_type = form.blood_type;
    if (form.height) update.height = parseFloat(form.height);
    if (form.weight) update.weight = parseFloat(form.weight);
    if (form.dry_weight) update.dry_weight = parseFloat(form.dry_weight);
    if (form.emergency_contact) update.emergency_contact = form.emergency_contact;
    try {
      const res = await authService.updateProfile(update);
      onUpdate(res.data);
      setMessage({ ok: true, text: "Saved." });
    } catch (error: any) {
      const invalidField = error.response?.data?.detail?.[0]?.loc?.slice(-1)[0];
      setMessage({
        ok: false,
        text: invalidField ? `Please check "${String(invalidField).replace(/_/g, " ")}".` : apiErrorMessage(error, "Could not save your profile."),
      });
    } finally {
      setSaving(false);
    }
  };

  const age = ageFrom(form.date_of_birth);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SectionCard
        icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        iconClass="bg-teal-50 text-teal-600"
        title="About you"
        subtitle={`${user.first_name} ${user.last_name} · ${user.email}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Date of birth" hint={age !== null ? `Age ${age}` : undefined}>
              <input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} max={new Date().toISOString().slice(0, 10)} className="input-premium" />
            </Field>
            <Field label="Gender">
              <select value={form.gender} onChange={set("gender")} className="input-premium">
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Blood type">
              <select value={form.blood_type} onChange={set("blood_type")} className="input-premium">
                <option value="">Select blood type</option>
                {BLOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Height (cm)">
              <input type="number" inputMode="decimal" min={1} max={300} step="any" value={form.height} onChange={set("height")} placeholder="e.g., 170" className="input-premium" />
            </Field>
            <Field label="Weight (kg)">
              <input type="number" inputMode="decimal" min={1} max={500} step="any" value={form.weight} onChange={set("weight")} placeholder="e.g., 70" className="input-premium" />
            </Field>
            <Field label="Emergency contact">
              <input value={form.emergency_contact} onChange={set("emergency_contact")} maxLength={200} placeholder="Name and phone number" className="input-premium" />
            </Field>
          </div>
          <TagInput label="Medical conditions" values={conditions} onChange={setConditions} suggestions={CONDITION_SUGGESTIONS} placeholder="e.g., Type 2 diabetes" />
          <TagInput label="Allergies" values={allergies} onChange={setAllergies} suggestions={ALLERGY_SUGGESTIONS} placeholder="e.g., Penicillin" />
        </div>
      </SectionCard>

      <SectionCard
        icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        iconClass="bg-purple-50 text-purple-600"
        title="Tracking preferences"
        subtitle="Used for readings, reminders, and status labels"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Glucose unit">
            <select value={form.glucose_unit} onChange={set("glucose_unit")} className="input-premium">
              <option value="mg/dL">mg/dL</option>
              <option value="mmol/L">mmol/L</option>
            </select>
          </Field>
          <Field label="Dry weight (kg)" hint="Target weight set by your care team">
            <input type="number" inputMode="decimal" min={1} max={500} step="any" value={form.dry_weight} onChange={set("dry_weight")} placeholder="Optional" className="input-premium" />
          </Field>
          <Field label="Timezone" hint={form.timezone !== detectedTimezone ? `This device: ${detectedTimezone}` : "Used for Telegram reminder times"}>
            <select value={form.timezone} onChange={set("timezone")} className="input-premium">
              {(timezones.includes(form.timezone) ? timezones : [form.timezone, ...timezones]).map(tz => (
                <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving} className="flex-1 md:flex-none md:px-10">
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-500"}`}>{message.text}</p>
        )}
      </div>
    </form>
  );
};

const AssistantUsageCard = () => {
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    analysisService.getUsageStats()
      .then(res => setUsage(res.data.chat_today))
      .catch(() => setFailed(true));
  }, []);

  const percent = usage ? Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100)) : 0;

  return (
    <SectionCard
      icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      iconClass="bg-blue-50 text-blue-600"
      title="Health Assistant allowance"
      subtitle="Each account gets a daily allowance for the AI assistant"
    >
      {failed ? (
        <p className="text-sm text-red-500">Could not load your usage.</p>
      ) : !usage ? (
        <div className="skeleton h-12" />
      ) : (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-600">{percent >= 100 ? "Used up for today" : `${100 - percent}% left today`}</span>
            <span className="text-slate-400">Resets over 24 hours</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Assistant allowance used today">
            <div className={`h-full rounded-full ${percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-teal-500"}`} style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
    </SectionCard>
  );
};

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "system", label: "Match device" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const AppearanceCard = () => {
  const preference = useThemePreference();
  return (
    <SectionCard
      icon="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      iconClass="bg-slate-100 text-slate-600"
      title="Appearance"
      subtitle="Choose light or dark mode"
    >
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl max-w-md">
        {THEME_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={preference === option.id}
            onClick={() => setThemePreference(option.id)}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
              preference === option.id ? "bg-surface text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </SectionCard>
  );
};

const ProfilePage = ({ user, onBack, onUpdate }: ProfilePageProps) => (
  <div className="max-w-3xl mx-auto space-y-6">
    <div className="flex items-center gap-2 md:hidden">
      <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-glass" aria-label="Back to home">
        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
    </div>

    <ProfileForm user={user} onUpdate={onUpdate} />
    <AppearanceCard />
    <AssistantUsageCard />
    <TelegramCard />
    <AccountPrivacyCard />
  </div>
);

export default ProfilePage;
