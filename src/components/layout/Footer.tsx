import Image from "next/image";
import Link from "next/link";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current">
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.25" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4.1" strokeWidth="1.75" />
      <circle cx="17.35" cy="6.65" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M13.64 20v-6.62h2.23l.33-2.58h-2.56V9.15c0-.75.2-1.25 1.28-1.25h1.37V5.6c-.67-.07-1.35-.11-2.03-.1-2.01 0-3.38 1.23-3.38 3.49v1.81H8.6v2.58h2.28V20h2.76Z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M6.12 8.24a1.56 1.56 0 1 1 0-3.12 1.56 1.56 0 0 1 0 3.12ZM4.8 19.2V9.85h2.64v9.35H4.8Zm4.16 0V9.85h2.53v1.28h.04c.35-.66 1.22-1.56 2.78-1.56 2.97 0 3.52 1.95 3.52 4.48v5.15h-2.64v-4.56c0-1.09-.02-2.49-1.52-2.49-1.53 0-1.76 1.19-1.76 2.41v4.64H8.96Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M19.08 4.91A9.78 9.78 0 0 0 12.04 2a9.94 9.94 0 0 0-8.6 14.93L2 22l5.23-1.37A9.96 9.96 0 0 0 12.03 22h.01a9.98 9.98 0 0 0 7.04-17.09Zm-7.04 15.4a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.27 8.27 0 1 1 6.95 3.84Zm4.53-6.18c-.25-.12-1.48-.73-1.7-.8-.23-.08-.4-.12-.57.12-.17.25-.65.8-.8.96-.15.17-.3.18-.56.06-.25-.13-1.08-.4-2.05-1.27-.76-.68-1.27-1.52-1.42-1.77-.15-.26-.02-.4.11-.52.12-.12.25-.31.37-.46.13-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.12-.57-1.37-.78-1.87-.2-.49-.41-.42-.57-.43h-.48c-.16 0-.42.06-.64.3-.22.25-.85.83-.85 2.03s.87 2.35.99 2.52c.13.17 1.7 2.6 4.12 3.64.57.25 1.02.4 1.37.52.58.18 1.1.16 1.52.1.46-.07 1.48-.6 1.69-1.17.21-.58.21-1.08.15-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

const navItems = [
  { href: "/", label: "Home" },
  { href: "/collection", label: "Collection" },
  { href: "/about", label: "About Us" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

const currentYear = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="bg-primary px-6 pb-12 pt-24 text-primary-foreground md:px-12 lg:px-24">
      <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="mb-6 flex items-center gap-4">
            <Image
              src="/images/vijay-trivedi-logo.webp"
              alt="Trivedi Marbles logo"
              width={72}
              height={72}
              className="h-12 w-12 shrink-0 object-contain md:h-14 md:w-14"
            />
            <h2 className="text-3xl font-serif font-bold uppercase tracking-wider text-white">
              Trivedi Marbles Pvt. Ltd.
            </h2>
          </div>
          <p className="mb-8 max-w-sm leading-relaxed text-stone-300">
            Legacy marble company since 1949, offering premium natural stone,
            high-quality marble slabs, and bulk supply for architects, builders,
            and luxury home projects.
          </p>
          <div className="flex gap-4">
            <a
              href="https://www.instagram.com/trivedimarblespvtltd/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E4405F] text-white"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://www.facebook.com/people/Trivedi-Marbles-Pvt-Ltd/61574830686371/#"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] text-white"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://www.linkedin.com/company/trivedi-marbles-private-limited"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A66C2] text-white"
            >
              <LinkedinIcon />
            </a>
            <a
              href="https://wa.me/919099996869"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white"
            >
              <WhatsAppIcon />
            </a>
          </div>
        </div>

        <div>
          <h4 className="mb-6 text-lg font-serif text-white">Quick Links</h4>
          <ul className="space-y-4 text-stone-300">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-secondary">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-6 text-lg font-serif text-white">Contact</h4>
          <address className="not-italic space-y-4 text-stone-300">
            <p>
              S.No.: 698/4, Ognaj,
              <br />
              Opp. Vasant Nagar Township,
              <br />
              Gota-Vadsar Road, Ahmedabad-380060,
              <br />
              Gujarat, INDIA.
            </p>
            <p>info@trivedigranimarmo.com</p>
            <p>+91 90999 96869</p>
          </address>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 text-sm text-stone-400 md:flex-row">
        <p>&copy; {currentYear} Trivedi Marbles. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-white">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
