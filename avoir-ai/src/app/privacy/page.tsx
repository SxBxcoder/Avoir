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

        <div className="space-y-8 text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>
            <p>
              When you use Avoir.ai, we collect information necessary to provide our services, including:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li><strong>Account Data:</strong> Email addresses and profile information collected via AWS Cognito.</li>
              <li><strong>Financial Data:</strong> We do not store raw credit card data. All payment processing is securely handled by Stripe.</li>
              <li><strong>Campaign Data:</strong> Brand DNA, prompts, and assets you input into the Diamond Cascade Engine.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. How We Use Artificial Intelligence</h2>
            <p>
              Avoir.ai utilizes external Large Language Models (LLMs) including but not limited to OpenAI, Google Gemini, and Groq to generate quantitative marketing strategies.
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li><strong>No Training on Customer Data:</strong> We have strict zero-retention agreements with our LLM providers. Your proprietary Brand DNA and campaign data are never used to train public models.</li>
              <li><strong>Data Transmission:</strong> Prompts are securely transmitted via encrypted APIs (TLS 1.3) solely for the purpose of inference.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Data Security & Storage</h2>
            <p>
              Our infrastructure runs on secure, enterprise-grade cloud environments (AWS). We employ end-to-end encryption for data in transit and AES-256 encryption for data at rest. Access to backend systems is strictly regulated using IAM roles and zero-trust policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Third-Party Services</h2>
            <p>
              We may share necessary operational data with our trusted infrastructure partners (e.g., Stripe for billing, AWS for hosting). We do not and will never sell your personal or company data to data brokers or advertising networks.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Contact Us</h2>
            <p>
              For any questions regarding this Privacy Policy or your data rights, please contact our security team at <a href="mailto:privacy@avoir.ai" className="text-indigo-400 hover:underline">privacy@avoir.ai</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
