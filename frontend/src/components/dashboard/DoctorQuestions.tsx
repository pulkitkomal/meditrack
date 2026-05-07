import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

interface DoctorQuestionsProps {
  questions: string[];
}

export const DoctorQuestions: React.FC<DoctorQuestionsProps> = ({ questions }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!questions || questions.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-t-lg border-b border-gray-100">
          <CardTitle className="text-gray-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Questions for Doctor
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-center py-6 text-gray-500">
            <span className="text-3xl mb-2 block">?</span>
            <p>No questions generated yet</p>
            <p className="text-sm text-gray-400 mt-1">Upload lab results to get personalized questions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-t-lg border-b border-gray-100">
        <CardTitle className="text-gray-800 flex items-center gap-2">
          <span className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          Questions for Doctor
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={idx} className="p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-100 flex justify-between items-start group hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-700 flex-1">{q}</p>
              <button 
                onClick={() => {
                  copyToClipboard(q);
                  // Could add toast notification here
                }}
                className="text-xs text-cyan-600 hover:text-cyan-700 font-medium ml-3 px-2 py-1 rounded bg-white/50 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
