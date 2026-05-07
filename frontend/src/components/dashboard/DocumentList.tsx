import type { Document } from "../../types";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

const CATEGORIES = ["", "lab_results", "prescriptions", "imaging", "vaccination_records", "discharge_summaries", "insurance_documents", "other"];

const DocumentList = ({ docs, filter, setFilter }: { docs: Document[]; filter: string; setFilter: (f: string) => void }) => (
  <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
    <CardHeader className="border-b border-gray-100">
      <div className="flex justify-between items-center">
        <CardTitle className="text-gray-800">Documents</CardTitle>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 w-40 rounded-lg border border-gray-200 px-3 bg-gray-50 text-sm focus:border-blue-500">
          {CATEGORIES.map(c => <option key={c} value={c}>{c ? c.replace(/_/g, " ") : "All"}</option>)}
        </select>
      </div>
    </CardHeader>
    <CardContent className="pt-4">
      {docs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No documents yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <div key={doc.id} className="border border-gray-100 rounded-lg p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-800">{doc.original_name}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">{doc.category.replace(/_/g, " ")}</span>
                    <span>•</span>
                    <span>{(doc.file_size/1024).toFixed(1)} KB</span>
                    {doc.document_date && (
                      <>
                        <span>•</span>
                        <span className="text-gray-400">{new Date(doc.document_date).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200">Download</Button>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export default DocumentList;