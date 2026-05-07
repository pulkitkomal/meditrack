import React from "react";

interface HealthScoreProps {
  score: number;
}

export const HealthScore: React.FC<HealthScoreProps> = ({ score }) => {
  const getColor = (score: number) => {
    if (score >= 80) return "from-green-400 to-emerald-500";
    if (score >= 60) return "from-yellow-400 to-orange-500";
    return "from-red-400 to-pink-500";
  };

  const getBgGradient = (score: number) => {
    if (score >= 80) return "from-green-50 to-emerald-50";
    if (score >= 60) return "from-yellow-50 to-orange-50";
    return "from-red-50 to-pink-50";
  };

  const getStatus = (score: number) => {
    if (score >= 80) return { text: "Excellent", icon: "✨" };
    if (score >= 60) return { text: "Good", icon: "👍" };
    return { text: "Needs Attention", icon: "⚠️" };
  };

  const status = getStatus(score);
  const colorClass = getColor(score);
  const bgGradient = getBgGradient(score);

  return (
    <div className={`p-6 rounded-xl bg-gradient-to-br ${bgGradient} border border-gray-100 shadow-lg`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Health Score</h3>
        <span className="text-2xl">{status.icon}</span>
      </div>
      <div className={`text-6xl font-bold bg-gradient-to-r ${colorClass} bg-clip-text text-transparent`}>{score}</div>
      <p className="text-sm font-medium text-gray-600 mt-2 flex items-center gap-1">
        {status.text}
      </p>
      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500`} 
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};
