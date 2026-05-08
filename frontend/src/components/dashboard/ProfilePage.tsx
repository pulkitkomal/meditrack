import { useState, useEffect } from "react";
import { authService, analysisService, telegramService } from "../../services/api";
import type { User } from "../../types";
import { Button } from "../ui/button";

interface ProfilePageProps {
  user: User;
  onBack: () => void;
  onUpdate: (user: User) => void;
}

interface UsageStats {
  total_tokens: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  request_count: number;
}

const InputField = ({ label, name, value, onChange, type = "text", placeholder, options }: any) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    {options ? (
      <select
        name={name}
        value={value}
        onChange={(e: any) => onChange(e)}
        className="input-premium"
      >
        <option value="">{options[0]}</option>
        {options.slice(1).map((opt: string) => (
          <option key={opt} value={opt.toLowerCase().replace(/[^a-z]/g, "_")}>{opt}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e: any) => onChange(e)}
        placeholder={placeholder}
        className="input-premium"
      />
    )}
  </div>
);

const StatBox = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
  <div className="p-4 rounded-xl bg-slate-50">
    <p className="text-sm text-slate-500">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
  </div>
);

const ProfilePage = ({ user, onBack, onUpdate }: ProfilePageProps) => {
  const [formData, setFormData] = useState<Record<string, string>>({
    gender: user.gender || "",
    age: user.age?.toString() || "",
    date_of_birth: user.date_of_birth || "",
    blood_type: user.blood_type || "",
    height: user.height?.toString() || "",
    weight: user.weight?.toString() || "",
    emergency_contact: user.emergency_contact || "",
    medical_conditions: user.medical_conditions?.join(", ") || "",
    allergies: user.allergies?.join(", ") || ""
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  const [telegramConfig, setTelegramConfig] = useState({
    enabled: false,
    connected: false,
    notification_times: ["08:00", "12:00", "18:00", "21:00"] as string[],
    tracking_types: ["glucose", "bp"] as string[]
  });
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");

  useEffect(() => {
    analysisService.getUsageStats()
      .then(res => setUsage(res.data))
      .catch(err => setUsageError(err.response?.status === 401 ? "Please log in again" : "Failed to load"));
  }, []);

  useEffect(() => {
    telegramService.getConfig()
      .then(res => {
        const data = res.data;
        setTelegramConfig({
          enabled: data.enabled,
          connected: data.connected,
          notification_times: data.notification_times?.length > 0 ? data.notification_times : ["08:00", "12:00", "18:00", "21:00"],
          tracking_types: data.tracking_types?.length > 0 ? data.tracking_types : ["glucose", "bp"]
        });
      })
      .catch(console.error);
  }, []);

  const handleTelegramToggle = async () => {
    setTelegramLoading(true);
    setTelegramMessage("");
    try {
      const newEnabled = !telegramConfig.enabled;
      const res = await telegramService.updateConfig({ enabled: newEnabled });
      setTelegramConfig(res.data);
      setTelegramMessage(newEnabled ? "Notifications enabled" : "Notifications disabled");
    } catch (err) {
      setTelegramMessage("Failed to update");
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleTelegramDisconnect = async () => {
    if (!confirm("Disconnect Telegram?")) return;
    setTelegramLoading(true);
    setTelegramMessage("");
    try {
      await telegramService.disconnect();
      setTelegramConfig({ enabled: false, connected: false, notification_times: [], tracking_types: [] });
      setTelegramMessage("Disconnected successfully");
    } catch (err) {
      setTelegramMessage("Failed to disconnect");
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setTelegramLoading(true);
    try {
      const res = await telegramService.generateLink();
      window.open(res.data.url, "_blank");
    } catch (err) {
      setTelegramMessage("Failed to generate link");
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleNotificationTimeChange = async (index: number, value: string) => {
    const newTimes = [...telegramConfig.notification_times];
    newTimes[index] = value;
    setTelegramConfig({ ...telegramConfig, notification_times: newTimes });
    try {
      await telegramService.updateConfig({ notification_times: newTimes });
    } catch (err) {
      console.error("Failed:", err);
    }
  };

  const handleTrackingTypeChange = async (type: string, checked: boolean) => {
    let newTypes = checked 
      ? [...telegramConfig.tracking_types, type] 
      : telegramConfig.tracking_types.filter(t => t !== type);
    setTelegramConfig({ ...telegramConfig, tracking_types: newTypes });
    try {
      await telegramService.updateConfig({ tracking_types: newTypes });
    } catch (err) {
      console.error("Failed:", err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const updateData: Record<string, any> = {};
      if (formData.gender) updateData.gender = formData.gender;
      if (formData.age) updateData.age = parseInt(formData.age);
      if (formData.date_of_birth) updateData.date_of_birth = formData.date_of_birth;
      if (formData.blood_type) updateData.blood_type = formData.blood_type;
      if (formData.height) updateData.height = parseFloat(formData.height);
      if (formData.weight) updateData.weight = parseFloat(formData.weight);
      if (formData.emergency_contact) updateData.emergency_contact = formData.emergency_contact;
      if (formData.medical_conditions) updateData.medical_conditions = formData.medical_conditions.split(",").map(s => s.trim()).filter(Boolean);
      if (formData.allergies) updateData.allergies = formData.allergies.split(",").map(s => s.trim()).filter(Boolean);

      const res = await authService.updateProfile(updateData);
      onUpdate(res.data);
      setMessage("Profile updated successfully!");
    } catch (error) {
      setMessage("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
      </div>

      {/* Personal Info Card */}
      <div className="card-premium">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Personal Information</h2>
            <p className="text-sm text-slate-500">Your health profile details</p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-xl">
          <p className="text-sm text-slate-600">
            <span className="font-medium">Name:</span> {user.first_name} {user.last_name}
          </p>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium">Email:</span> {user.email}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField 
              label="Gender" 
              name="gender" 
              value={formData.gender} 
              onChange={(e: any) => setFormData({ ...formData, gender: e.target.value })}
              options={["Select gender", "Male", "Female", "Other"]}
            />
            <InputField 
              label="Age" 
              name="age" 
              value={formData.age} 
              onChange={handleChange}
              type="number"
              placeholder="Enter your age"
            />
            <InputField 
              label="Date of Birth" 
              name="date_of_birth" 
              value={formData.date_of_birth} 
              onChange={handleChange}
              type="date"
            />
            <InputField 
              label="Blood Type" 
              name="blood_type" 
              value={formData.blood_type} 
              onChange={(e: any) => setFormData({ ...formData, blood_type: e.target.value })}
              options={["Select blood type", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
            />
            <InputField 
              label="Height (cm)" 
              name="height" 
              value={formData.height} 
              onChange={handleChange}
              type="number"
              placeholder="e.g., 170"
            />
            <InputField 
              label="Weight (kg)" 
              name="weight" 
              value={formData.weight} 
              onChange={handleChange}
              type="number"
              placeholder="e.g., 70"
            />
          </div>

          <InputField 
            label="Emergency Contact" 
            name="emergency_contact" 
            value={formData.emergency_contact} 
            onChange={handleChange}
            placeholder="Name and phone number"
          />
          <InputField 
            label="Medical Conditions" 
            name="medical_conditions" 
            value={formData.medical_conditions} 
            onChange={handleChange}
            placeholder="e.g., Diabetes, Hypertension (comma-separated)"
          />
          <InputField 
            label="Allergies" 
            name="allergies" 
            value={formData.allergies} 
            onChange={handleChange}
            placeholder="e.g., Penicillin, Peanuts (comma-separated)"
          />

          {message && (
            <p className={`text-sm ${message.includes("success") ? "text-emerald-600" : "text-red-500"}`}>
              {message}
            </p>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>

      {/* Usage Stats Card */}
      <div className="card-premium">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">API Usage</h2>
            <p className="text-sm text-slate-500">Your AI usage statistics</p>
          </div>
        </div>

        {usageError ? (
          <p className="text-red-500 text-sm">{usageError}</p>
        ) : usage ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label="Total Tokens" value={usage.total_tokens} color="text-purple-600" />
            <StatBox label="Prompt Tokens" value={usage.total_prompt_tokens} color="text-blue-600" />
            <StatBox label="Completion" value={usage.total_completion_tokens} color="text-emerald-600" />
            <StatBox label="Requests" value={usage.request_count} color="text-orange-600" />
          </div>
        ) : (
          <div className="skeleton h-20 rounded-xl"></div>
        )}
      </div>

      {/* Telegram Card */}
      <div className="card-premium">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Telegram Bot</h2>
            <p className="text-sm text-slate-500">Track your health from Telegram</p>
          </div>
        </div>

        <div className="space-y-4">
          {!telegramConfig.connected ? (
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-slate-600 mb-4">
                Connect Telegram to log glucose & blood pressure readings by sending a message or photo. Get automatic reminders.
              </p>
              <Button onClick={handleGenerateLink} disabled={telegramLoading}>
                Connect Telegram
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm font-medium text-emerald-700">Connected to Telegram</span>
                </div>
                <button
                  onClick={handleTelegramToggle}
                  disabled={telegramLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    telegramConfig.enabled ? "bg-teal-600" : "bg-slate-300"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    telegramConfig.enabled ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="font-medium text-slate-700 mb-3">Daily Reminders</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <div key={num}>
                      <label className="block text-xs text-slate-500 mb-1">Time {num}</label>
                      <input
                        type="time"
                        value={telegramConfig.notification_times[num - 1] || ""}
                        onChange={(e) => handleNotificationTimeChange(num - 1, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="font-medium text-slate-700 mb-3">Track</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegramConfig.tracking_types.includes("glucose")}
                      onChange={(e) => handleTrackingTypeChange("glucose", e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-600">Blood Glucose</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegramConfig.tracking_types.includes("bp")}
                      onChange={(e) => handleTrackingTypeChange("bp", e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-600">Blood Pressure</span>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={handleTelegramDisconnect} disabled={telegramLoading} variant="secondary" className="text-red-500 hover:bg-red-50">
                  Disconnect Telegram
                </Button>
              </div>
            </>
          )}

          {telegramMessage && (
            <p className={`text-sm ${telegramMessage.includes("success") || telegramMessage.includes("enabled") || telegramMessage.includes("disabled") || telegramMessage.includes("Connected") ? "text-emerald-600" : "text-red-500"}`}>
              {telegramMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;