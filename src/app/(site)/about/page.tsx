"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Quote } from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";

const mining =
  "https://images.unsplash.com/photo-1772543983082-a8a8051ab612?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9uZSUyMG1pbmluZyUyMHF1YXJyeSUyMG1hY2hpbmVyeXxlbnwxfHx8fDE3NzUyMDEyMzV8MA&ixlib=rb-4.1.0&q=80&w=1080";
const factory = "/images/Group.webp";

const milestones = [
  {
    year: "1948",
    title: "The Vision Begins (A Legacy is Born)",
    desc: "Founded by Late Shri Dalchand Khushaldas Trivedi with a mission to restore India’s temple heritage and revive traditional craftsmanship.",
  },
  {
    year: "1949",
    title: "Discovery of Ambaji Marble",
    desc: "A Historic Breakthrough - Identified and established the Ambaji marble quarry, reviving the original marble used in iconic temples like Dilwara and Ranakpur.",
  },
  {
    year: "1984",
    title: "Formalization & Growth",
    desc: "Trivedi Marbles Pvt. Ltd. Established - Transitioned into an organized enterprise, becoming a trusted name in premium Ambaji White marble and expanding operations.",
  },
  {
    year: "2026",
    title: "Modern Era — Advanced Manufacturing & Leadership",
    desc: "Innovation Meets Excellence - Built state-of-the-art manufacturing facilities in Ambaji, delivering export-quality marble with global standards and precision.",
  },
];

export default function AboutPage() {
  const introRef = useRef<HTMLElement | null>(null);
  const storyRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress: introProgress } = useScroll({
    target: introRef,
    offset: ["start start", "end start"],
  });
  const { scrollYProgress: storyProgress } = useScroll({
    target: storyRef,
    offset: ["start end", "end start"],
  });

  const introImageScale = useTransform(introProgress, [0, 1], [1, 1.12]);
  const introImageY = useTransform(introProgress, [0, 1], ["0%", "18%"]);
  const introContentY = useTransform(introProgress, [0, 1], ["0%", "26%"]);
  const introContentOpacity = useTransform(introProgress, [0, 0.75], [1, 0]);

  const storyOverlayOpacity = useTransform(storyProgress, [0, 0.45, 1], [0.72, 0.45, 0.7]);
  const storyContentY = useTransform(storyProgress, [0, 1], ["10%", "-10%"]);
  const storyImageY = useTransform(storyProgress, [0, 1], ["8%", "-8%"]);

  return (
    <div className="min-h-screen w-full bg-background">
      <section
        ref={introRef}
        className="relative flex h-[60vh] items-center justify-center overflow-hidden bg-primary"
      >
        <motion.div
          style={{ scale: introImageScale, y: introImageY }}
          className="absolute inset-0 opacity-40 mix-blend-overlay"
        >
          <img
            src={mining}
            alt="Trivedi mining"
            className="h-full w-full object-cover grayscale"
          />
        </motion.div>
        <motion.div
          style={{ y: introContentY, opacity: introContentOpacity }}
          className="relative z-10 px-6 text-center"
        >
          <FadeIn>
            <span className="mb-6 block text-sm font-medium uppercase tracking-[0.3em] text-secondary">
              Since 1949
            </span>
            <h1 className="mx-auto max-w-4xl font-serif text-5xl leading-tight text-white md:text-7xl">
              A Legacy Carved in Stone
            </h1>
          </FadeIn>
        </motion.div>
      </section>

      <section
        ref={storyRef}
        data-about-video-hero
        className="relative min-h-[900px] overflow-hidden"
      >
        <div className="absolute inset-0 overflow-hidden">
          <motion.video
            style={{ y: storyImageY }}
            className="absolute -inset-y-24 inset-x-0 h-[calc(100%+12rem)] w-full object-cover object-[center_40%]"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src="/videos/bg_video.webm" type="video/webm" />
          </motion.video>
        </div>
        <motion.div
          style={{ opacity: storyOverlayOpacity }}
          className="absolute inset-0 bg-white"
        />

        <motion.div
          style={{ y: storyContentY }}
          className="relative flex min-h-[900px] items-center justify-center px-6 py-24 md:px-12 lg:px-24"
        >
          <div className="grid w-full max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-16">
            <FadeIn className="h-full">
              <div className="mx-auto flex h-full max-w-xl flex-col justify-center space-y-6 rounded-[28px] border border-white/40 bg-white/72 p-8 text-center text-lg leading-relaxed text-stone-900 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-md md:p-10 md:text-left">
                <div className="space-y-3">
                  <span className="block text-sm font-medium uppercase tracking-[0.28em] text-stone-500">
                    Our Story
                  </span>
                </div>
                <p>
                  Our journey was started by late Mr. Dalcharam Khushaldas Trivedi, who was a visionary temple architect. He wanted to restore the ancient temple heritage of India. He renovated the ancient and well-known Indian temples at Ranakpur in Gujarat and Delwara in Rajasthan. He discovered and founded the quarry in the year 1949, in a small town of Ambaji, which today is well known as D.K. Trivedi & Sons Quarry.
                </p>
                <p>
                  Our commitment to uncompromising quality and ethical mining
                  practices has established us as the premier choice for architects,
                  builders, and designers crafting the world&apos;s most luxurious spaces.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.2} className="mx-auto w-full max-w-2xl">
              <div className="space-y-6">
                <div className="overflow-hidden rounded-[28px] shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
                  <img
                    src={factory}
                    alt="Trivedi factory"
                    className="h-auto w-full object-cover"
                  />
                </div>
                <div className="mx-auto max-w-md rounded-[24px] border border-white/50 bg-white/90 p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-sm lg:relative lg:left-0 lg:-mt-14">
                  <Quote className="mx-auto mb-4 h-8 w-8 text-secondary opacity-60" />
                  <p className="mx-auto max-w-[240px] font-serif text-lg italic leading-relaxed text-primary">
                  &quot;Every slab we produce is a testament to the earth&apos;s history and
                  our dedication to perfection.&quot;
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </motion.div>
      </section>

      <section className="bg-primary px-6 py-32 text-white">
        <div className="mx-auto max-w-4xl">
          <FadeIn className="mb-24 text-center">
            <h2 className="mb-6 font-serif text-4xl">Our Journey</h2>
            <div className="mx-auto h-1 w-16 bg-secondary" />
          </FadeIn>

          <div className="relative space-y-24 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-white/20 before:to-transparent md:before:mx-auto md:before:translate-x-0">
            {milestones.map((milestone, index) => (
              <FadeIn
                key={milestone.year}
                delay={index * 0.1}
                className="group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse"
              >
                <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-secondary bg-primary text-xs text-secondary shadow md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  ✦
                </div>
                <div className="w-[calc(100%-4rem)] rounded p-4 text-left md:w-[calc(50%-3rem)] md:group-odd:text-right">
                  <div className="mb-2 flex items-center justify-between md:justify-normal md:group-odd:flex-row-reverse">
                    <span className="font-serif text-3xl text-secondary">
                      {milestone.year}
                    </span>
                  </div>
                  <h3 className="mb-2 font-serif text-xl">{milestone.title}</h3>
                  <p className="leading-relaxed text-white/60">{milestone.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
