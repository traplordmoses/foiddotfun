export default function BoardLoading() {
  return (
    <main className="board-page overflow-hidden flex h-[calc(100vh-12px)] flex-col">
      <div className="board-shell flex-1">
        <div className="vista-window vista-window--terminal w-full h-[94vh] max-h-[94vh] max-w-[1800px] mx-auto">
          <div className="vista-window__titlebar">
            <div className="vista-window__controls" aria-hidden="true">
              <span className="vista-window__control vista-window__control--minimize" />
              <span className="vista-window__control vista-window__control--restore" />
              <span className="vista-window__control vista-window__control--close" />
            </div>
            <span className="vista-window__title">MIFOID_LOREBOARD.APP</span>
          </div>
          <div className="vista-window__body flex items-center justify-center">
            <div className="font-terminal text-xs uppercase tracking-[0.16em] text-white/70 flex items-center gap-3">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-100 animate-spin" />
              loading board...
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
