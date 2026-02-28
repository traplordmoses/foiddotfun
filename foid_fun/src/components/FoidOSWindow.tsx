import type { ReactNode } from "react";

type FoidOSWindowProps = {
  title: string;
  variant?: "default" | "full";
  fullHeight?: boolean;
  children: ReactNode;
};

export function FoidOSWindow({
  title,
  variant = "default",
  fullHeight = false,
  children,
}: FoidOSWindowProps) {
  const cls = [
    "vista-window foid-os-window",
    variant === "full" && "foid-os-window--full",
    fullHeight && "foid-os-window--full-height",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={cls}>
      <div className="vista-window__titlebar">
        <div className="vista-window__controls" aria-hidden="true">
          <span className="vista-window__control vista-window__control--minimize" />
          <span className="vista-window__control vista-window__control--restore" />
          <span className="vista-window__control vista-window__control--close" />
        </div>
        <span className="vista-window__title text-[11px]">{title}</span>
      </div>
      <div className="vista-window__body">{children}</div>
    </section>
  );
}
