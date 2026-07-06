// src/components/ui/index.ts
// Barrel export for design-system primitives. Import from here, not from
// individual files, so callers get a stable surface even if internals move.
//
//   import { Chip, NeonBadge, PrimaryButton } from "@/components/ui";

export { VistaWindow } from "./VistaWindow";
export type { VistaWindowProps } from "./VistaWindow";

export { Chip } from "./Chip";
export type { ChipProps, ChipVariant } from "./Chip";

export { StatusDot } from "./StatusDot";
export type { StatusDotProps } from "./StatusDot";

export { NeonBadge } from "./NeonBadge";
export type { NeonBadgeProps, NeonBadgeTone } from "./NeonBadge";

export { TerminalStatusLog } from "./TerminalStatusLog";
export type { TerminalStatusLogProps, StatusMessage } from "./TerminalStatusLog";

export { PrimaryButton } from "./PrimaryButton";
export type { PrimaryButtonProps, PrimaryButtonVariant } from "./PrimaryButton";

export { IconButton } from "./IconButton";
export type { IconButtonProps } from "./IconButton";

export { Card } from "./Card";
export type { CardProps, CardElevation } from "./Card";

export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";
