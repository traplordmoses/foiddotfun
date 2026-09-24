// src/components/seo/JsonLd.tsx
// Structured data for search engines and AI answer engines. Renders on the
// server; `<` is escaped so a string in the data can never close the tag.
type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

export function JsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
