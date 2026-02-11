export default function AboutLoading() {
  return (
    <main className="about-page relative min-h-screen w-full flex items-center justify-center overflow-hidden max-w-full pt-2 pb-20 pb-safe px-2 sm:px-4">
      <section className="relative z-10 w-full max-w-6xl">
        <div className="vista-window vista-window--terminal vista-window--enhanced h-[82vh] max-h-[82vh] w-full">
          <div className="vista-window__titlebar">
            <div className="vista-window__controls" aria-hidden="true">
              <span className="vista-window__control vista-window__control--minimize" />
              <span className="vista-window__control vista-window__control--restore" />
              <span className="vista-window__control vista-window__control--close" />
            </div>
            <span className="vista-window__title">FOID_ABOUT.EXE</span>
          </div>
          <div className="vista-window__body flex items-center justify-center">
            <div className="font-terminal text-xs uppercase tracking-[0.16em] text-white/70 flex items-center gap-3">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-100 animate-spin" />
              loading...
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
