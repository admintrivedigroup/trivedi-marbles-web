import type { Metadata } from "next";

import { FadeIn } from "@/components/animations/FadeIn";

export const metadata: Metadata = {
  title: "Privacy Policy — Trivedi Marbles Pvt. Ltd.",
  description: "How Trivedi Marbles collects, uses, and protects your personal information.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl bg-background px-6 pb-24 pt-32 md:px-12">
      <FadeIn>
        <span className="mb-4 block text-sm font-medium uppercase tracking-[0.2em] text-secondary">
          Legal
        </span>
        <h1 className="mb-4 font-serif text-5xl text-primary md:text-6xl">
          Privacy Policy
        </h1>
        <p className="mb-12 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="prose prose-stone max-w-none space-y-10 text-muted-foreground">
          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">1. Who We Are</h2>
            <p className="leading-relaxed">
              Trivedi Marbles Pvt. Ltd. (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a premium natural stone company
              headquartered at S.No.: 698/4, Ognaj, Opp. Vasant Nagar Township, Gota-Vadsar Road,
              Ahmedabad — 380060, Gujarat, India. This policy explains how we handle personal
              information collected through our website at trivedimarbles.co.in.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">2. Information We Collect</h2>
            <p className="mb-4 leading-relaxed">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-inside list-disc space-y-2 leading-relaxed">
              <li>Name and contact details (email address, phone number) submitted via our inquiry form.</li>
              <li>Project details and requirements you share when contacting us.</li>
              <li>Communications you send us by email or WhatsApp.</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              We do not collect payment information on this website. All sales transactions are handled
              separately and directly.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">3. How We Use Your Information</h2>
            <ul className="list-inside list-disc space-y-2 leading-relaxed">
              <li>To respond to your inquiries and provide product information or quotes.</li>
              <li>To follow up on orders and ongoing projects.</li>
              <li>To send you relevant updates about our collection or services, where you have consented.</li>
              <li>To improve our website and customer experience.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">4. Sharing Your Information</h2>
            <p className="leading-relaxed">
              We do not sell, rent, or trade your personal information to third parties. We may share
              information with trusted service providers (such as email or hosting providers) solely
              to operate our business, under strict confidentiality obligations. We may also disclose
              information when required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">5. Cookies</h2>
            <p className="leading-relaxed">
              Our website may use essential cookies to ensure proper functionality. We do not use
              tracking or advertising cookies. You can disable cookies in your browser settings;
              however, some features of the site may not function correctly as a result.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">6. Data Security</h2>
            <p className="leading-relaxed">
              We take reasonable technical and organisational measures to protect your personal
              information from unauthorised access, loss, or misuse. However, no internet transmission
              is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">7. Data Retention</h2>
            <p className="leading-relaxed">
              We retain your personal information for as long as necessary to fulfil the purposes
              described in this policy, or as required by applicable law. Inquiry data is typically
              kept for up to 3 years unless an ongoing business relationship requires otherwise.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">8. Your Rights</h2>
            <p className="mb-4 leading-relaxed">
              Subject to applicable law, you may have the right to:
            </p>
            <ul className="list-inside list-disc space-y-2 leading-relaxed">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate or incomplete data.</li>
              <li>Request deletion of your personal data.</li>
              <li>Withdraw consent for marketing communications at any time.</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              To exercise any of these rights, please contact us at{" "}
              <a href="mailto:info@trivedigranimarmo.com" className="text-secondary hover:underline">
                info@trivedigranimarmo.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">9. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the
              top of this page reflects when changes were last made. Continued use of the website
              after changes constitutes your acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">10. Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about this Privacy Policy, please reach out to us:
            </p>
            <address className="mt-4 not-italic leading-relaxed">
              Trivedi Marbles Pvt. Ltd.<br />
              S.No.: 698/4, Ognaj, Opp. Vasant Nagar Township,<br />
              Gota-Vadsar Road, Ahmedabad — 380060, Gujarat, India.<br />
              <a href="mailto:info@trivedigranimarmo.com" className="text-secondary hover:underline">
                info@trivedigranimarmo.com
              </a><br />
              +91 90999 96869
            </address>
          </section>
        </div>
      </FadeIn>
    </div>
  );
}
