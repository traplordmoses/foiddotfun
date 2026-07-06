// test/stores/windowStore.test.ts
// windowStore v2 — the FOID OS desktop shell's keyed window map
// (docs/foid-os-multiwindow-plan.md §3 + founder decisions).
//
// The contracts the shell depends on:
//   1. One instance per app: re-opening focuses instead of duplicating.
//   2. Soft cap: the 7th concurrent app is refused (MAX_OPEN_WINDOWS = 6).
//   3. Red orb CLOSES: the entry is removed (state discarded on unmount).
//   4. Focus = zOrder tail; focusing a minimized window also restores it;
//      focusing the foreground window is a no-op (same state reference).
//   5. Minimize keeps the entry but drops it from foreground; focusedAppId
//      falls back to the topmost still-open window.
import { beforeEach, describe, expect, it } from "vitest";
import {
  focusedAppId,
  MAX_OPEN_WINDOWS,
  useWindowStoreV2,
  type AppId,
} from "@/stores/windowStore";

const ALL_APPS: AppId[] = [
  "home",
  "pray",
  "board",
  "vote",
  "mifoid",
  "files",
  "about",
  "gallery",
];

const store = () => useWindowStoreV2.getState();

beforeEach(() => {
  useWindowStoreV2.setState({ windows: {}, zOrder: [] });
});

describe("windowStore v2 — open", () => {
  it("creates a window, focused (zOrder tail)", () => {
    store().open("files");
    store().open("mifoid");
    expect(store().zOrder).toEqual(["files", "mifoid"]);
    expect(store().windows.files?.status).toBe("open");
    expect(focusedAppId(store())).toBe("mifoid");
  });

  it("cascades spawn positions so stacked windows don't pile exactly", () => {
    store().open("files");
    store().open("mifoid");
    const a = store().windows.files!.pos;
    const b = store().windows.mifoid!.pos;
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it("is one-instance-per-app: reopening focuses instead of duplicating", () => {
    store().open("files");
    store().open("mifoid");
    store().open("files"); // reopen
    expect(store().zOrder).toEqual(["mifoid", "files"]);
    expect(Object.keys(store().windows)).toHaveLength(2);
  });

  it("restores + refocuses a minimized app on reopen", () => {
    store().open("files");
    store().minimize("files");
    store().open("files");
    expect(store().windows.files?.status).toBe("open");
    expect(focusedAppId(store())).toBe("files");
  });

  it("refuses the app past the soft cap", () => {
    for (const id of ALL_APPS.slice(0, MAX_OPEN_WINDOWS + 1)) store().open(id);
    expect(Object.keys(store().windows)).toHaveLength(MAX_OPEN_WINDOWS);
    expect(store().zOrder).toHaveLength(MAX_OPEN_WINDOWS);
    expect(store().windows[ALL_APPS[MAX_OPEN_WINDOWS]]).toBeUndefined();
  });
});

describe("windowStore v2 — close (red orb)", () => {
  it("removes the entry and its zOrder slot", () => {
    store().open("files");
    store().open("mifoid");
    store().close("files");
    expect(store().windows.files).toBeUndefined();
    expect(store().zOrder).toEqual(["mifoid"]);
    expect(focusedAppId(store())).toBe("mifoid");
  });

  it("frees a cap slot", () => {
    for (const id of ALL_APPS.slice(0, MAX_OPEN_WINDOWS)) store().open(id);
    store().close(ALL_APPS[0]);
    store().open(ALL_APPS[MAX_OPEN_WINDOWS]);
    expect(store().windows[ALL_APPS[MAX_OPEN_WINDOWS]]).toBeDefined();
  });
});

describe("windowStore v2 — focus & z-order", () => {
  it("moves the focused app to the zOrder tail without dropping others", () => {
    store().open("files");
    store().open("mifoid");
    store().focus("files");
    expect(store().zOrder).toEqual(["mifoid", "files"]);
  });

  it("no-ops (same state reference) when already foreground", () => {
    store().open("files");
    const before = useWindowStoreV2.getState();
    store().focus("files");
    expect(useWindowStoreV2.getState()).toBe(before);
  });

  it("restores a minimized window", () => {
    store().open("files");
    store().open("mifoid");
    store().minimize("files");
    store().focus("files");
    expect(store().windows.files?.status).toBe("open");
    expect(store().zOrder).toEqual(["mifoid", "files"]);
  });
});

describe("windowStore v2 — minimize (amber orb)", () => {
  it("parks the window; focus falls to the next open one", () => {
    store().open("files");
    store().open("mifoid");
    store().minimize("mifoid");
    expect(store().windows.mifoid?.status).toBe("minimized");
    expect(focusedAppId(store())).toBe("files");
  });

  it("an all-minimized desktop has no foreground app", () => {
    store().open("files");
    store().minimize("files");
    expect(focusedAppId(store())).toBeUndefined();
  });
});

describe("windowStore v2 — maximize & geometry", () => {
  it("toggleMaximize flips the flag and un-minimizes", () => {
    store().open("files");
    store().minimize("files");
    store().toggleMaximize("files");
    expect(store().windows.files?.maximized).toBe(true);
    expect(store().windows.files?.status).toBe("open");
    store().toggleMaximize("files");
    expect(store().windows.files?.maximized).toBe(false);
  });

  it("setPos/setSize update geometry; setSize(null) returns to defaults", () => {
    store().open("files");
    store().setPos("files", { x: 120, y: 60 });
    store().setSize("files", { w: 900, h: 600 });
    expect(store().windows.files?.pos).toEqual({ x: 120, y: 60 });
    expect(store().windows.files?.size).toEqual({ w: 900, h: 600 });
    store().setSize("files", null);
    expect(store().windows.files?.size).toBeNull();
  });

  it("geometry actions ignore unknown windows", () => {
    store().setPos("board", { x: 1, y: 1 });
    store().setSize("board", { w: 500, h: 400 });
    store().minimize("board");
    store().toggleMaximize("board");
    store().close("board");
    expect(store().windows.board).toBeUndefined();
    expect(store().zOrder).toEqual([]);
  });
});
