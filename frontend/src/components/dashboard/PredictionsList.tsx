import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

interface Prediction {
  condition: string;
  probability: number;
  reasoning: string;
}

interface PredictionsListProps {
  predictions: Prediction[];
}

export const PredictionsList: React.FC<PredictionsListProps> = ({ predictions }) => {
  if (!predictions || predictions.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg border-b border-gray-100">
          <CardTitle className="text-gray-800 flex items-center gap-2">
            <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
            Health Predictions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-center py-6 text-gray-500">
            <span className="text-3xl mb-2 block">✓</span>
            <p>No health predictions based on your data</p>
            <p className="text-sm text-gray-400 mt-1">Upload more lab results to get predictions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg border-b border-gray-100">
        <CardTitle className="text-gray-800 flex items-center gap-2">
          <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </span>
          Health Predictions
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {predictions.map((p, idx) => (
            <div key={idx} className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-800">{p.condition}</h4>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        p.probability > 0.7 ? 'bg-red-500' :
                        p.probability > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${p.probability * 100}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${
                    p.probability > 0.7 ? "bg-red-100 text-red-700" :
                    p.probability > 0.4 ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {Math.round(p.probability * 100)}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{p.reasoning}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
