"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Anchor,
  CheckCircle,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import { marbles, signatureProjects } from "@/data/marbles";

const heroBg = "/images/PXL_20220107_073430232_2-scaled.webp";
const livingRoom =
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const hotelLobby =
  "https://images.unsplash.com/photo-1723108263618-5364ae353220?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBob3RlbCUyMGxvYmJ5JTIwbWFyYmxlfGVufDF8fHx8MTc3NTIwMTIzNXww&ixlib=rb-4.1.0&q=80&w=1080";
const bathroom =
  "https://images.unsplash.com/photo-1658760046471-896cbc719c9d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtYXJibGUlMjBiYXRocm9vbXxlbnwxfHx8fDE3NzUyMDEyMzV8MA&ixlib=rb-4.1.0&q=80&w=1080";
const staircase =
  "https://images.unsplash.com/photo-1764140161730-f69f2db93b1b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXJibGUlMjBzdGFpcmNhc2UlMjBsdXh1cnl8ZW58MXx8fHwxNzc1MjAxMjM1fDA&ixlib=rb-4.1.0&q=80&w=1080";
const mining =
  "https://images.unsplash.com/photo-1772543983082-a8a8051ab612?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9uZSUyMG1pbmluZyUyMHF1YXJyeSUyMG1hY2hpbmVyeXxlbnwxfHx8fDE3NzUyMDEyMzV8MA&ixlib=rb-4.1.0&q=80&w=1080";
const architecture = "/images/ourheritage_home.webp";
const premiumMarbles = marbles.slice(0, 3);
const gridMarbles = marbles.slice(3, 6);

const trustItems = [
  { icon: ShieldCheck, title: "Since 1949" },
  { icon: Anchor, title: "Own Mining" },
  { icon: CheckCircle, title: "Premium Quality" },
  { icon: TrendingUp, title: "Bulk Supply" },
];

const applications = [
  { title: "Living Spaces", img: livingRoom },
  { title: "Hotels & Lobbies", img: hotelLobby },
  { title: "Luxurious Baths", img: bathroom },
  { title: "Grand Staircases", img: staircase },
];

const testimonials = [
  {
    text: "The Moment we saw this exquisite marble from Trivedi Marbles Pvt. Ltd, We knew it was perfect for our home. The natural veining, smooth finish, and elegant design have transformed our entrance into a work of art. Impeccable craftsmanship!",
    author: "SHRI CHAKRAVATI PATEL",
    role: "Ahmedabad, Gujarat",
    image: "/images/ChakravatiPatelReview.webp",
  },
  {
    text: "I had a great experience with D.K. Trivedi Marbles. The quality of the white marble stones was excellent—truly premium, with a flawless finish and consistent texture. Their service was just as impressive—prompt, professional, and very customer-friendly. Highly recommend them for anyone looking for top-quality marble and reliable service. Keep up the great work!",
    author: "KRUSHAB PATEL",
    role: "Ahmedabad, Gujarat",
    image: "/images/KrushabhPatelReview.webp",
  },
  {
    text: "While building our traditional heritage-style home, we chose DK Trivedi Marbles for their exceptional quality and commitment to industry standards—something rare today; their team was supportive and helped us select the right marble for every space through multiple visits, and their expertise, professionalism, and the beautiful texture and luster of their marble truly elevated our home.",
    author: "SHRI NIKIN PANCHAL",
    role: "AHMEDABAD, GUJARAT",
    image: "/images/NikinPanchalReview.webp",
  },
];

