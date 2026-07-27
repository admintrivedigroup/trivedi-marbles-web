import { PRIVATE_ROBOTS } from "@/lib/seo";
import { CombinedVisualizerClient } from "./_components/CombinedVisualizerClient";

export const metadata = {
  title:  "Combined Visualizer Test — Research Lab",
  robots: PRIVATE_ROBOTS,
};

export default function CombinedVisualizerPage() {
  return <CombinedVisualizerClient />;
}
