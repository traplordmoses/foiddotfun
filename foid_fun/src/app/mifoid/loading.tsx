export default function MifoidLoading() {
  return (
    <main className="relative bg-foid-bg text-white/90 min-h-screen overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-white/70">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-purple-400/35 border-t-purple-400 animate-spin" />
          loading mifoid...
        </div>
      </div>
    </main>
  );
}
