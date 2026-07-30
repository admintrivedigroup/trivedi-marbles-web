import { notFound } from "next/navigation";

/**
 * Single on/off switch for the whole Room/Product Visualizer feature.
 * Unset (or any value other than "true") 404s the entire /visualizer route —
 * this is the one place to flip to remove the feature from the live site
 * without deleting code.
 */
export default function VisualizerLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_VISUALIZER_ENABLED !== "true") {
    notFound();
  }

  return children;
}
