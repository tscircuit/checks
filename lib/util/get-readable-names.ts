import type {
  AnyCircuitElement,
  PcbPlatedHole,
  PcbPort,
  PcbSmtPad,
  SourceTrace,
  SourcePort,
} from "circuit-json"
import {
  getReadableNameForElement,
  getBoundsOfPcbElements,
  getPrimaryId,
} from "@tscircuit/circuit-json-util"

export type ReadableNameContext = {
  elementsById: ReadonlyMap<string, AnyCircuitElement>
  pcbPortsBySourcePortId: ReadonlyMap<string, PcbPort>
}

/** Scope this snapshot to one validation; rebuild after membership or ID edits. */
export const createReadableNameContext = (
  circuitJson: AnyCircuitElement[],
): ReadableNameContext => {
  const elementsById = new Map<string, AnyCircuitElement>()
  const pcbPortsBySourcePortId = new Map<string, PcbPort>()
  for (const element of circuitJson) {
    const id = getPrimaryId(element)
    // Keep the first match, as Array.find does.
    if (!elementsById.has(id)) elementsById.set(id, element)
    if (
      element.type === "pcb_port" &&
      !pcbPortsBySourcePortId.has(element.source_port_id)
    ) {
      pcbPortsBySourcePortId.set(element.source_port_id, element)
    }
  }
  return { elementsById, pcbPortsBySourcePortId }
}

const findElementByType = (
  circuitJson: AnyCircuitElement[],
  id: string | undefined,
  type: AnyCircuitElement["type"],
  context?: ReadableNameContext,
): AnyCircuitElement | undefined => {
  if (id === undefined) return undefined
  if (context) {
    const element = context.elementsById.get(id)
    if (!element || element.type === type) return element
    // Another type can share this ID. Preserve the first matching typed record.
  }
  return circuitJson.find(
    (element) => element.type === type && getPrimaryId(element) === id,
  )
}

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
    (id.length > 0 && candidate.includes(id)) ||
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
): string => getReadableNameForElementId(circuitJson, pcbComponentId)

export const getReadableNameForSourcePort = (
  circuitJson: AnyCircuitElement[],
  sourcePort: SourcePort,
): string => {
  const sourceComponent = circuitJson.find(
    (element) =>
      element.type === "source_component" &&
      element.source_component_id === sourcePort.source_component_id,
  )
  const componentName =
    sourceComponent?.type === "source_component"
      ? firstReadableName(
          [sourceComponent.name],
          sourceComponent.source_component_id,
        )
      : ""
  const pinName = firstReadableName(
    [
      sourcePort.name,
      sourcePort.pin_number?.toString(),
      sourcePort.port_hints?.[0],
    ],
    sourcePort.source_port_id,
  )
  return `${componentName || "unnamed component"}.${pinName || "unnamed pin"}`
}

