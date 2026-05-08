import { useState, useCallback } from "react";
import { documentService } from "../../services/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

const CATEGORIES = ["lab_results", "prescriptions", "imaging", "vaccination_records", "discharge_summaries", "insurance_documents", "other"];

const FileUpload = ({ onUpload }: { onUpload: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !category) {
      return setError("Select file and category");
    }
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (documentDate) {
      formData.append("document_date", documentDate);
    }
    
    setUploading(true);
    
    try {
      await documentService.upload(formData);
      setFile(null);
      setCategory("");
      setDocumentDate("");
      setError("");
      onUpload();
    } catch (err: any) {
      setError(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-lg">
        <CardTitle className="text-white">Upload Document</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 w-full rounded-lg border border-gray-200 px-3 bg-gray-50 focus:border-blue-500 focus:ring-blue-500">
              <option value="">Select Category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Document Date</label>
            <Input 
              type="date" 
              value={documentDate}
              onChange={e => setDocumentDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">File</label>
            <Input type="file" accept=".pdf,.jpg,.png" onChange={e => setFile(e.target.files?.[0] || null)} required className="rounded-lg border border-gray-200 bg-gray-50 focus:border-blue-500" />
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded-lg">{error}</p>}
          <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-md transition-all" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload Document"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default FileUpload;

interface BulkUploadProps {
  onUpload: () => void;
}

export const BulkUpload = ({ onUpload }: BulkUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ uploaded: number; errors: number } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    setFiles(prev => [...prev, ...droppedFiles].slice(0, 20));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    setFiles(prev => [...prev, ...selected].slice(0, 20));
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!files.length || !category) return;
    
    setUploading(true);
    setResults(null);
    
    try {
      const res = await documentService.bulkUpload(files, category);
      setResults({
        uploaded: res.data.uploaded?.length || 0,
        errors: res.data.errors?.length || 0
      });
      setFiles([]);
      setCategory("");
      onUpload();
    } catch (err) {
      console.error("Bulk upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-t-lg">
        <CardTitle className="text-white">Bulk Upload</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">Category (all files)</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)} 
              className="h-10 w-full rounded-lg border border-gray-200 px-3 bg-gray-50 focus:border-emerald-500 focus:ring-emerald-500"
            >
              <option value="">Select Category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-400 transition-colors cursor-pointer"
          >
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
              id="bulk-file-select"
            />
            <label htmlFor="bulk-file-select" className="cursor-pointer">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">Drop files here or click to select</p>
              <p className="text-gray-500 text-sm mt-1">PDF, JPG, PNG up to 20 files</p>
            </label>
          </div>
          
          {files.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {results && (
            <div className={`p-3 rounded-lg text-sm ${results.errors > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
              {results.uploaded > 0 && <span className="font-medium">{results.uploaded} files uploaded</span>}
              {results.errors > 0 && <span className="ml-2">({results.errors} failed)</span>}
            </div>
          )}
          
          <Button 
            onClick={handleUpload}
            disabled={!files.length || !category || uploading}
            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg shadow-md transition-all"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </span>
            ) : (
              `Upload ${files.length} File${files.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};