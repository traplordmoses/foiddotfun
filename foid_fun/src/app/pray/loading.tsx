export default function PrayLoading() {
  return (
    <main className="pray-page relative bg-foid-bg text-white/90 min-h-screen overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 z-0 vignette" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-3 sm:px-6">
        <div className="w-full max-w-[1800px]">
          <div className="vista-window vista-window--terminal w-full h-[78vh] max-h-[86vh]">
            <div className="vista-window__titlebar">
              <div className="vista-window__controls" aria-hidden="true">
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
                <span className="vista-window__control vista-window__control--close" />
              </div>
              <span className="vista-window__title">FOID_MOMMY_TERMINAL.EXE</span>
            </div>
            <div className="vista-window__body flex items-center justify-center">
              <div className="font-terminal text-xs uppercase tracking-[0.16em] text-white/70 flex items-center gap-3">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-100 animate-spin" />
                loading terminal...
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
