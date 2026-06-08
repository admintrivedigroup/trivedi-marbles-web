import Image from "next/image";

import { FadeIn } from "@/components/animations/FadeIn";
import { signatureProjects } from "@/data/marbles";

export default function ProjectsPage() {
  return (
    <section className="mx-auto max-w-screen-2xl px-6 pb-24 pt-32 md:px-12 lg:px-24">
      <FadeIn>
        <p className="text-sm uppercase tracking-[0.3em] text-accent">Projects</p>
        <h1 className="mt-6 font-serif text-5xl text-primary md:text-6xl">
          Signature Projects
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          A curated view of the landmark spaces and temple architecture showcased in
          our signature gallery.
        </p>
      </FadeIn>

      <div className="mt-16 columns-1 gap-6 space-y-6 md:columns-2 lg:columns-3">
        {signatureProjects.map((project, index) => (
          <FadeIn
            key={project.id}
            direction="scale"
            delay={(index % 3) * 0.1}
            className="break-inside-avoid"
          >
            <article>
              <div
                className={project.heightClassName ? `${project.heightClassName} overflow-hidden` : "overflow-hidden"}
              >
                <Image
                  src={project.image}
                  alt={project.imageAlt}
                  width={1200}
                  height={900}
                  className={`block w-full object-cover transition-transform duration-700 hover:scale-105 ${
                    project.heightClassName ? "h-full" : "h-auto"
                  }`}
                />
              </div>
              <div className="mt-4 px-1">
                <h2 className="font-serif text-xl text-secondary">{project.title}</h2>
                <p className="mt-1 text-sm uppercase tracking-wider text-muted-foreground">
                  {project.location}
                </p>
              </div>
            </article>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
