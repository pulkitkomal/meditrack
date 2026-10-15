import { useCallback, useRef, useState } from "react";
import { documentService } from "../../services/api";
import { Button } from "../ui/button";

export const CATEGORY_LABELS: Record<string, string> = {
  lab_results: "Lab results",
  prescriptions: "Prescriptions",
  imaging: "Imaging",
  vaccination_records: "Vaccinations",
  discharge_summaries: "Discharge summaries",
  insurance_documents: "Insurance",
  other: "Other",
};

const MAX_FILES = 20;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = /\.(pdf|jpe?g|png)$/i;

const UploadPanel = ({ onUpload }: { onUpload: () => void }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("lab_results");
  const [documentDate, setDocumentDate] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ uploaded: number; failed: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const rejected = incoming.filter(f => !ACCEPTED.test(f.name) || f.size > MAX_BYTES);
    const accepted = incoming.filter(f => !rejected.includes(f));
    setError(rejected.length ? `Skipped ${rejected.map(f => f.name).join(", ")} — only PDF, JPG or PNG up to 10 MB.` : "");
    setResult(null);
    setFiles(prev => [...prev, ...accepted].slice(0, MAX_FILES));
  }, []);

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const res = await documentService.bulkUpload(files, category, documentDate || undefined);
      const failed = (res.data.errors || []).map((e: { name: string }) => e.name);
      setResult({ uploaded: res.data.uploaded?.length || 0, failed });
      setFiles([]);
      setDocumentDate("");
      onUpload();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card-premium space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">Add records</h3>
        <p className="text-sm text-slate-500">Lab reports, prescriptions or scans — they're analysed automatically.</p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
        className={`border-2 border-dashed rounded-glass p-6 text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
          dragging ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-teal-300 hover:bg-teal-50/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={e => { addFiles(e.target.files ? Array.from(e.target.files) : []); e.target.value = ""; }}
        />
        <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-slate-700 font-medium">Drop files here or tap to choose</p>
        <p className="text-slate-500 text-xs mt-1">PDF, JPG or PNG · up to {MAX_FILES} files, 10 MB each</p>
      </div>

      {files.length > 0 && (
        <>
          <ul className="max-h-44 overflow-y-auto space-y-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-700 truncate">{file.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-1.5 block">Type</span>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input-premium">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-1.5 block">Date of record <span className="font-normal text-slate-400">(optional)</span></span>
              <input type="date" value={documentDate} max={new Date().toLocaleDateString("en-CA")} onChange={e => setDocumentDate(e.target.value)} className="input-premium" />
            </label>
          </div>
          <p className="text-xs text-slate-500 -mt-2">Leave the date empty to read it from the document.</p>

          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? "Uploading…" : `Upload ${files.length} file${files.length === 1 ? "" : "s"}`}
          </Button>
        </>
      )}

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-xl">{error}</p>}
      {result && (
        <p role="status" className={`text-sm p-3 rounded-xl ${result.failed.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
          {result.uploaded > 0 && `✓ ${result.uploaded} uploaded — analysis has started.`}
          {result.failed.length > 0 && ` ${result.failed.length} failed: ${result.failed.join(", ")}`}
        </p>
      )}
    </div>
  );
};

export default UploadPanel;
