type RouteLoadingShellProps = {
  title: string;
  label: string;
  pageClassName?: string;
  maxWidthClassName?: string;
};

export function RouteLoadingShell({
  title,
  label,
  pageClassName = "",
  maxWidthClassName = "max-w-6xl",
}: RouteLoadingShellProps) {
  return (
    <main
      className={`${pageClassName} relative bg-foid-bg text-white/90 overflow-hidden flex items-center justify-center`}
      style={{
        minHeight: "100dvh",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 vignette" aria-hidden="true" />
      <section className="relative z-10 w-full px-2 sm:px-4">
        <div className={`mx-auto w-full ${maxWidthClassName}`}>
          <div className="vista-window vista-window--terminal vista-window--enhanced h-[94dvh] max-h-[94dvh] w-full">
            <div className="vista-window__titlebar">
              <div className="vista-window__controls" aria-hidden="true">
                <span className="vista-window__control vista-window__control--close" />
                <span className="vista-window__control vista-window__control--minimize" />
                <span className="vista-window__control vista-window__control--restore" />
              </div>
              <span className="vista-window__title">{title}</span>
            </div>
            <div className="vista-window__body flex items-center justify-center">
              <div
                className="font-terminal flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-white/70"
                role="status"
                aria-live="polite"
              >
                <span
                  className="inline-block h-4 w-4 rounded-full border-2 border-cyan-100/35 border-t-cyan-100 animate-spin"
                  aria-hidden="true"
                />
                {label}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
