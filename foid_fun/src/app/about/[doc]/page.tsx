// /about/<doc> — every ABOUT.EXE document as its own server-rendered page.
// ABOUT.EXE (/about) stays the in-app Finder; these pages give each doc a
// URL that search engines and AI answer engines can read without running
// JavaScript, a real title and description, and structured data. Same
// TEXTEDIT.EXE look as the in-app reader (about.css).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/app/about/about.css";
import MarkdownLite from "@/components/MarkdownLite";
import { JsonLd } from "@/components/seo/JsonLd";
import { ABOUT_DOCS, type AboutDoc } from "@/content/aboutDocs";
import { faqEntries } from "@/lib/docText";
import { routeMetadata } from "@/lib/routeMetadata";
import { ORG_ID, SITE_URL, WEBSITE_ID } from "@/lib/site";

type Params = { doc: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return ABOUT_DOCS.map((doc) => ({ doc: doc.id }));
}

function findDoc(id: string): { doc: AboutDoc; index: number } | null {
  const index = ABOUT_DOCS.findIndex((doc) => doc.id === id);
  return index === -1 ? null : { doc: ABOUT_DOCS[index], index };
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const found = findDoc(params.doc);
  if (!found) return {};
  // Absolute: the /about layout sets a plain "About" title, which stops the
  // root "%s | FOID.FUN" template from reaching this segment.
  return routeMetadata({
    title: `${found.doc.title} | FOID.FUN`,
    absoluteTitle: true,
    description: found.doc.description,
    path: `/about/${found.doc.id}`,
    card: "about",
    type: "article",
  });
}

const KIND_BADGE = { md: "MD", txt: "TXT" } as const;

export default function AboutDocPage({ params }: { params: Params }) {
  const found = findDoc(params.doc);
  if (!found) notFound();
  const { doc, index } = found;
  const prev = index > 0 ? ABOUT_DOCS[index - 1] : null;
  const next = index < ABOUT_DOCS.length - 1 ? ABOUT_DOCS[index + 1] : null;
  const url = `${SITE_URL}/about/${doc.id}`;
  const faq = doc.id === "faq" ? faqEntries(doc.body) : [];
  // Markdown docs open with their own "# TITLE"; plain-text docs need one.
  const hasOwnHeading = doc.kind === "md" && /^\s*# /.test(doc.body);

  return (
    <main className="about-doc-page">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "TechArticle",
              "@id": `${url}#article`,
              headline: doc.title,
              description: doc.description,
              url,
              mainEntityOfPage: url,
              dateModified: doc.updatedAt,
              inLanguage: "en",
              author: { "@id": ORG_ID },
              publisher: { "@id": ORG_ID },
              isPartOf: { "@id": WEBSITE_ID },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "FOID Foundation", item: `${SITE_URL}/` },
                { "@type": "ListItem", position: 2, name: "About", item: `${SITE_URL}/about` },
                { "@type": "ListItem", position: 3, name: doc.title, item: url },
              ],
            },
            ...(faq.length
              ? [
                  {
                    "@type": "FAQPage",
                    "@id": `${url}#faq`,
                    mainEntity: faq.map((entry) => ({
                      "@type": "Question",
                      name: entry.question,
                      acceptedAnswer: { "@type": "Answer", text: entry.answer },
                    })),
                  },
                ]
              : []),
          ],
        }}
      />

      <article className="vista-window vista-window--terminal about-doc-window" aria-label={doc.title}>
        <div className="about-reader__bar">
          <Link
            href="/about"
            className="vista-window__control vista-window__control--close about-reader__close"
            aria-label="Back to all docs"
            title="All docs"
          />
          <span className="about-reader__name">TEXTEDIT.EXE — {doc.name}</span>
          <span className="about-reader__badge">{KIND_BADGE[doc.kind]}</span>
        </div>

        <div className="about-reader__scroll" tabIndex={0}>
          <nav className="about-doc-crumbs" aria-label="Breadcrumb">
            <Link href="/">FOID</Link>
            <span aria-hidden="true">/</span>
            <Link href="/about">About</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{doc.name}</span>
          </nav>
          {doc.kind === "md" ? (
            <div className="about-reader__doc">
              {!hasOwnHeading && <h1>{doc.title}</h1>}
              <MarkdownLite body={doc.body} />
            </div>
          ) : (
            <>
              <h1 className="about-doc-title">{doc.title}</h1>
              <pre className="about-reader__pre" tabIndex={0} aria-label={`${doc.name} contents`}>{doc.body}</pre>
            </>
          )}
          <p className="about-doc-updated">
            Updated <time dateTime={doc.updatedAt}>{doc.updatedAt}</time>
          </p>
          <nav className="about-doc-index" aria-label="All FOID docs">
            <h2>All docs</h2>
            <ul>
              {ABOUT_DOCS.map((other) => (
                <li key={other.id}>
                  {other.id === doc.id ? (
                    <span aria-current="page">{other.title}</span>
                  ) : (
                    <Link href={`/about/${other.id}`}>{other.title}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="about-reader__footer">
          {prev ? (
            <Link className="about-reader__nav" href={`/about/${prev.id}`} aria-label={`Previous document: ${prev.name}`}>
              <span aria-hidden="true">‹</span>
              <span>{prev.name}</span>
            </Link>
          ) : (
            <span className="about-reader__nav" aria-hidden="true" />
          )}
          <span className="foid-label about-reader__pos">
            {index + 1} / {ABOUT_DOCS.length}
          </span>
          {next ? (
            <Link className="about-reader__nav" href={`/about/${next.id}`} aria-label={`Next document: ${next.name}`}>
              <span>{next.name}</span>
              <span aria-hidden="true">›</span>
            </Link>
          ) : (
            <span className="about-reader__nav" aria-hidden="true" />
          )}
        </div>
      </article>
    </main>
  );
}
