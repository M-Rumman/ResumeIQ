interface StaticPageSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function StaticPageSection({ title, children }: StaticPageSectionProps) {
  return (
    <section className="border-b border-[rgba(255,255,255,0.35)] pb-6 last:border-0 last:pb-0">
      <h2 className="text-base sm:text-lg font-bold text-primary mb-3">{title}</h2>
      <div className="static-page-body space-y-3 text-sm sm:text-base text-primary leading-relaxed">{children}</div>
    </section>
  );
}
