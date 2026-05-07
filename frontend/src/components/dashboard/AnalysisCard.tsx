import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";

interface AnalysisCardProps {
  analysis: any;
  onView: (id: string) => void;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, onView }) => {
  const labCount = analysis.extracted_data?.lab_values?.length || 0;
  const hasIssues = analysis.risk_assessment?.risk_factors?.length > 0;
  
  return (
    <Card className="mb-4 border-0 shadow-md bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium text-gray-800">
            {analysis.category.replace(/_/g, " ")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{new Date(analysis.document_date || analysis.analysis_date).toLocaleDateString()}</span>
            {hasIssues && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Attention</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{analysis.extracted_data?.summary || "No summary available"}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              {labCount} tests
            </span>
            {hasIssues && (
              <span className="flex items-center gap-1 text-yellow-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {analysis.risk_assessment.risk_factors.length} alerts
              </span>
            )}
          </div>
          <Button size="sm" onClick={() => onView(analysis.document_id)} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0">View Details</Button>
        </div>
      </CardContent>
    </Card>
  );
};
