import { PRIVATE_ROBOTS } from "@/lib/seo";
import { BenchmarkClient } from "./_components/BenchmarkClient";

export const metadata = {
  title: "CV Benchmark Lab — Debug",
  robots: PRIVATE_ROBOTS,
};

export default function SurfaceBenchmarkPage() {
  return <BenchmarkClient />;
}
