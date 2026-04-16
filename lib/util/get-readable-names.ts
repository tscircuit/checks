import type {
  AnyCircuitElement,
  PcbPlatedHole,
  PcbSmtPad,
  SourceTrace,
} from "circuit-json"
import {
  getReadableNameForElement,
  getReadableNameForPcbPort,
  getBoundsOfPcbElements,
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

const firstReadableName = (
  candidates: Array<string | null | undefined>,
  id: string,
): string => {
  for (const candidate of candidates) {
    const readableName = sanitizeReadableName(candidate, id, "")
    if (readableName) return readableName
  }
  return ""
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
): string => {
  const pcbPort = circuitJson.find(
    (element) =>
      element.type === "pcb_port" && element.pcb_port_id === pcbPortId,
  )

  if (pcbPort?.type === "pcb_port") {
    const sourcePort = circuitJson.find(
      (element) =>
        element.type === "source_port" &&
        element.source_port_id === pcbPort.source_port_id,
    )

    const sourceComponent =
      sourcePort?.type === "source_port"
        ? circuitJson.find(
            (element) =>
              element.type === "source_component" &&
              element.source_component_id === sourcePort.source_component_id,
          )
        : null

    const readableSourceComponentName = firstReadableName(
      [
        sourceComponent?.type === "source_component"
          ? sourceComponent.name
          : null,
      ],
      sourceComponent?.type === "source_component"
        ? sourceComponent.source_component_id
        : "",
    )

    const readableSourcePortName = firstReadableName(
      [
        sourcePort?.type === "source_port" ? sourcePort.name : null,
        sourcePort?.type === "source_port"
          ? sourcePort.pin_number?.toString()
          : null,
        sourcePort?.type === "source_port" ? sourcePort.port_hints?.[0] : null,
      ],
      sourcePort?.type === "source_port" ? sourcePort.source_port_id : "",
    )

    if (readableSourceComponentName && readableSourcePortName) {
      return `${readableSourceComponentName}.${readableSourcePortName}`
    }
    if (readableSourcePortName) {
      return readableSourcePortName
    }
  }

  return sanitizeReadableName(
    getReadableNameForPcbPort(circuitJson, pcbPortId) ??
      getReadableNameForElement(circuitJson, pcbPortId),
    pcbPortId,
    "port",
  )
}

export const getReadableNameForSourceTrace = (
  circuitJson: AnyCircuitElement[],
  sourceTrace: SourceTrace,
): string => {
  const displayName = sanitizeReadableName(
    sourceTrace.display_name,
    sourceTrace.source_trace_id,
    "",
  )
  if (displayName) return displayName

  const connectedPortNames = (sourceTrace.connected_source_port_ids ?? [])
    .map((sourcePortId) => {
      const pcbPort = circuitJson.find(
        (element) =>
          element.type === "pcb_port" &&
          element.source_port_id === sourcePortId,
      )

      if (pcbPort?.type === "pcb_port") {
        return getReadableNameForPort(circuitJson, pcbPort.pcb_port_id)
      }

      const sourcePort = circuitJson.find(
        (element) =>
          element.type === "source_port" &&
          element.source_port_id === sourcePortId,
      )
      if (sourcePort?.type !== "source_port") return null

      const sourceComponent = circuitJson.find(
        (element) =>
          element.type === "source_component" &&
          element.source_component_id === sourcePort.source_component_id,
      )

      const sourceComponentName =
        sourceComponent?.type === "source_component"
          ? sanitizeReadableName(
              sourceComponent.name,
              sourceComponent.source_component_id,
              "",
            )
          : ""

      const sourcePortName = firstReadableName(
        [
          sourcePort.name,
          sourcePort.pin_number?.toString(),
          sourcePort.port_hints?.[0],
        ],
        sourcePort.source_port_id,
      )

      if (sourceComponentName && sourcePortName) {
        return `${sourceComponentName}.${sourcePortName}`
      }

      return sourcePortName || null
    })
    .filter((name): name is string => Boolean(name))

  if (connectedPortNames.length >= 2) {
    return `${connectedPortNames[0]} to ${connectedPortNames[1]}`
  }

  if (connectedPortNames.length === 1) {
    return `trace connected to ${connectedPortNames[0]}`
  }

  return `trace ${sourceTrace.source_trace_id}`
}

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

export function getReadableNameForFootprintPad(
  circuitJson: AnyCircuitElement[],
  pad: PcbSmtPad | PcbPlatedHole,
  ordinal: number,
): string {
  const padKind = pad.type === "pcb_smtpad" ? "SMD pad" : "through-hole pad"
  const portRef = pad.pcb_port_id
    ? getReadableNameForPort(circuitJson, pad.pcb_port_id)
    : null
  const bounds = getBoundsOfPcbElements([pad])
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const location = `(${centerX.toFixed(2)}mm, ${centerY.toFixed(2)}mm)`

  if (portRef) return `${padKind} ${portRef} at ${location}`
  return `${padKind} #${ordinal + 1} at ${location}`
}
