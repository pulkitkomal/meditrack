import { useState } from "react";
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
    console.log(`[FRONTEND-UPLOAD] Starting upload - file: ${file?.name}, category: ${category}, date: ${documentDate}, size: ${file?.size} bytes`);
    
    if (!file || !category) {
      console.warn("[FRONTEND-UPLOAD] Validation failed: file or category missing");
      return setError("Select file and category");
    }
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (documentDate) {
      formData.append("document_date", documentDate);
    }
    
    console.log(`[FRONTEND-UPLOAD] FormData created, sending to backend...`);
    setUploading(true);
    
    try {
      const response = await documentService.upload(formData);
      console.log(`[FRONTEND-UPLOAD] Upload successful - response:`, response.data);
      setFile(null);
      setCategory("");
      setDocumentDate("");
      setError("");
      console.log(`[FRONTEND-UPLOAD] State reset after successful upload`);
      
      // Call onUpload to refresh the page
      onUpload();
    } catch (err: any) {
      console.error(`[FRONTEND-UPLOAD] Upload failed:`, err.response?.data || err.message);
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