import Link from "next/link";

/**
 * Optional nav entry for the Room/Product Visualizer feature.
 * Not wired into Navbar.tsx — that file is existing code and wasn't touched
 * by this feature. Drop `<VisualizerNavLink />` into the nav items yourself
 * if/when you want it linked; the route already works at /visualizer either way.
 * Renders nothing when the feature flag is off, so it's a no-op if left in
 * place after adding it.
 */
export default function VisualizerNavLink() {
  if (process.env.NEXT_PUBLIC_VISUALIZER_ENABLED !== "true") return null;

  return (
    <Link
      href="/visualizer"
      className="text-[0.68rem] font-medium uppercase tracking-[0.14em] transition-colors hover:text-secondary 2xl:text-sm"
    >
      Visualizer
    </Link>
  );
}
