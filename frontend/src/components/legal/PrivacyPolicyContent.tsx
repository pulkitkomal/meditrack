const PrivacyPolicyContent = () => (
  <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-slate-600 space-y-4">
    <p className="text-slate-500 text-xs">Effective Date: October 14, 2026</p>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">1. Information We Collect</h3>
      <p className="font-medium text-slate-700">Personal Information:</p>
      <ul className="list-disc list-inside mt-1 mb-2">
        <li>Name and email address</li>
        <li>Profile information (age, gender, blood type)</li>
        <li>Medical conditions and allergies</li>
        <li>Health readings (glucose, blood pressure, weight)</li>
      </ul>
      <p className="font-medium text-slate-700">Medical Documents:</p>
      <ul className="list-disc list-inside mt-1">
        <li>Uploaded files (PDF, images)</li>
        <li>Document metadata</li>
        <li>AI analysis results</li>
      </ul>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">2. How We Use Your Information</h3>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>Provide and maintain the Service</li>
        <li>Process and analyze uploaded medical documents</li>
        <li>Generate health insights and trends</li>
        <li>Answer your questions in the AI health assistant</li>
        <li>Send reminders (if Telegram is connected)</li>
      </ul>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">3. Third-Party Services</h3>
      <p>To provide the Service, some of your data is processed by these providers:</p>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>
          <span className="font-medium text-slate-700">OpenAI</span>: the contents of documents you upload (text and images),
          your profile and medical context, and messages you send to the AI assistant are sent to OpenAI to generate
          analyses, titles, and answers. This is governed by OpenAI's API data usage policies.
        </li>
        <li><span className="font-medium text-slate-700">Amazon Web Services (S3)</span>: stores your uploaded files.</li>
        <li><span className="font-medium text-slate-700">MongoDB Atlas</span>: stores your account, readings, and analysis results.</li>
        <li><span className="font-medium text-slate-700">Telegram</span>: delivers readings and reminders, only if you connect the bot.</li>
      </ul>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">4. Data Storage</h3>
      <p>Data is encrypted in transit. Medical documents are stored on AWS S3 and records on MongoDB Atlas.</p>
    </div>

    <div>
      <h3 className="font-semibold text-slate-800 mb-2">5. Your Rights</h3>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>Download all of your data (Profile → Privacy &amp; Account)</li>
        <li>Correct your profile information at any time</li>
        <li>Permanently delete your account and all associated data and files (Profile → Privacy &amp; Account)</li>
        <li>Disconnect Telegram at any time</li>
      </ul>
    </div>
  </div>
);

export default PrivacyPolicyContent;
