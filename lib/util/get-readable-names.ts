import type { AnyCircuitElement } from "circuit-json"
import {
  getReadableNameForElement,
  getReadableNameForPcbPort,
} from "@tscircuit/circuit-json-util"

const CIRCUIT_JSON_ID_PATTERN =
  /\b(?:pcb|source|schematic|subcircuit)_[a-z0-9_]+\b/i

const sanitizeReadableName = (
  candidate: string | null | undefined,
  id: string,
  fallbackLabel: string,
): string => {
  if (
    !candidate ||
    candidate === id ||
    CIRCUIT_JSON_ID_PATTERN.test(candidate)
  ) {
    return fallbackLabel
  }
  return candidate
}

export const getReadableNameForComponent = (
  circuitJson: AnyCircuitElement[],
  pcbComponentId: string,
): string =>
  sanitizeReadableName(
    getReadableNameForElement(circuitJson, pcbComponentId),
    pcbComponentId,
    "component",
  )

export const getReadableNameForPort = (
  circuitJson: AnyCircuitElement[],
  pcbPortId: string,
): string =>
  sanitizeReadableName(
    getReadableNameForPcbPort(circuitJson, pcbPortId) ??
      getReadableNameForElement(circuitJson, pcbPortId),
    pcbPortId,
    "port",
  )

export const getReadableNameForElementId = (
  circuitJson: AnyCircuitElement[],
  elementId: string,
): string =>
  sanitizeReadableName(
    getReadableNameForElement(circuitJson, elementId),
    elementId,
    "element",
  )

export const getReadableNameForGroup = (
  circuitJson: AnyCircuitElement[],
  groupId: string,
): string =>
  sanitizeReadableName(
    getReadableNameForElement(circuitJson, groupId),
    groupId,
    "group",
  )

export const containsCircuitJsonId = (message: string): boolean =>
  CIRCUIT_JSON_ID_PATTERN.test(message)
