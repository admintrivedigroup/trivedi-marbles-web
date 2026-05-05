"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/collection", label: "Collection" },
  { href: "/about", label: "About Us" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAboutVideoActive, setIsAboutVideoActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHome = pathname === "/";
  const isAbout = pathname === "/about";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileMenuOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!isAbout) {
      const frame = window.requestAnimationFrame(() => {
        setIsAboutVideoActive(false);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    let frame = 0;

    const handleAboutHeroState = () => {
      frame = 0;

      const aboutVideoHero = document.querySelector<HTMLElement>("[data-about-video-hero]");

      if (!aboutVideoHero) {
        setIsAboutVideoActive(false);
        return;
      }

      const rect = aboutVideoHero.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const isActive = rect.top <= 96 && rect.bottom >= viewportHeight * 0.35;

      setIsAboutVideoActive(isActive);
    };

    const queueAboutHeroState = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(handleAboutHeroState);
    };

    queueAboutHeroState();
    window.addEventListener("scroll", queueAboutHeroState, { passive: true });
    window.addEventListener("resize", queueAboutHeroState);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", queueAboutHeroState);
      window.removeEventListener("resize", queueAboutHeroState);
    };
  }, [isAbout]);

  const showSolidNavbar = (isScrolled || !isHome) && !isAboutVideoActive;

  return (
    <>
      <nav
        className={cn(
          "fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 px-4 py-0 md:px-8 md:py-0 lg:px-12 xl:px-20 2xl:px-24",
          showSolidNavbar
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-transparent text-white",
        )}
      >
        <Link
          href="/"
          className="flex min-w-0 flex-1 items-center gap-1 font-serif font-bold uppercase tracking-[0.04em] sm:gap-1.5 lg:gap-2"
        >
          <div className="flex h-9 w-[3.2rem] shrink-0 items-center justify-center sm:h-10 sm:w-[3.6rem] lg:h-12 lg:w-[4.2rem] xl:h-14 xl:w-[5rem]">
            <Image
              src="/images/vijay-trivedi-logo.webp"
              alt="Trivedi Marbles logo"
              width={72}
              height={72}
              className="h-9 w-9 object-contain sm:h-10 sm:w-10 lg:h-12 lg:w-12 xl:h-14 xl:w-14"
            />
          </div>
          <span className="min-w-0 truncate text-[clamp(0.62rem,1.15vw,0.9rem)] leading-none tracking-[0.08em] sm:text-[clamp(0.68rem,1vw,0.95rem)] lg:text-[clamp(0.72rem,0.82vw,1rem)] xl:text-[clamp(0.78rem,0.75vw,1.1rem)]">
            Trivedi Marbles Pvt. Ltd.
          </span>
        </Link>

        <div
          className={cn(
            "hidden shrink-0 items-center gap-5 transition-all duration-300 xl:flex 2xl:gap-8",
            isAboutVideoActive && "pointer-events-none translate-y-[-8px] opacity-0",
          )}
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[0.68rem] font-medium uppercase tracking-[0.14em] transition-colors hover:text-secondary 2xl:text-sm"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          aria-label="Open navigation menu"
          className={cn(
            "ml-2 shrink-0 p-2 transition-all duration-300 xl:hidden",
            isAboutVideoActive && "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed inset-0 z-[60] flex flex-col bg-primary p-6 text-primary-foreground"
          >
            <div className="mb-12 flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-4 text-2xl font-serif font-bold uppercase tracking-wider"
              >
                <Image
                  src="/images/vijay-trivedi-logo.webp"
                  alt="Trivedi Marbles logo"
                  width={64}
                  height={64}
                  className="h-12 w-12 object-contain"
                />
                <span>Trivedi</span>
              </Link>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-8 w-8" />
              </button>
            </div>
            <div className="flex flex-col items-start gap-6 font-serif text-2xl">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-secondary"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
