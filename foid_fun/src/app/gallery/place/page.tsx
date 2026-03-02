"use client";

import Link from "next/link";

export default function DirectPlacePage() {
  return (
    <div className="min-h-screen bg-foid-bg flex items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 text-5xl opacity-30">&#x2694;</div>
        <h1 className="mb-2 text-xl font-bold text-white">
          Direct Placement Retired
        </h1>
        <p className="mb-6 text-sm text-white/50">
          Direct placement is no longer available. Propose your meme through Swipe instead — the community votes, and winners are canonized in the Gallery.
        </p>
        <Link
          href="/swipe/submit"
          className="inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-85"
          style={{ background: "linear-gradient(135deg, #e040fb, #f06292)" }}
        >
          Propose a Meme &rarr;
        </Link>
        <div className="mt-4">
          <Link
            href="/gallery"
            className="text-sm text-purple-400 hover:underline"
          >
            &larr; Back to Gallery
          </Link>
        </div>
      </div>
    </div>
  );
}
