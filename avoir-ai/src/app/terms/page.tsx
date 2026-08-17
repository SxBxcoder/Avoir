import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-20" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Terms of Service</h1>
        <p className="text-zinc-400 mb-12">Last Updated: July 2026</p>

        <div className="space-y-10 text-zinc-300 leading-relaxed text-sm md:text-base">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              These Terms of Service ("Terms") govern your access to and use of the Avoir.ai website, platform, APIs, and services (collectively, the "Services"), provided by Avoir, Inc., a Delaware corporation ("Avoir," "we," "us," or "our"). By accessing or using the Services, you agree to be bound by these Terms and our Privacy Policy. If you are using the Services on behalf of an organization, you agree to these Terms on behalf of that organization and represent that you have the authority to do so.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Description of Services & AI Outputs</h2>
            <p>
              Avoir provides an AI-powered quantitative marketing engine designed for institutional capital and enterprise brands. You acknowledge that the Services utilize generative artificial intelligence models. While we strive for high accuracy, the outputs ("Generated Content") may occasionally be inaccurate, hallucinated, or legally restricted depending on your jurisdiction. 
              <strong> You are solely responsible for reviewing, verifying, and ensuring the legal compliance of all Generated Content prior to deployment in live markets.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Subscriptions, Payments, and Taxes</h2>
            <p>
              Access to certain features requires a paid subscription. All payments are processed securely through our third-party payment processor, Stripe, Inc. By providing payment information, you authorize us to charge your payment method for all applicable fees. 
              Fees are non-refundable except as required by law. You are responsible for all applicable taxes associated with your purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Intellectual Property Rights</h2>
            <p className="mb-4">
              <strong>Your Content:</strong> As between you and Avoir, you retain all rights, title, and interest in and to the prompts, brand DNA, and proprietary data you input into the Services ("Input Data"), as well as the Generated Content output by the Services. You grant Avoir a limited, worldwide, non-exclusive license to process your Input Data solely to provide the Services to you.
            </p>
            <p>
              <strong>Our Technology:</strong> Avoir retains all rights, title, and interest in and to the Services, including the Diamond Cascade architecture, algorithms, UI/UX, software, and the Avoir brand. You may not reverse engineer, decompile, or extract the source code or underlying models of the Services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Acceptable Use Policy</h2>
            <p>You agree not to use the Services to:</p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li>Violate any applicable local, state, national, or international law, including securities regulations.</li>
              <li>Generate content that is defamatory, fraudulent, deceptive, or explicitly abusive.</li>
              <li>Interfere with or disrupt the integrity or performance of the Services.</li>
              <li>Perform automated scraping, high-volume API abuse, or attempt to bypass rate limits.</li>
            </ul>
            <p className="mt-4">We reserve the right to suspend or terminate your account immediately, without notice, if we determine you have violated this Acceptable Use Policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless Avoir, its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal and accounting fees) arising out of or in any way connected with your access to or use of the Services, your Input Data, your deployment of Generated Content, or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Disclaimer of Warranties</h2>
            <p className="uppercase text-xs tracking-wider">
              THE SERVICES AND GENERATED CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. AVOIR EXPLICITLY DISCLAIMS ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, QUIET ENJOYMENT, OR NON-INFRINGEMENT. AVOIR MAKES NO WARRANTY THAT THE SERVICES WILL MEET YOUR REQUIREMENTS, GENERATE FINANCIAL RETURNS, OR BE AVAILABLE ON AN UNINTERRUPTED, SECURE, OR ERROR-FREE BASIS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
            <p className="uppercase text-xs tracking-wider font-bold text-red-400">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL AVOIR OR ITS AFFILIATES BE LIABLE FOR ANY INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES, INCLUDING BUT NOT LIMITED TO LOST PROFITS, LOSS OF DATA, LOSS OF GOODWILL, SERVICE INTERRUPTION, COMPUTER DAMAGE, OR TRADING LOSSES, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR FROM THE USE OF OR INABILITY TO USE THE SERVICES OR GENERATED CONTENT, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), PRODUCT LIABILITY, OR ANY OTHER LEGAL THEORY.
            </p>
            <p className="uppercase text-xs tracking-wider font-bold text-red-400 mt-4">
              IN NO EVENT WILL AVOIR'S TOTAL LIABILITY ARISING OUT OF OR IN CONNECTION WITH THESE TERMS EXCEED THE AMOUNTS YOU HAVE PAID TO AVOIR FOR USE OF THE SERVICES IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Dispute Resolution by Binding Arbitration</h2>
            <p>
              <strong>Please read this section carefully, as it affects your legal rights.</strong> You and Avoir agree that any dispute, claim, or controversy arising out of or relating to these Terms or the breach, termination, enforcement, interpretation, or validity thereof shall be settled by binding, individual arbitration, and not in a class, representative, or consolidated action or proceeding. The arbitration will be administered by the American Arbitration Association (AAA) in accordance with its Commercial Arbitration Rules.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. Governing Law</h2>
            <p>
              These Terms and any action related thereto will be governed by the laws of the State of Delaware, without regard to its conflict of laws provisions. Exclusive jurisdiction for any claims not subject to arbitration will be in the state and federal courts located in New Castle County, Delaware.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at <a href="mailto:legal@avoir.ai" className="text-indigo-400 hover:underline">legal@avoir.ai</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
