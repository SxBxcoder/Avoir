import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-20" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Privacy Policy</h1>
        <p className="text-zinc-400 mb-12">Last Updated: July 2026</p>

        <div className="space-y-10 text-zinc-300 leading-relaxed text-sm md:text-base">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Introduction & Scope</h2>
            <p>
              Avoir, Inc. ("Avoir," "we," "us," or "our") respects your privacy and is committed to protecting it through our compliance with this Privacy Policy. This policy describes the types of information we may collect from you or that you may provide when you visit the website Avoir.ai and our practices for collecting, using, maintaining, protecting, and disclosing that information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-3">
              <li><strong>Personal Identifiers:</strong> Name, email address, and authentication data collected via our identity provider (AWS Cognito).</li>
              <li><strong>Financial Information:</strong> We do not collect or store full credit card numbers. All payment data is processed and secured directly by Stripe, Inc.</li>
              <li><strong>Proprietary Business Data:</strong> Brand DNA, internal marketing documents, quantitative datasets, and prompts uploaded to the Diamond Cascade Engine.</li>
              <li><strong>Automated Usage Data:</strong> IP addresses, browser types, session durations, and interaction metrics tracked via server logs and essential cookies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Generative AI & Data Usage</h2>
            <p className="mb-4">
              Avoir utilizes third-party Large Language Models (LLMs) via enterprise APIs (e.g., OpenAI, Google, Groq) to provide its core services. 
            </p>
            <p className="font-bold text-white mb-2">Zero-Retention & Non-Training Guarantees:</p>
            <p>
              We operate under strict enterprise agreements with our LLM providers. Your Proprietary Business Data and prompts are used <strong>strictly for real-time inference</strong> and are immediately discarded by the provider. Your data is <strong>never</strong> used to train, fine-tune, or improve our proprietary foundational models or those of our third-party LLM providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Data Sharing & Subprocessors</h2>
            <p>We do not sell, rent, or monetize your Personal Identifiers or Proprietary Business Data to third-party brokers or advertisers. We only share data with trusted Subprocessors necessary to operate our platform:</p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li><strong>Amazon Web Services (AWS):</strong> For secure cloud hosting and database storage.</li>
              <li><strong>Stripe:</strong> For secure subscription billing.</li>
              <li><strong>LLM Providers:</strong> For ephemeral inference generation (zero-retention).</li>
            </ul>
            <p className="mt-4">We may also disclose information if required to do so by law, court order, or governmental regulation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Data Retention & Security</h2>
            <p>
              We retain your Personal Identifiers and Proprietary Business Data only for as long as your account is active or as needed to provide you the Services. 
              All data at rest is encrypted using AES-256 encryption. All data in transit is encrypted using TLS 1.3. 
              Upon account deletion, your data is permanently purged from our active AWS databases within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Your Data Rights (GDPR & CCPA)</h2>
            <p>Depending on your jurisdiction (e.g., the EEA, UK, or California), you may have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate data.</li>
              <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> Request deletion of your personal data.</li>
              <li><strong>Right to Restrict Processing:</strong> Request that we limit how we use your data.</li>
            </ul>
            <p className="mt-4">To exercise any of these rights, please contact us at <a href="mailto:privacy@avoir.ai" className="text-indigo-400 hover:underline">privacy@avoir.ai</a>. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Cookies & Tracking Technologies</h2>
            <p>
              Avoir uses strictly necessary session cookies to maintain authentication state and security. We do not deploy third-party advertising or cross-site tracking cookies. You may disable cookies in your browser settings, but doing so will prevent you from logging into the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Changes to Our Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email or through a notice on the platform prior to the change becoming effective. Your continued use of the Services after the effective date constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Contact Us</h2>
            <p>
              If you have any questions, concerns, or complaints regarding this Privacy Policy or our data practices, please contact our Data Protection Officer at:
            </p>
            <p className="mt-4 font-mono text-zinc-400">
              Avoir, Inc.<br/>
              ATTN: Legal / Privacy<br/>
              privacy@avoir.ai
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
