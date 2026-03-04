export default function GalleryLoading() {
  return (
    <main className="relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center" style={{ height: "100vh" }}>
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <section className="relative z-10 w-full max-w-full px-2 sm:px-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94vh] max-h-[94vh] w-full flex flex-col">
            <div className="vista-window__titlebar">
              <div className="vista-window__controls" aria-hidden="true">
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
                <span className="vista-window__control vista-window__control--close" />
              </div>
              <span className="vista-window__title">GALLERY.EXE</span>
            </div>
            <div className="vista-window__body flex items-center justify-center" style={{ flex: 1 }}>
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-white/70">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-purple-400/35 border-t-purple-400 animate-spin" />
                loading gallery...
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
