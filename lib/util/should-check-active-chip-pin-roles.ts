import type { SourceComponentBase } from "circuit-json"

/**
 * Power, ground, and per-pin role checks apply only when a chip has distinct
 * pin roles. Jumper and SolderJumper currently serialize as simple_chip with
 * are_pins_interchangeable=true, which identifies their passive semantics.
 */
export const shouldCheckActiveChipPinRoles = (
  component: SourceComponentBase,
): boolean =>
  component.ftype === "simple_chip" &&
  component.are_pins_interchangeable !== true
