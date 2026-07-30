import VisualizerClient from "./_components/VisualizerClient";

export const metadata = {
  title: "Room Visualizer | Trivedi Marbles",
  robots: { index: false, follow: false },
};

export default function VisualizerPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
        Room Visualizer
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground/70">
        Upload a photo of your room, tap the floor, and pick a slab to preview how it looks in place.
      </p>
      <div className="mt-8">
        <VisualizerClient />
      </div>
    </main>
  );
}
