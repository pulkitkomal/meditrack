const TermsContent = () => (
  <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-slate-600 space-y-4">
    <p className="text-slate-500 text-xs">Effective Date: October 15, 2026</p>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">1. Acceptance of Terms</h3>
      <p>By accessing and using HealthSync, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Service.</p>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">2. Description of Service</h3>
      <p>HealthSync provides a platform for managing personal health records with:</p>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>Upload and storage of medical documents (PDF, JPG, PNG)</li>
        <li>AI-powered analysis of medical documents</li>
        <li>Logging of glucose, blood pressure, and weight on the website or through the Telegram bot</li>
        <li>A downloadable health summary report</li>
        <li>A medical advisor chatbot for general health information</li>
      </ul>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">3. User Accounts</h3>
      <p>You must provide accurate information when creating an account. You are responsible for keeping your login credentials confidential.</p>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">4. Medical Document Storage</h3>
      <p>You retain full ownership of all documents you upload. We do not sell your documents or data. To run the Service, documents and data are processed by the providers listed in the Privacy Policy, including OpenAI for document analysis and chat, AWS S3 for file storage, and MongoDB Atlas for the database.</p>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">5. AI Analysis and Health Advisor</h3>
      <p>Values extracted from documents by AI may contain errors; you can correct them on each record. The AI-powered advisor provides general health information only. <span className="font-semibold text-red-600">It is NOT a replacement for professional medical advice.</span> Always consult a healthcare professional for medical decisions.</p>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">6. Limitation of Liability</h3>
      <p>HealthSync is provided "as is" without warranties. We are not liable for any decisions made based on AI responses or outputs.</p>
    </div>
  </div>
);

export default TermsContent;
