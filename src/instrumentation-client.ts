let _bar: HTMLElement | null = null;
let _overlay: HTMLElement | null = null;
let _raf: number | null = null;

function getBar(): HTMLElement {
  if (_bar) return _bar;
  const el = document.createElement("div");
  el.id = "__nav-bar";
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    "position:fixed;top:0;left:0;right:0;height:2px;background:#111827;" +
    "z-index:99999;pointer-events:none;opacity:0;width:0%;will-change:width,opacity;";
  document.documentElement.appendChild(el);
  _bar = el;
  return el;
}

function getOverlay(): HTMLElement {
  if (_overlay) return _overlay;

  const overlay = document.createElement("div");
  overlay.id = "__nav-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99998;display:none;" +
    "align-items:center;justify-content:center;" +
    "background:rgba(255,255,255,0.45);backdrop-filter:blur(1px);";

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "52");
  svg.setAttribute("height", "52");
  svg.setAttribute("viewBox", "0 0 100 100");

  const NUM = 12;
  const DUR = 1.2;
  for (let i = 0; i < NUM; i++) {
    const angle = (i * 360) / NUM;
    const delay = -((NUM - 1 - i) * DUR) / NUM;
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", "46.5");
    rect.setAttribute("y", "8");
    rect.setAttribute("width", "7");
    rect.setAttribute("height", "22");
    rect.setAttribute("rx", "3.5");
    rect.setAttribute("fill", "#111827");
    rect.setAttribute("transform", `rotate(${angle},50,50)`);
    rect.style.animation = `spinner-fade ${DUR}s linear infinite`;
    rect.style.animationDelay = `${delay}s`;
    svg.appendChild(rect);
  }

  overlay.appendChild(svg);
  document.documentElement.appendChild(overlay);
  _overlay = overlay;
  return overlay;
}

export function onRouterTransitionStart(url: string) {
  const currentUrl = window.location.pathname + window.location.search;
  if (url === currentUrl) return;

  const bar = getBar();
  const overlay = getOverlay();

  if (_raf !== null) {
    cancelAnimationFrame(_raf);
    _raf = null;
  }

  bar.style.transition = "none";
  bar.style.opacity = "1";
  bar.style.width = "0%";
  overlay.style.display = "flex";

  _raf = requestAnimationFrame(() => {
    _raf = null;
    bar.style.transition = "width 8s cubic-bezier(0.05, 0.5, 0.2, 1)";
    bar.style.width = "90%";
  });
}
