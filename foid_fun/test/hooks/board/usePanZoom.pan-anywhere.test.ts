// test/hooks/board/usePanZoom.pan-anywhere.test.ts
// Pan-from-anywhere (founder feel, 2026-07): dragging that STARTS on a
// placement image must pan the board, while a clean click on the same
// placement still opens its lightbox.
//
// Contract under test (usePanZoom.onContainerPointerDown + the threshold
// promotion effect):
//   1. down on a placement <button> inside .board-stage arms a potential
//      pan; travel ≥ PAN_CLICK_THRESHOLD_PX promotes it to a real pan
//      (draggingBoard) and the release click is swallowed before it can
//      reach the placement (no lightbox after a pan).
//   2. down + up with sub-threshold travel stays a click: no pan, and the
//      placement's click handler fires exactly as before.
//   3. screen-space chrome (interactive elements OUTSIDE the stage) never
//      arms a pan.
//   4. pending-item cards (.board-pending) own their move/resize gestures —
//      never promoted to a pan.
//   5. empty-canvas presses keep the immediate-pan behavior.
/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import {
  PAN_CLICK_THRESHOLD_PX,
  usePanZoom,
} from "@/hooks/board/usePanZoom";

type HookResult = ReturnType<typeof usePanZoom>;

// Unmount hooks even when an assertion threw mid-test — a leaked window
// click-capture listener with its suppress flag set would eat the next
// test's click and cascade the failure.
let unmountCurrent: (() => void) | null = null;

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const stage = document.createElement("div");
  stage.className = "board-stage";
  container.appendChild(stage);

  const placement = document.createElement("button");
  placement.type = "button";
  stage.appendChild(placement);

  const pending = document.createElement("figure");
  pending.className = "board-pending";
  const pendingHandle = document.createElement("button");
  pending.appendChild(pendingHandle);
  stage.appendChild(pending);

  const chromeButton = document.createElement("button"); // e.g. ribbon CTA
  container.appendChild(chromeButton);

  const ref = { current: container as HTMLElement };
  const rendered = renderHook(() => usePanZoom(ref));
  unmountCurrent = rendered.unmount;
  act(() => rendered.result.current.bindStage(stage));

  const down = (target: HTMLElement, x: number, y: number) =>
    ({
      target,
      currentTarget: container,
      clientX: x,
      clientY: y,
      pointerId: 1,
      preventDefault: vi.fn(),
    }) as unknown as React.PointerEvent<HTMLDivElement>;

  const winPointer = (type: string, x: number, y: number) =>
    window.dispatchEvent(
      new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1 }),
    );

  return { container, stage, placement, pending, pendingHandle, chromeButton, down, winPointer, ...rendered };
}

const panX = (r: { current: HookResult }) => r.current.getViewport().x;

afterEach(() => {
  unmountCurrent?.();
  unmountCurrent = null;
  document.body.innerHTML = "";
});

describe("usePanZoom — pan-from-anywhere over placements", () => {
  it("promotes a down-on-placement drag past the threshold into a pan and eats the click", () => {
    const t = setup();
    const opened = vi.fn();
    t.placement.addEventListener("click", opened);

    const x0 = panX(t.result);
    act(() => {
      t.result.current.onContainerPointerDown(t.down(t.placement, 100, 100));
    });
    // Armed, not yet a pan.
    expect(t.result.current.draggingBoard).toBe(false);

    // Promotion move in its own act(): the draggingBoard effect must flush
    // and attach its pan listener before the follow-up movement.
    act(() => {
      t.winPointer("pointermove", 120, 100); // 20px > threshold → promote
    });
    expect(t.result.current.draggingBoard).toBe(true);
    act(() => {
      t.winPointer("pointermove", 140, 100); // real pan movement
    });
    // Stage panned: +40px of pointer travel → viewport x shifts by -40/scale.
    expect(panX(t.result)).toBeCloseTo(x0 - 40, 5);

    act(() => {
      t.winPointer("pointerup", 140, 100);
      // The browser fires click at the capture/press target after release.
      t.placement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(opened).not.toHaveBeenCalled(); // no lightbox after a pan

    // The NEXT clean click works again (flag was consumed / reset).
    act(() => {
      t.result.current.onContainerPointerDown(t.down(t.placement, 10, 10));
      t.winPointer("pointerup", 10, 10);
      t.placement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(opened).toHaveBeenCalledTimes(1);
    t.unmount();
  });

  it("keeps a sub-threshold press a clean click (lightbox path intact)", () => {
    const t = setup();
    const opened = vi.fn();
    t.placement.addEventListener("click", opened);

    const x0 = panX(t.result);
    act(() => {
      t.result.current.onContainerPointerDown(t.down(t.placement, 100, 100));
      t.winPointer(
        "pointermove",
        100 + (PAN_CLICK_THRESHOLD_PX - 1),
        100,
      ); // jitter below the threshold
      t.winPointer("pointerup", 100 + (PAN_CLICK_THRESHOLD_PX - 1), 100);
      t.placement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(t.result.current.draggingBoard).toBe(false);
    expect(panX(t.result)).toBe(x0);
    expect(opened).toHaveBeenCalledTimes(1);
    t.unmount();
  });

  it("never starts a pan from screen-space chrome (interactive outside the stage)", () => {
    const t = setup();
    act(() => {
      t.result.current.onContainerPointerDown(t.down(t.chromeButton, 50, 50));
      t.winPointer("pointermove", 150, 150);
    });
    expect(t.result.current.draggingBoard).toBe(false);
    t.unmount();
  });

  it("lets pending-item handles win over pan (.board-pending exclusion)", () => {
    const t = setup();
    act(() => {
      t.result.current.onContainerPointerDown(t.down(t.pendingHandle, 50, 50));
      t.winPointer("pointermove", 150, 150);
    });
    expect(t.result.current.draggingBoard).toBe(false);
    t.unmount();
  });

  it("keeps the immediate pan on empty-canvas presses", () => {
    const t = setup();
    const ev = t.down(t.stage, 10, 10);
    act(() => {
      t.result.current.onContainerPointerDown(ev);
    });
    expect(t.result.current.draggingBoard).toBe(true);
    expect(ev.preventDefault).toHaveBeenCalled();
    t.unmount();
  });
});