export const getReadableNameForPort = (
  circuitJson: AnyCircuitElement[],
  pcbPortId: string,
  context?: ReadableNameContext,
): string => {
  const pcbPort = findElementByType(circuitJson, pcbPortId, "pcb_port", context)

  if (pcbPort?.type === "pcb_port") {
    const sourcePort = findElementByType(
      circuitJson,
      pcbPort.source_port_id,
      "source_port",
      context,
    )
    const sourceComponent =
      sourcePort?.type === "source_port"
        ? findElementByType(
            circuitJson,
            sourcePort.source_component_id,
            "source_component",
            context,
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

  return "unnamed port"
}

export const getReadableNameForSourceTrace = (
  circuitJson: AnyCircuitElement[],
  sourceTrace: SourceTrace,
  context?: ReadableNameContext,
): string => {
  const displayName = sanitizeReadableName(
    sourceTrace.display_name,
    sourceTrace.source_trace_id,
    "",
  )
  if (displayName) return displayName

  const connectedPortNames: string[] = []
  for (const sourcePortId of sourceTrace.connected_source_port_ids ?? []) {
    const pcbPort = context
      ? context.pcbPortsBySourcePortId.get(sourcePortId)
      : circuitJson.find(
          (element) =>
            element.type === "pcb_port" &&
            element.source_port_id === sourcePortId,
        )

    if (pcbPort?.type === "pcb_port") {
      const name = getReadableNameForPort(
        circuitJson,
        pcbPort.pcb_port_id,
        context,
      )
      if (name !== "unnamed port") connectedPortNames.push(name)
    } else {
      const sourcePort = findElementByType(
        circuitJson,
        sourcePortId,
        "source_port",
        context,
      )
      if (sourcePort?.type !== "source_port") continue

      const sourceComponent = findElementByType(
        circuitJson,
        sourcePort.source_component_id,
        "source_component",
        context,
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
        connectedPortNames.push(`${sourceComponentName}.${sourcePortName}`)
      } else if (sourcePortName) {
        connectedPortNames.push(sourcePortName)
      }
    }
    if (connectedPortNames.length === 2) {
      return `${connectedPortNames[0]} to ${connectedPortNames[1]}`
    }
  }

  if (connectedPortNames.length === 1) {
    return `trace connected to ${connectedPortNames[0]}`
  }

  return "unnamed trace"
}

/** User-facing names never fall back to database identifiers. IDs belong in
 * diagnostic reference fields; unnamed geometry uses a readable type label. */
export const getReadableNameForElementId = (
  circuitJson: AnyCircuitElement[],
  elementId: string,
  context?: ReadableNameContext,
): string => {
  const element = context
    ? context.elementsById.get(elementId)
    : circuitJson.find((record) => getPrimaryId(record) === elementId)
  if (!element) return "unnamed element"
  if (
    element.type === "pcb_component" ||
    element.type === "schematic_component"
  ) {
    const component = findElementByType(
      circuitJson,
      element.source_component_id,
      "source_component",
      context,
    )
    if (component?.type === "source_component")
      return sanitizeReadableName(
        component.name,
        component.source_component_id,
        "unnamed component",
      )
  }
  if (
    (element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") &&
    element.pcb_port_id
  ) {
    const portName = getReadableNameForPort(
      circuitJson,
      element.pcb_port_id,
      context,
    )
    if (portName !== "unnamed port") return portName
  }
  if (element.type === "pcb_trace")
    return getReadableNameForTrace(circuitJson, elementId, context)
  const labels: Partial<Record<AnyCircuitElement["type"], string>> = {
    pcb_smtpad: "SMD pad",
    pcb_plated_hole: "through-hole pad",
    pcb_via: "via",
    pcb_hole: "hole",
    pcb_bend: "bend",
    pcb_stiffener: "stiffener",
    pcb_keepout: "keepout",
    pcb_cutout: "cutout",
    pcb_copper_pour: "copper pour",
  }
  const label =
    labels[element.type] ??
    element.type.replace(/^(pcb|source|schematic)_/, "").replaceAll("_", " ")
  const explicitName = "name" in element ? element.name : undefined
  const description = "description" in element ? element.description : undefined
  return (
    firstReadableName(
      [
        explicitName,
        description,
        getReadableNameForElement(circuitJson, elementId),
      ],
      elementId,
    ) || `unnamed ${label}`
  )
}

export const getReadableNameForTrace = (
  circuitJson: AnyCircuitElement[],
  pcbTraceId: string,
  context?: ReadableNameContext,
): string => {
  const trace = findElementByType(circuitJson, pcbTraceId, "pcb_trace", context)
  if (trace?.type === "pcb_trace" && trace.source_trace_id) {
    const sourceTrace = findElementByType(
      circuitJson,
      trace.source_trace_id,
      "source_trace",
      context,
    )
    if (sourceTrace?.type === "source_trace")
      return getReadableNameForSourceTrace(circuitJson, sourceTrace, context)
  }
  if (trace?.type !== "pcb_trace") return "unnamed trace"
  const portIds = [
    ...new Set(
      trace.route
        .flatMap((point) =>
          point.route_type === "wire"
            ? [point.start_pcb_port_id, point.end_pcb_port_id]
            : [],
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const portNames = portIds
    .map((id) => getReadableNameForPort(circuitJson, id, context))
    .filter((name) => name !== "unnamed port")
  if (portNames.length >= 2) return `${portNames[0]} to ${portNames[1]}`
  if (portNames.length === 1) return `trace connected to ${portNames[0]}`
  return "unnamed trace"
}

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
