import type { Metadata } from "next";

import { FadeIn } from "@/components/animations/FadeIn";

export const metadata: Metadata = {
  title: "Terms of Service — Trivedi Marbles Pvt. Ltd.",
  description: "Terms and conditions for using the Trivedi Marbles website and services.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl bg-background px-6 pb-24 pt-32 md:px-12">
      <FadeIn>
        <span className="mb-4 block text-sm font-medium uppercase tracking-[0.2em] text-secondary">
          Legal
        </span>
        <h1 className="mb-4 font-serif text-5xl text-primary md:text-6xl">
          Terms of Service
        </h1>
        <p className="mb-12 text-sm text-muted-foreground">Last updated: May 2025</p>

        <div className="prose prose-stone max-w-none space-y-10 text-muted-foreground">
          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing and using the website at trivedigranimarmo.com (the &quot;Site&quot;), you agree
              to be bound by these Terms of Service. If you do not agree to these terms, please do
              not use the Site. These terms apply to all visitors, users, and anyone else who
              accesses the Site.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">2. About the Site</h2>
            <p className="leading-relaxed">
              This Site is operated by Trivedi Marbles Pvt. Ltd., a premium natural stone company
              incorporated in India. The Site serves as an informational and inquiry platform for
              our marble products and services. It does not constitute an online store; all purchases
              and transactions are finalised directly with our sales team.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">3. Use of the Site</h2>
            <p className="mb-4 leading-relaxed">You agree to use this Site only for lawful purposes and in a manner that does not:</p>
            <ul className="list-inside list-disc space-y-2 leading-relaxed">
              <li>Infringe the rights of any third party.</li>
              <li>Transmit any unsolicited or unauthorised advertising material.</li>
              <li>Attempt to gain unauthorised access to any part of the Site.</li>
              <li>Transmit any harmful, offensive, or disruptive content.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">4. Intellectual Property</h2>
            <p className="leading-relaxed">
              All content on this Site — including text, photographs, images, graphics, logos, and
              the overall design — is the property of Trivedi Marbles Pvt. Ltd. or its content
              suppliers and is protected by applicable intellectual property laws. You may not
              reproduce, distribute, or create derivative works from any Site content without our
              prior written permission.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">5. Product Information</h2>
            <p className="leading-relaxed">
              We endeavour to ensure that product descriptions, images, and specifications displayed
              on the Site are accurate. However, natural stone is subject to inherent variation in
              colour, veining, and texture. Images are for illustrative purposes only. Final product
              appearance may vary from what is shown on screen. We recommend requesting physical
              samples before placing any order.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">6. Inquiries and Quotes</h2>
            <p className="leading-relaxed">
              Submitting an inquiry through our contact form or WhatsApp does not constitute a binding
              order or contract. All pricing, availability, and delivery terms are subject to
              confirmation by our sales team. A contract is formed only upon our written acceptance
              of an order.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">7. Disclaimer of Warranties</h2>
            <p className="leading-relaxed">
              The Site and its content are provided &quot;as is&quot; without any warranty of any kind,
              express or implied, including but not limited to warranties of merchantability, fitness
              for a particular purpose, or non-infringement. We do not warrant that the Site will be
              available uninterrupted or error-free.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">8. Limitation of Liability</h2>
            <p className="leading-relaxed">
              To the fullest extent permitted by law, Trivedi Marbles Pvt. Ltd. shall not be liable
              for any indirect, incidental, special, or consequential damages arising from your use
              of the Site, even if we have been advised of the possibility of such damages.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">9. Third-Party Links</h2>
            <p className="leading-relaxed">
              The Site may contain links to third-party websites (such as social media profiles).
              These links are provided for convenience only. We have no control over the content of
              those sites and accept no responsibility for them or for any loss or damage that may
              arise from your use of them.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">10. Governing Law</h2>
            <p className="leading-relaxed">
              These Terms of Service are governed by and construed in accordance with the laws of
              India. Any disputes arising in connection with these terms shall be subject to the
              exclusive jurisdiction of the courts of Ahmedabad, Gujarat.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">11. Changes to These Terms</h2>
            <p className="leading-relaxed">
              We reserve the right to modify these Terms at any time. The &quot;Last updated&quot; date at
              the top of this page will reflect any changes. Your continued use of the Site after
              changes are posted constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-serif text-2xl text-primary">12. Contact Us</h2>
            <p className="leading-relaxed">
              For any questions regarding these Terms of Service, please contact us:
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
