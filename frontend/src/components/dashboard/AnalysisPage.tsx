import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { analysisService } from "../../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";

const AnalysisPage = () => {
  const { docId } = useParams<{ docId: string }>();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log(`[FRONTEND-ANALYSIS] AnalysisPage mounted - docId: ${docId}`);
    
    const fetchAnalysis = async () => {
      try {
        console.log(`[FRONTEND-ANALYSIS] Fetching analysis for docId: ${docId}`);
        const res = await analysisService.getAnalysis(docId!);
        console.log(`[FRONTEND-ANALYSIS] Analysis data received:`, {
          document_id: res.data?.document_id,
          category: res.data?.category,
          analysis_date: res.data?.analysis_date,
          has_lab_values: !!res.data?.extracted_data?.lab_values?.length,
          has_medications: !!res.data?.extracted_data?.medications?.length,
          has_diagnoses: !!res.data?.extracted_data?.diagnoses?.length,
          summary: res.data?.extracted_data?.summary?.substring(0, 100)
        });
        setAnalysis(res.data);
      } catch (error: any) {
        console.error(`[FRONTEND-ANALYSIS] Error fetching analysis:`, error.response?.data || error.message);
        if (error.response?.status === 404) {
          console.log(`[FRONTEND-ANALYSIS] Analysis not found, triggering analysis...`);
          alert("Analysis not found. Triggering analysis...");
          await analysisService.triggerAnalysis(docId!);
          console.log(`[FRONTEND-ANALYSIS] Analysis triggered, fetching results...`);
          const res = await analysisService.getAnalysis(docId!);
          console.log(`[FRONTEND-ANALYSIS] Analysis data received after trigger:`, res.data);
          setAnalysis(res.data);
        }
      } finally {
        setLoading(false);
        console.log(`[FRONTEND-ANALYSIS] Loading complete`);
      }
    };
    if (docId) fetchAnalysis();
  }, [docId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!analysis) return <div className="min-h-screen flex items-center justify-center">Analysis not found</div>;

  return (
    <div className="min-h-screen">
      <nav className="border-b p-4 flex justify-between">
        <h1 className="text-xl font-bold">Analysis Details</h1>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>Back</Button>
      </nav>
      <main className="container mx-auto p-8 space-y-6">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent>
            <p>{analysis.extracted_data?.summary || "No summary available"}</p>
          </CardContent>
        </Card>

        {analysis.extracted_data?.lab_values?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Lab Values</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left">Test</th>
                    <th className="text-left">Value</th>
                    <th className="text-left">Reference</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.extracted_data.lab_values.map((lab: any, idx: number) => (
                    <tr key={idx}>
                      <td>{lab.test}</td>
                      <td>{lab.value} {lab.unit}</td>
                      <td>{lab.reference_range}</td>
                      <td>
                        <span className={`px-2 py-1 rounded text-xs ${
                          lab.status === 'high' ? 'bg-red-100 text-red-700' :
                          lab.status === 'low' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {lab.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {analysis.extracted_data?.medications?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Medications</CardTitle></CardHeader>
            <CardContent>
              <ul>
                {analysis.extracted_data.medications.map((med: any, idx: number) => (
                  <li key={idx}>{med.name} - {med.dosage} ({med.frequency})</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {analysis.extracted_data?.diagnoses?.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Diagnoses</CardTitle></CardHeader>
            <CardContent>
              <ul>
                {analysis.extracted_data.diagnoses.map((d: any, idx: number) => (
                  <li key={idx}>{d.condition} {d.icd_code && `(${d.icd_code})`}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default AnalysisPage;
