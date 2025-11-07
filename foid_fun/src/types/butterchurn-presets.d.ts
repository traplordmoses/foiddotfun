declare module "butterchurn-presets" {
  // Library exposes a single function that returns a map of presets
  export function getPresets(): Record<string, any>;

  // Some builds get imported as default; keep this loose so either style compiles.
  const _default: { getPresets?: typeof getPresets } | undefined;
  export default _default;
}
