import { useState, useEffect } from "react";
import { authService, analysisService, telegramService } from "../../services/api";
import type { User } from "../../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

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
    console.log("[Profile] Fetching usage stats...");
    const token = localStorage.getItem("token");
    console.log("[Profile] Token exists:", !!token);
    
    analysisService.getUsageStats()
      .then(res => {
        console.log("[Profile] Usage stats:", res.data);
        setUsage(res.data);
        setUsageError(null);
      })
      .catch(err => {
        console.error("[Profile] Usage stats error:", err);
        setUsageError(err.response?.status === 401 ? "Please log in again" : "Failed to load usage");
      });
  }, []);

  useEffect(() => {
    telegramService.getConfig()
      .then(res => {
        const data = res.data;
        setTelegramConfig({
          enabled: data.enabled,
          connected: data.connected,
          notification_times: data.notification_times?.length > 0 
            ? data.notification_times 
            : ["08:00", "12:00", "18:00", "21:00"],
          tracking_types: data.tracking_types?.length > 0 
            ? data.tracking_types 
            : ["glucose", "bp"]
        });
      })
      .catch(err => {
        console.error("Failed to load telegram config:", err);
      });
  }, []);

  const handleTelegramToggle = async () => {
    setTelegramLoading(true);
    setTelegramMessage("");
    try {
      const newEnabled = !telegramConfig.enabled;
      const res = await telegramService.updateConfig({ enabled: newEnabled });
      setTelegramConfig(res.data);
      setTelegramMessage(newEnabled ? "Telegram notifications enabled" : "Telegram notifications disabled");
    } catch (err) {
      setTelegramMessage("Failed to update Telegram settings");
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleTelegramDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Telegram?")) return;
    setTelegramLoading(true);
    setTelegramMessage("");
    try {
      await telegramService.disconnect();
      setTelegramConfig({ enabled: false, connected: false, notification_times: [], tracking_types: [] });
      setTelegramMessage("Telegram disconnected successfully");
    } catch (err) {
      setTelegramMessage("Failed to disconnect Telegram");
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
      console.error("Failed to update notification times:", err);
    }
  };

  const handleTrackingTypeChange = async (type: string, checked: boolean) => {
    let newTypes: string[];
    if (checked) {
      newTypes = [...telegramConfig.tracking_types, type];
    } else {
      newTypes = telegramConfig.tracking_types.filter(t => t !== type);
    }
    setTelegramConfig({ ...telegramConfig, tracking_types: newTypes });
    
    try {
      await telegramService.updateConfig({ tracking_types: newTypes });
    } catch (err) {
      console.error("Failed to update tracking types:", err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value as string });
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
      setMessage("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-blue-50 rounded-lg">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Profile Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Name:</span> {user.first_name} {user.last_name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Email:</span> {user.email}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <Input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  placeholder="Enter your age"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <Input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                <select
                  name="blood_type"
                  value={formData.blood_type}
                  onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                <Input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleChange}
                  placeholder="e.g., 170"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <Input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  placeholder="e.g., 70"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
              <Input
                type="text"
                name="emergency_contact"
                value={formData.emergency_contact}
                onChange={handleChange}
                placeholder="Name and phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Conditions</label>
              <Input
                type="text"
                name="medical_conditions"
                value={formData.medical_conditions}
                onChange={handleChange}
                placeholder="e.g., Diabetes, Hypertension (comma-separated)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
              <Input
                type="text"
                name="allergies"
                value={formData.allergies}
                onChange={handleChange}
                placeholder="e.g., Penicillin, Peanuts (comma-separated)"
              />
            </div>

            {message && (
              <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
                {message}
              </p>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>API Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {usageError ? (
            <p className="text-red-500">{usageError}</p>
          ) : usage ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Tokens</p>
                <p className="text-2xl font-bold text-purple-600">{usage.total_tokens.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-500">Prompt Tokens</p>
                <p className="text-2xl font-bold text-blue-600">{usage.total_prompt_tokens.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-500">Completion Tokens</p>
                <p className="text-2xl font-bold text-green-600">{usage.total_completion_tokens.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="text-2xl font-bold text-orange-600">{usage.request_count}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading usage data...</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Telegram Bot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!telegramConfig.connected ? (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Track your health from Telegram</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Connect your Telegram to log glucose & blood pressure readings by sending a message or photo. Get automatic reminders at your preferred times.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleGenerateLink} 
                  disabled={telegramLoading}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  Connect Telegram
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700 font-medium">Connected to Telegram</span>
                  </div>
                  <button
                    onClick={handleTelegramToggle}
                    disabled={telegramLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      telegramConfig.enabled ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      telegramConfig.enabled ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <p className="font-medium text-gray-700 mb-3">Daily Reminders</p>
                  <p className="text-xs text-gray-500 mb-3">Set up to 4 times when you want to be reminded to log your readings</p>
                  <div className="flex gap-2 mb-3">
                    {[1, 2, 3, 4].map((num) => (
                      <div key={num} className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Time {num}</label>
                        <input
                          type="time"
                          value={telegramConfig.notification_times[num - 1] || ""}
                          onChange={(e) => handleNotificationTimeChange(num - 1, e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <p className="font-medium text-gray-700 mb-3">Reading Types to Track</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={telegramConfig.tracking_types.includes("glucose")}
                        onChange={(e) => handleTrackingTypeChange("glucose", e.target.checked)}
                        className="w-4 h-4 text-blue-500 rounded"
                      />
                      <span className="text-sm text-gray-600">Blood Glucose</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={telegramConfig.tracking_types.includes("bp")}
                        onChange={(e) => handleTrackingTypeChange("bp", e.target.checked)}
                        className="w-4 h-4 text-blue-500 rounded"
                      />
                      <span className="text-sm text-gray-600">Blood Pressure</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <Button 
                    onClick={handleTelegramDisconnect} 
                    disabled={telegramLoading}
                    variant="outline"
                    className="text-red-500 border-red-200 hover:bg-red-50"
                  >
                    Disconnect Telegram
                  </Button>
                </div>
              </>
            )}

            {telegramMessage && (
              <p className={`text-sm ${telegramMessage.includes("success") || telegramMessage.includes("enabled") || telegramMessage.includes("disabled") ? "text-green-600" : "text-red-600"}`}>
                {telegramMessage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;