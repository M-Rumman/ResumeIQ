import { ArrowLeft, CalendarDays, Clock3, List, Tag } from 'lucide-react';
import { getBlogArticle } from '../lib/blogData';
import { buildBlogArticleStructuredDataGraph } from '../lib/seo/structuredData';
import BlogInternalLinks from '../components/BlogInternalLinks';
import SEO from '../components/SEO';

interface BlogArticlePageProps { slug: string; onBack: () => void; onNavigate: (page: string) => void; }

function headingId(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function BlogArticlePage({ slug, onBack, onNavigate }: BlogArticlePageProps) {
  const article = getBlogArticle(slug);
  if (!article) return <div className="mx-auto max-w-3xl px-4 py-24 text-center"><h1 className="font-display text-3xl font-extrabold text-ink">Article not found</h1><button type="button" onClick={onBack} className="mt-6 text-sm font-bold text-[#65789c]">Return to Career Resources</button></div>;
  const content = article.content ?? [{ paragraphs: ['This ResuV resource is designed to help you make practical, evidence-based career decisions. Use the ideas here alongside your own experience and the specific role you are applying for.', 'Focus on clear examples, truthful technical detail, and the requirements that matter most for the position. Small improvements in clarity can make it much easier for a recruiter to understand your fit.'] }];
  const tableOfContents = content.filter((section) => Boolean(section.heading)).map((section) => section.heading as string);

  return <>
    <SEO metadata={{ title: article.metaTitle, description: article.metaDescription, canonicalPath: `/blog/${article.slug}`, noindex: false, image: article.coverImage, openGraphTitle: article.title, openGraphType: 'article' }} structuredData={buildBlogArticleStructuredDataGraph(article)} />
    <article className="min-h-screen bg-[#f8fafc] pb-20">
      <div className="mx-auto max-w-4xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-[#526586] transition hover:text-ink"><ArrowLeft className="h-4 w-4" />All articles</button>
        <p className="mt-12 text-sm font-bold uppercase tracking-[0.16em] text-[#65789c]">{article.category}</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-ink sm:text-6xl">{article.title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-secondary">{article.excerpt}</p>
        <div className="mt-8 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span className="font-bold text-ink">By {article.author.name}</span><span>•</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{article.publishDate}</span><span>•</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{article.readingTime}</span>
        </div>
        <img src={article.coverImage} alt={article.title} loading="eager" fetchPriority="high" className="mt-10 aspect-[16/8] w-full rounded-[28px] object-cover shadow-[0_15px_40px_rgba(40,55,75,0.12)]" />
        {tableOfContents.length > 1 && <nav aria-label="Table of contents" className="mx-auto mt-10 max-w-3xl rounded-2xl border border-[#dce3ed] bg-white p-5"><div className="flex items-center gap-2 text-sm font-extrabold text-ink"><List className="h-4 w-4" />Table of contents</div><ol className="mt-3 grid gap-1 text-sm text-[#526586] sm:grid-cols-2">{tableOfContents.map((heading) => <li key={heading}><a className="hover:text-ink hover:underline" href={`#${headingId(heading)}`}>{heading}</a></li>)}</ol></nav>}
        <div className="mx-auto mt-12 max-w-3xl space-y-10 text-[1.05rem] leading-8 text-ink-secondary">
          {content.map((section, index) => <section key={`${section.heading ?? section.subheading ?? 'intro'}-${index}`} className="space-y-4">
            {section.heading && <h2 id={headingId(section.heading)} className="scroll-mt-8 font-display text-2xl font-extrabold leading-tight text-ink sm:text-3xl">{section.heading}</h2>}
            {section.subheading && <h3 className="font-display text-xl font-extrabold leading-tight text-ink">{section.subheading}</h3>}
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.callout && <aside className="rounded-2xl border-l-4 border-[#65789c] bg-[rgba(132,149,184,0.10)] px-5 py-4 text-base font-medium leading-7 text-ink">{section.callout}</aside>}
            {section.code && <pre className="overflow-x-auto rounded-2xl bg-[#202b38] p-5 text-sm leading-7 text-slate-100 shadow-inner"><code>{section.code}</code></pre>}
            {section.numbered && <ol className="list-decimal space-y-2 pl-6 marker:font-bold marker:text-[#65789c]">{section.numbered.map((item) => <li key={item}>{item}</li>)}</ol>}
            {section.bullets && <ul className="space-y-2">{section.bullets.map((item) => <li key={item} className="flex gap-3"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8495b8]" />{item}</li>)}</ul>}
          </section>)}
          <div className="flex flex-wrap gap-2 pt-4">{article.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[rgba(132,149,184,0.12)] px-3 py-1.5 text-xs font-bold text-[#526586]"><Tag className="h-3 w-3" />{tag}</span>)}</div>
        </div>
        <BlogInternalLinks article={article} onNavigate={onNavigate} />
      </div>
    </article>
  </>;
}
