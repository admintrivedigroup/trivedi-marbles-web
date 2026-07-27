import { PRIVATE_ROBOTS } from "@/lib/seo";
import { BenchmarkClient } from "./_components/BenchmarkClient";

export const metadata = {
  title:  "Depth Estimation Benchmark — Research Lab",
  robots: PRIVATE_ROBOTS,
};

export default function DepthBenchmarkPage() {
  return <BenchmarkClient />;
}
