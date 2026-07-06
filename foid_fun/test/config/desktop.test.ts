// test/config/desktop.test.ts
// Stage C contracts for the desktop switch + shell URL grammar
// (src/config/desktop.ts):
//   1. The desktop is DEFAULT-ON — NEXT_PUBLIC_FOID_DESKTOP is an
//      emergency opt-out ("0"), not an opt-in. (This suite runs with the
//      env var unset, which is exactly the production default.)
//   2. ?apps= parsing is defensive: unknown ids dropped, duplicates
//      collapsed (one-instance rule), list capped at MAX_OPEN_WINDOWS,
//      focus coerced into the list.
//   3. Route → shell handoff URLs keep app-scoped params and drop the
//      ?standalone escape hatch.
import { describe, expect, it } from "vitest";
import {
  desktopAppForHref,
  FOID_DESKTOP_ENABLED,
  parseDesktopAppsParam,
  SHELL_APP_IDS,
  shellHandoffUrl,
} from "@/config/desktop";
import { MAX_OPEN_WINDOWS } from "@/stores/windowStore";

describe("desktop flag (Stage C: default on)", () => {
  it("is enabled when NEXT_PUBLIC_FOID_DESKTOP is unset", () => {
    expect(process.env.NEXT_PUBLIC_FOID_DESKTOP).toBeUndefined();
    expect(FOID_DESKTOP_ENABLED).toBe(true);
  });

  it("maps every app route href to its shell app id", () => {
    expect(desktopAppForHref("/pray")).toBe("pray");
    expect(desktopAppForHref("/board")).toBe("board");
    expect(desktopAppForHref("/vote")).toBe("vote");
    expect(desktopAppForHref("/mifoid")).toBe("mifoid");
    expect(desktopAppForHref("/files")).toBe("files");
    expect(desktopAppForHref("/about")).toBe("about");
  });

  it("leaves non-app routes alone", () => {
    expect(desktopAppForHref("/")).toBeNull();
    expect(desktopAppForHref("/dashboard")).toBeNull();
    expect(desktopAppForHref("/gallery")).toBeNull();
    expect(desktopAppForHref("/swipe")).toBeNull();
    expect(desktopAppForHref("/enter")).toBeNull();
  });
});

describe("parseDesktopAppsParam", () => {
  it("parses apps in order with focus defaulting to the last entry", () => {
    expect(parseDesktopAppsParam("?apps=pray,board")).toEqual({
      apps: ["pray", "board"],
      focus: "board",
    });
  });

  it("honors an explicit focus that is in the list", () => {
    expect(parseDesktopAppsParam("?apps=pray,board&focus=pray")).toEqual({
      apps: ["pray", "board"],
      focus: "pray",
    });
  });

  it("coerces a focus that is not in the list back to the last app", () => {
    expect(parseDesktopAppsParam("?apps=pray&focus=board")).toEqual({
      apps: ["pray"],
      focus: "pray",
    });
  });

  it("drops unknown ids (registry validation)", () => {
    expect(parseDesktopAppsParam("?apps=pray,calculator,home,gallery")).toEqual(
      { apps: ["pray"], focus: "pray" },
    );
  });

  it("collapses duplicates (one instance per app)", () => {
    expect(parseDesktopAppsParam("?apps=pray,pray,board,pray")).toEqual({
      apps: ["pray", "board"],
      focus: "board",
    });
  });

  it("caps the list at MAX_OPEN_WINDOWS", () => {
    const everything = [...SHELL_APP_IDS, ...SHELL_APP_IDS].join(",");
    const { apps } = parseDesktopAppsParam(`?apps=${everything}`);
    expect(apps.length).toBeLessThanOrEqual(MAX_OPEN_WINDOWS);
    expect(apps).toEqual([...SHELL_APP_IDS].slice(0, MAX_OPEN_WINDOWS));
  });

  it("returns an empty layout for a bare or garbage query", () => {
    expect(parseDesktopAppsParam("")).toEqual({ apps: [], focus: null });
    expect(parseDesktopAppsParam("?apps=")).toEqual({ apps: [], focus: null });
    expect(parseDesktopAppsParam("?apps=,,")).toEqual({ apps: [], focus: null });
    expect(parseDesktopAppsParam("?focus=board")).toEqual({
      apps: [],
      focus: null,
    });
  });
});

describe("shellHandoffUrl", () => {
  it("opens + focuses the app at /", () => {
    expect(shellHandoffUrl("pray", "")).toBe("/?apps=pray&focus=pray");
  });

  it("carries app-scoped params along raw", () => {
    const url = shellHandoffUrl("board", "?debug=1&celebrate=42");
    const params = new URLSearchParams(url.slice(url.indexOf("?")));
    expect(params.get("apps")).toBe("board");
    expect(params.get("focus")).toBe("board");
    expect(params.get("debug")).toBe("1");
    expect(params.get("celebrate")).toBe("42");
  });

  it("strips the ?standalone escape hatch and overrides stale apps/focus", () => {
    const url = shellHandoffUrl("vote", "?standalone=1&apps=pray&focus=pray");
    const params = new URLSearchParams(url.slice(url.indexOf("?")));
    expect(params.get("standalone")).toBeNull();
    expect(params.get("apps")).toBe("vote");
    expect(params.get("focus")).toBe("vote");
  });

  it("round-trips through the parser", () => {
    const url = shellHandoffUrl("mifoid", "?registry=0xabc");
    expect(parseDesktopAppsParam(url.slice(url.indexOf("?")))).toEqual({
      apps: ["mifoid"],
      focus: "mifoid",
    });
  });
});
