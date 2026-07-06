// Root loading boundary. Shows for navigations to `/` (the landing window)
// and acts as the fallback shell for any route that doesn't define its own
// loading.tsx (e.g. /dashboard, /enter). Renders the vista-window frame
// instantly so a route transition never sits on a blank screen.
export default function RootLoading() {
  return (
    <main
      className="home-page relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center"
      style={{ height: "100vh" }}
    >
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
              <span className="vista-window__title">FOID_FOUNDATION.EXE</span>
            </div>
            <div className="vista-window__body flex items-center justify-center" style={{ flex: 1 }}>
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-white/70">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-100 animate-spin" />
                loading...
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
