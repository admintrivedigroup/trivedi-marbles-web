import type { ReactNode } from "react";

import BackToTop from "@/components/layout/BackToTop";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import PageTransition from "@/components/layout/PageTransition";

type SiteLayoutProps = {
  children: ReactNode;
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
      <path d="M19.08 4.91A9.78 9.78 0 0 0 12.04 2a9.94 9.94 0 0 0-8.6 14.93L2 22l5.23-1.37A9.96 9.96 0 0 0 12.03 22h.01a9.98 9.98 0 0 0 7.04-17.09Zm-7.04 15.4a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.27 8.27 0 1 1 6.95 3.84Zm4.53-6.18c-.25-.12-1.48-.73-1.7-.8-.23-.08-.4-.12-.57.12-.17.25-.65.8-.8.96-.15.17-.3.18-.56.06-.25-.13-1.08-.4-2.05-1.27-.76-.68-1.27-1.52-1.42-1.77-.15-.26-.02-.4.11-.52.12-.12.25-.31.37-.46.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.12-.57-1.37-.78-1.87-.2-.49-.41-.42-.57-.43h-.48c-.16 0-.42.06-.64.3-.22.25-.85.83-.85 2.03s.87 2.35.99 2.52c.13.17 1.7 2.6 4.12 3.64.57.25 1.02.4 1.37.52.58.18 1.1.16 1.52.1.46-.07 1.48-.6 1.69-1.17.21-.58.21-1.08.15-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />

      <BackToTop />

      <a
        href="https://wa.me/919099996869?text=Hi%2C%20I%27d%20like%20to%20inquire%20about%20your%20marble%20collection."
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="group fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#25D366] text-white shadow-[0_4px_24px_rgba(37,211,102,0.45)] [transition:width_300ms_ease,box-shadow_300ms] hover:w-44 hover:shadow-[0_6px_32px_rgba(37,211,102,0.65)] md:bottom-8 md:left-8"
      >
        <span className="shrink-0"><WhatsAppIcon /></span>
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium uppercase tracking-widest [transition:max-width_300ms_ease,margin_300ms_ease] group-hover:ml-3 group-hover:max-w-xs">
          Chat with us
        </span>
      </a>
    </div>
  );
}
