import { useState } from "react";
import { authService } from "../../services/api";
import { saveBlob } from "../../lib/download";

export const useReportDownload = () => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await authService.downloadReport();
      const today = new Date().toLocaleDateString("en-CA");
      saveBlob(res.data, `sehat-summary-${today}.pdf`);
    } catch {
      setError("Could not create the report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return { download, downloading, error };
};
