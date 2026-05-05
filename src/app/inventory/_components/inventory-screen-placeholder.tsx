type InventoryScreenPanel = {
  description: string;
  label: string;
  value: string;
};

type InventoryScreenPlaceholderProps = {
  description: string;
  eyebrow: string;
  panels: InventoryScreenPanel[];
  title: string;
};

export function InventoryScreenPlaceholder({
  description,
  eyebrow,
  panels,
  title,
}: InventoryScreenPlaceholderProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-stone-200/80 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(28,20,10,0.05)] sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          {eyebrow}
        </p>
        <div className="mt-4 space-y-3">
          <h2 className="font-serif text-3xl leading-tight text-stone-950 sm:text-4xl">
            {title}
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-stone-600 sm:text-base">
            {description}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {panels.map((panel) => (
          <article
            key={panel.label}
            className="rounded-[1.75rem] border border-stone-200/80 bg-white px-5 py-6 shadow-[0_16px_40px_rgba(28,20,10,0.04)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              {panel.label}
            </p>
            <h3 className="mt-4 text-xl font-semibold text-stone-950">
              {panel.value}
            </h3>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              {panel.description}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
