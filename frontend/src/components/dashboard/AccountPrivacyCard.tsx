import { useState } from "react";
import { authService } from "../../services/api";
import { Button } from "../ui/button";

const AccountPrivacyCard = () => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState("");

  const goToLogin = () => {
    window.location.href = "/login";
  };

  const handleExport = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await authService.exportData();
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "healthsync-export.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Could not export your data. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm("Sign out of HealthSync on every device, including this one?")) return;
    setBusy(true);
    try {
      await authService.logoutAll();
      goToLogin();
    } catch {
      setMessage("Could not sign out other devices. Please try again.");
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setMessage("");
    try {
      await authService.deleteAccount(password);
      goToLogin();
    } catch (err: any) {
      setMessage(err.response?.status === 403 ? "Incorrect password." : "Could not delete your account. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="card-premium">
      <div className="mb-6">
        <h2 className="font-semibold text-slate-800">Privacy & Account</h2>
        <p className="text-sm text-slate-500">Download your data, manage sessions, or delete your account</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleExport} disabled={busy} variant="secondary">
            Download my data
          </Button>
          <Button onClick={handleLogoutAll} disabled={busy} variant="secondary">
            Sign out of all devices
          </Button>
        </div>

        {!confirmingDelete ? (
          <Button onClick={() => setConfirmingDelete(true)} disabled={busy} variant="secondary" className="text-red-500 hover:bg-red-50">
            Delete account
          </Button>
        ) : (
          <div className="p-4 rounded-xl bg-red-50/80 space-y-3">
            <p className="text-sm text-red-700">
              This permanently deletes your account, all uploaded documents, analyses, and health readings. It cannot be undone.
            </p>
            <input
              type="password"
              placeholder="Enter your password to confirm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            <div className="flex gap-3">
              <Button onClick={handleDelete} disabled={busy || !password} className="bg-red-600 hover:bg-red-700 text-white">
                Permanently delete
              </Button>
              <Button onClick={() => { setConfirmingDelete(false); setPassword(""); }} disabled={busy} variant="secondary">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {message && <p className="text-sm text-red-500">{message}</p>}
      </div>
    </div>
  );
};

export default AccountPrivacyCard;
