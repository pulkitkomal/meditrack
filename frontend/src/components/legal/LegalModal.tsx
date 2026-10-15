import Modal from "../ui/Modal";
import PrivacyPolicyContent from "./PrivacyPolicyContent";
import TermsContent from "./TermsContent";

export type LegalDocument = "terms" | "privacy";

const LegalModal = ({ document, onClose }: { document: LegalDocument; onClose: () => void }) => (
  <Modal title={document === "terms" ? "Terms & Conditions" : "Privacy Policy"} onClose={onClose}>
    {document === "terms" ? <TermsContent /> : <PrivacyPolicyContent />}
  </Modal>
);

export default LegalModal;
