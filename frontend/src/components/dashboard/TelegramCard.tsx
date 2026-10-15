import { useState, useEffect } from "react";
import { telegramService } from "../../services/api";
import { Button } from "../ui/button";

const TelegramCard = () => {
  const [telegramConfig, setTelegramConfig] = useState({
    enabled: false,
    connected: false,
    notification_times: ["08:00", "12:00", "18:00", "21:00"] as string[],
    tracking_types: ["glucose", "bp"] as string[]
  });
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");

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

  return (
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
        <div className="p-4 bg-blue-50 rounded-glass">
          <p className="text-sm text-slate-600 mb-4">
            Connect Telegram to log glucose, blood pressure, and weight readings by sending a message or photo. Get automatic reminders.
          </p>
          <Button onClick={handleGenerateLink} disabled={telegramLoading}>
            Connect Telegram
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-glass">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span className="text-sm font-medium text-emerald-700">Connected to Telegram</span>
            </div>
            <button
              onClick={handleTelegramToggle}
              disabled={telegramLoading}
              role="switch"
              aria-checked={telegramConfig.enabled}
              aria-label="Reminder notifications"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                telegramConfig.enabled ? "bg-teal-600" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${
                telegramConfig.enabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="font-medium text-slate-700 mb-3">Daily Reminders</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((num) => (
                <div key={num}>
                  <label className="block text-xs text-slate-500 mb-1">Time {num}</label>
                  <input
                    type="time"
                    value={telegramConfig.notification_times[num - 1] || ""}
                    onChange={(e) => handleNotificationTimeChange(num - 1, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-surface text-slate-800 rounded-lg"
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramConfig.tracking_types.includes("weight")}
                  onChange={(e) => handleTrackingTypeChange("weight", e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-sm text-slate-600">Weight</span>
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
  );
};

export default TelegramCard;
