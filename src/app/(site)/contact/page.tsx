import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import { ContactForm } from "@/components/contact/ContactForm";
import { LocationSection } from "@/components/contact/LocationSection";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Trivedi Marbles Pvt Ltd. Visit our factory in Ahmedabad, call +91 90999 96869, or message us on WhatsApp for quotes and slab availability.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Us | Trivedi Marbles Pvt Ltd",
    description:
      "Get in touch with Trivedi Marbles Pvt Ltd. Visit our factory in Ahmedabad, call +91 90999 96869, or message us on WhatsApp for quotes and slab availability.",
    url: "/contact",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us | Trivedi Marbles Pvt Ltd",
    description:
      "Get in touch with Trivedi Marbles Pvt Ltd. Visit our factory in Ahmedabad, call +91 90999 96869, or message us on WhatsApp for quotes and slab availability.",
  },
};

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-current text-[#25D366]"
    >
      <path d="M19.08 4.91A9.78 9.78 0 0 0 12.04 2a9.94 9.94 0 0 0-8.6 14.93L2 22l5.23-1.37A9.96 9.96 0 0 0 12.03 22h.01a9.98 9.98 0 0 0 7.04-17.09Zm-7.04 15.4a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.27 8.27 0 1 1 6.95 3.84Zm4.53-6.18c-.25-.12-1.48-.73-1.7-.8-.23-.08-.4-.12-.57.12-.17.25-.65.8-.8.96-.15.17-.3.18-.56.06-.25-.13-1.08-.4-2.05-1.27-.76-.68-1.27-1.52-1.42-1.77-.15-.26-.02-.4.11-.52.12-.12.25-.31.37-.46.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.12-.57-1.37-.78-1.87-.2-.49-.41-.42-.57-.43h-.48c-.16 0-.42.06-.64.3-.22.25-.85.83-.85 2.03s.87 2.35.99 2.52c.13.17 1.7 2.6 4.12 3.64.57.25 1.02.4 1.37.52.58.18 1.1.16 1.52.1.46-.07 1.48-.6 1.69-1.17.21-.58.21-1.08.15-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl bg-background px-6 pb-24 pt-32 md:px-12 lg:px-24">
      <FadeIn className="mb-16 text-center">
        <span className="mb-4 block text-sm font-medium uppercase tracking-[0.2em] text-secondary">
          Get in Touch
        </span>
        <h1 className="mb-6 font-serif text-5xl text-primary md:text-6xl">
          Let&apos;s Discuss Your Vision
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Whether you are an architect designing a masterpiece or a homeowner
          crafting your sanctuary, we are here to assist.
        </p>
      </FadeIn>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-24">
        <FadeIn direction="left" delay={0.2} className="space-y-12">
          <div>
            <h3 className="mb-6 border-b border-border pb-4 font-serif text-2xl text-primary">
              Corporate Office &amp; Factory
            </h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="mt-1 h-6 w-6 shrink-0 text-secondary" />
                <div>
                  <h4 className="mb-1 font-serif text-xl text-primary">Location</h4>
                  <p className="leading-relaxed text-muted-foreground">
                    S.No.: 698/4, Ognaj,
                    <br />
                    Opp. Vasant Nagar Township,
                    <br />
                    Gota-Vadsar Road, Ahmedabad-380060,
                    <br />
                    Gujarat, INDIA.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="mt-1 h-6 w-6 shrink-0 text-secondary" />
                <div>
                  <h4 className="mb-1 font-serif text-xl text-primary">Phone</h4>
                  <p className="text-muted-foreground">
                    +91 90999 96869
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Mail className="mt-1 h-6 w-6 shrink-0 text-secondary" />
                <div>
                  <h4 className="mb-1 font-serif text-xl text-primary">Email</h4>
                  <p className="text-muted-foreground">
                    dhruvtrivedi@trivedigranimarmo.com
                    <br />
                    info@trivedigranimarmo.com
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-sm bg-primary p-8 text-white">
            <h3 className="mb-4 font-serif text-2xl">Instant Assistance</h3>
            <p className="mb-6 text-sm leading-relaxed text-white/70">
              Connect with our luxury marble consultants directly via WhatsApp for
              quick quotes, slab images, and inventory updates.
            </p>
            <a
              href="https://wa.me/919099996869"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 text-sm font-medium uppercase tracking-widest text-secondary transition-colors hover:text-white"
            >
              <WhatsAppIcon />
              Chat on WhatsApp
            </a>
          </div>
        </FadeIn>

        <FadeIn direction="right" delay={0.4}>
          <ContactForm />
        </FadeIn>
      </div>
      <LocationSection />
    </div>
  );
}