export default function Hero() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div className="relative w-full bg-background">
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 z-0">
          <img
            src={heroBg}
            alt="Luxury marble background"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-primary/60 backdrop-blur-[2px]" />
        </motion.div>

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-6 font-serif text-4xl leading-tight text-white sm:text-5xl md:text-7xl"
          >
            Premium Marble, Crafted by Nature, Perfected by Trivedi&apos;s.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mb-10 max-w-2xl text-base font-normal text-white/90 sm:text-lg md:text-xl"
          >
            A legacy of curating the finest natural stone for architectural masterpieces
            since 1949.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.2 }}
            className="flex w-full max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:justify-center sm:gap-6"
          >
            <Link
              href="/collection"
              className="bg-white px-8 py-4 text-center text-sm uppercase tracking-widest text-primary transition-colors duration-300 hover:bg-secondary hover:text-white"
            >
              Explore Collection
            </Link>
            <Link
              href="/contact"
              className="border-2 border-white bg-black/20 px-8 py-4 text-center text-sm font-medium uppercase tracking-widest !text-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)] backdrop-blur-sm transition-colors duration-300 hover:bg-white hover:!text-primary"
            >
              Get a Quote
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="bg-primary px-6 py-12 text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 divide-x divide-white/10 md:grid-cols-4">
          {trustItems.map((item, index) => {
            const Icon = item.icon;

            return (
              <FadeIn
                key={item.title}
                delay={index * 0.1}
                className="flex flex-col items-center px-4 text-center"
              >
                <Icon className="mb-3 h-6 w-6 text-secondary" />
                <h3 className="text-sm font-medium uppercase tracking-widest">
                  {item.title}
                </h3>
              </FadeIn>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-6 py-32 md:px-12 lg:px-24">
        <FadeIn>
          <div className="mb-24 text-center md:text-left">
            <h2 className="mb-6 font-serif text-5xl text-primary md:text-6xl">
              Curated Collection
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-[#6f6258]">
              Discover our most sought-after marble slabs, hand-selected for
              unparalleled beauty and strength.
            </p>
          </div>
        </FadeIn>

        <div className="mb-32 flex flex-col gap-32 md:gap-48">
          {premiumMarbles.map((marble, index) => {
            const reverse = index % 2 !== 0;

            return (
              <motion.div
                key={marble.id}
                initial={{ opacity: 0, y: 100 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-15%" }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                className={`flex flex-col items-center gap-12 md:gap-24 ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}
              >
                <div className="group relative aspect-[3/4] w-full overflow-hidden bg-gray-100 shadow-xl md:w-1/2 md:aspect-[4/5]">
                  <img
                    src={marble.image}
                    alt={marble.name}
                    className="h-full w-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
                </div>
                <div className="flex w-full flex-col justify-center py-8 md:w-1/2">
                  <span className="mb-4 text-sm uppercase tracking-[0.2em] text-secondary">
                    0{index + 1} / Signature
                  </span>
                  <h3 className="mb-6 font-serif text-4xl text-primary md:text-5xl">
                    {marble.name}
                  </h3>
                  <p className="mb-10 text-lg leading-relaxed text-[#5f554d]">
                    {marble.description}
                  </p>
                  <Link
                    href={`/collection/${marble.id}`}
                    className="inline-flex w-max items-center gap-2 border-b border-primary pb-1 text-sm uppercase tracking-widest transition-all hover:border-secondary hover:text-secondary"
                  >
                    View Details
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="my-32 h-px w-full bg-border/40" />

        <div className="mb-16 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <h3 className="font-serif text-3xl text-primary md:text-4xl">
            More from the Collection
          </h3>
          <Link
            href="/collection"
            className="w-max border-b border-primary pb-1 text-sm uppercase tracking-widest transition-colors hover:border-secondary hover:text-secondary"
          >
            View All
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12 lg:grid-cols-3">
          {gridMarbles.map((marble, index) => (
            <FadeIn key={marble.id} delay={index * 0.15}>
              <Link href={`/collection/${marble.id}`} className="group block h-full">
                <div className="relative mb-6 aspect-[4/5] overflow-hidden bg-gray-100 transition-shadow duration-500 group-hover:shadow-2xl">
                  <img
                    src={marble.image}
                    alt={marble.name}
                    className="h-full w-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-black/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
                <h4 className="mb-2 font-serif text-2xl text-primary">{marble.name}</h4>
                <p className="text-sm leading-relaxed text-[#6f6258]">
                  {marble.description}
                </p>
              </Link>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-white py-24">
        <div className="absolute right-0 top-0 hidden h-full w-1/3 bg-primary/5 lg:block" />
        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2 lg:px-12">
          <FadeIn>
            <div className="relative aspect-square">
              <img
                src={mining}
                alt="Trivedi mining operations"
                className="h-full w-full object-cover shadow-2xl"
              />
              <div className="absolute -bottom-8 -right-8 hidden aspect-[4/3] w-2/3 border-8 border-white bg-gray-200 md:block">
                <img
                  src={architecture}
                  alt="Luxury architecture"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.2} className="lg:pl-12">
            <span className="mb-4 block text-sm font-medium uppercase tracking-[0.2em] text-secondary">
              Our Heritage
            </span>
            <h2 className="mb-6 font-serif text-4xl leading-tight text-primary md:text-5xl">
              Mastering the Art of Stone Since 1949
            </h2>
            <p className="mb-6 leading-relaxed text-[#74685d]">
              Incorporated in 1984 , Trivedi Marbles Pvt. Ltd. is reckoned as a trusted name in the marble sector. We have been offering high-quality Ambaji White to our clients since our inception and recently have expanded our product portfolio to include new & exotic materials from the quarry of D.K. Trivedi & Sons.
            </p>
            <p className="mb-10 leading-relaxed text-[#74685d]">
              Trivedi Marbles, along with its sister concerns M/s. Trivedi Marmo and M/s. D.K.Trivedi Marbles has its manufacturing and wholesaling facility in Ambaji, and a retail outlet in Ahmedabad, Gujarat (India).
            </p>
            <Link
              href="/about"
              className="inline-block bg-primary px-8 py-4 text-sm uppercase tracking-widest !text-white transition-colors duration-300 hover:bg-secondary hover:!text-white"
            >
              Discover Our Story
            </Link>
          </FadeIn>
        </div>
      </section>

      <section className="bg-primary px-6 py-24 text-white md:px-12 lg:px-24">
        <FadeIn className="mb-16 text-center">
          <h2 className="mb-6 font-serif text-4xl md:text-5xl">
            Endless Possibilities
          </h2>
          <p className="mx-auto max-w-2xl text-white/60">
            Transform spaces into timeless works of art with our versatile marble
            applications.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {applications.map((app, index) => (
            <FadeIn key={app.title} delay={index * 0.1}>
              <div className="group relative aspect-[4/5] cursor-pointer overflow-hidden">
                <img
                  src={app.img}
                  alt={app.title}
                  className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <h3 className="absolute bottom-6 left-6 font-serif text-xl tracking-wide">
                  {app.title}
                </h3>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl bg-background px-6 py-24 md:px-12 lg:px-24">
        <FadeIn className="mb-16">
          <h2 className="mb-4 text-center font-serif text-4xl text-primary md:text-5xl">
            Signature Gallery
          </h2>
          <p className="mx-auto max-w-2xl text-center text-[#6f6258]">
            A glimpse into the architectural marvels born from Trivedi Marbles.
          </p>
        </FadeIn>

        <div className="columns-1 gap-6 space-y-6 md:columns-2 lg:columns-3">
          {signatureProjects.map((project, index) => (
            <FadeIn
              key={project.id}
              delay={(index % 3) * 0.1}
              className="break-inside-avoid"
            >
              <div
                className={project.heightClassName ? `${project.heightClassName} overflow-hidden` : "overflow-hidden"}
              >
                <img
                  src={project.image}
                  alt={project.imageAlt}
                  className={`block w-full cursor-pointer object-cover transition-transform duration-700 hover:scale-105 ${
                    project.heightClassName ? "h-full" : ""
                  }`}
                />
              </div>
              <div className="mt-4 px-1">
                <p className="font-serif text-xl text-[#C9A24A]">
                  {project.title}
                </p>
                <p className="mt-1 text-sm uppercase tracking-wider text-[#7a6b5f]">
                  {project.location}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/projects"
            className="inline-block border border-primary px-10 py-4 text-sm uppercase tracking-widest text-primary transition-colors duration-300 hover:bg-primary hover:!text-white"
          >
            View All Projects
          </Link>
        </div>
      </section>

      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="mb-16 text-center">
            <h2 className="font-serif text-4xl text-primary">Words of Trust</h2>
          </FadeIn>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <FadeIn
                key={testimonial.author}
                delay={index * 0.2}
                className="flex flex-col items-center text-center"
              >
                {testimonial.image ? (
                  <img
                    src={testimonial.image}
                    alt={testimonial.author}
                    className="mb-8 h-32 w-32 rounded-full object-cover shadow-sm"
                  />
                ) : (
                  <div className="mb-8 font-serif text-7xl leading-none text-secondary">
                    &quot;
                  </div>
                )}
                <p className="mb-8 flex-grow text-lg italic text-[#5f554d]">
                  &quot;{testimonial.text}&quot;
                </p>
                <div>
                  <h4 className="font-serif text-xl text-primary">
                    {testimonial.author}
                  </h4>
                  <span className="text-sm uppercase tracking-wider text-[#7a6b5f]">
                    {testimonial.role}
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center overflow-hidden px-6 py-32 text-center">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="Marble background CTA" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-primary/90" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl">
          <FadeIn>
            <h2 className="mb-8 font-serif text-4xl leading-tight text-white md:text-5xl">
              Looking for the perfect marble for your project?
            </h2>
            <div className="flex flex-col justify-center gap-6 sm:flex-row">
              <Link
                href="/collection"
                className="bg-white px-10 py-4 text-sm uppercase tracking-widest text-primary transition-colors duration-300 hover:bg-secondary hover:text-white"
              >
                Request Catalog
              </Link>
              <Link
                href="/contact"
                className="border border-white/80 bg-white/12 px-10 py-4 text-sm font-medium uppercase tracking-widest !text-white shadow-[0_12px_30px_rgba(0,0,0,0.2)] backdrop-blur-sm transition-colors duration-300 hover:bg-white hover:!text-black"
              >
                Contact Us
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
