import type {
  PCBTrace,
  PCBSMTPad,
  AnySoupElement,
  PCBTraceError,
} from "@tscircuit/soup"
import { NetManager } from "./net-manager"
import { addStartAndEndPortIdsIfMissing } from "./add-start-and-end-port-ids-if-missing"
import Debug from "debug"
import { su } from "@tscircuit/soup-util"
import { deriveSelector } from "./utils/derive-selector"

const debug = Debug("tscircuit:checks:check-each-pcb-trace-non-overlapping")

/**
 * Checks if lines given by (x1, y1) and (x2, y2) intersect with line
 * given by (x3, y3) and (x4, y4)
 */
function lineIntersects(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (denom === 0) return false // parallel lines

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1
}

function tracesOverlap(
  trace1: PCBTrace,
  trace2: PCBTrace,
): { x: number; y: number } | false {
  for (let i = 0; i < trace1.route.length - 1; i++) {
    for (let j = 0; j < trace2.route.length - 1; j++) {
      const seg1 = trace1.route[i]
      const seg2 = trace1.route[i + 1]
      const seg3 = trace2.route[j]
      const seg4 = trace2.route[j + 1]

      if (
        seg1.route_type === "wire" &&
        seg2.route_type === "wire" &&
        seg3.route_type === "wire" &&
        seg4.route_type === "wire" &&
        seg1.layer === seg3.layer
      ) {
        const areLinesIntersecting = lineIntersects(
          seg1.x,
          seg1.y,
          seg2.x,
          seg2.y,
          seg3.x,
          seg3.y,
          seg4.x,
          seg4.y,
        )
        if (areLinesIntersecting)
          return {
            // return the intersection point
            x: (seg1.x * seg2.y - seg2.x * seg1.y) / (seg2.y - seg1.y),
            y: (seg1.x * seg2.y - seg2.x * seg1.y) / (seg2.y - seg1.y),
          }
      }
    }
  }
  return false
}

function traceOverlapsWithPad(trace: PCBTrace, pad: PCBSMTPad): boolean {
  for (let i = 0; i < trace.route.length - 1; i++) {
    const seg1 = trace.route[i]
    const seg2 = trace.route[i + 1]

    if (
      seg1.route_type === "wire" &&
      seg2.route_type === "wire" &&
      seg1.layer === pad.layer &&
      pad.shape === "rect"
    ) {
      const padLeft = pad.x - pad.width / 2
      const padRight = pad.x + pad.width / 2
      const padTop = pad.y - pad.height / 2
      const padBottom = pad.y + pad.height / 2

      if (
        lineIntersects(
          seg1.x,
          seg1.y,
          seg2.x,
          seg2.y,
          padLeft,
          padTop,
          padRight,
          padTop,
        ) ||
        lineIntersects(
          seg1.x,
          seg1.y,
          seg2.x,
          seg2.y,
          padRight,
          padTop,
          padRight,
          padBottom,
        ) ||
        lineIntersects(
          seg1.x,
          seg1.y,
          seg2.x,
          seg2.y,
          padRight,
          padBottom,
          padLeft,
          padBottom,
        ) ||
        lineIntersects(
          seg1.x,
          seg1.y,
          seg2.x,
          seg2.y,
          padLeft,
          padBottom,
          padLeft,
          padTop,
        )
      ) {
        return true
      }
    }
  }
  return false
}

function getPcbPortIdsConnectedToTrace(trace: PCBTrace) {
  const connectedPcbPorts = new Set<string>()
  for (const segment of trace.route) {
    if (segment.route_type === "wire") {
      if (segment.start_pcb_port_id)
        connectedPcbPorts.add(segment.start_pcb_port_id)
      if (segment.end_pcb_port_id)
        connectedPcbPorts.add(segment.end_pcb_port_id)
    }
  }

  return Array.from(connectedPcbPorts)
}

function getPcbPortIdsConnectedToTraces(traces: PCBTrace[]) {
  const connectedPorts = new Set<string>()
  for (const trace of traces) {
    for (const portId of getPcbPortIdsConnectedToTrace(trace)) {
      connectedPorts.add(portId)
    }
  }
  return Array.from(connectedPorts)
}

function checkEachPcbTraceNonOverlapping(
  soup: AnySoupElement[],
): PCBTraceError[] {
  addStartAndEndPortIdsIfMissing(soup)
  const pcbTraces: PCBTrace[] = soup.filter(
    (item): item is PCBTrace => item.type === "pcb_trace",
  )
  const pcbSMTPads: PCBSMTPad[] = soup.filter(
    (item): item is PCBSMTPad => item.type === "pcb_smtpad",
  )
  const errors: PCBTraceError[] = []
  const netManager = new NetManager()

  // TODO use source port ids instead of port ids, parse source ports for connections
  for (const trace of pcbTraces) {
    netManager.setConnected(getPcbPortIdsConnectedToTrace(trace))
  }

  for (let i = 0; i < pcbTraces.length; i++) {
    for (let j = i + 1; j < pcbTraces.length; j++) {
      debug(
        `Checking overlap for ${pcbTraces[i].pcb_trace_id} and ${pcbTraces[j].pcb_trace_id}`,
      )
      const connectedPorts = getPcbPortIdsConnectedToTraces([
        pcbTraces[i],
        pcbTraces[j],
      ])
      debug(`Connected ports: ${connectedPorts.join(",")}`)

      if (connectedPorts.length === 0) {
        debug("No ports connected to trace, skipping")
        continue
      }

      if (connectedPorts.length === 1) {
        debug("Only one port connected, skipping")
        continue
      }

      if (netManager.isConnected(connectedPorts)) {
        continue
      }
      const overlapPoint = tracesOverlap(pcbTraces[i], pcbTraces[j])
      if (overlapPoint) {
        errors.push({
          type: "pcb_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${deriveSelector(pcbTraces[i])} overlaps with ${deriveSelector(pcbTraces[j])}`,
          pcb_trace_id: pcbTraces[i].pcb_trace_id,
          source_trace_id: "",
          pcb_error_id: `overlap_${pcbTraces[i].pcb_trace_id}_${pcbTraces[j].pcb_trace_id}`,
          pcb_component_ids: [],
          // @ts-ignore this is available in a future version of @tscircuit/soup
          center: overlapPoint,
          pcb_port_ids: getPcbPortIdsConnectedToTraces([
            pcbTraces[i],
            pcbTraces[j],
          ]),
        })
      }
    }

    for (const pad of pcbSMTPads) {
      if (
        pad.pcb_port_id &&
        netManager.isConnected(
          getPcbPortIdsConnectedToTrace(pcbTraces[i]).concat([pad.pcb_port_id]),
        )
      ) {
        continue
      }
      if (traceOverlapsWithPad(pcbTraces[i], pad)) {
        errors.push({
          type: "pcb_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${deriveSelector(pcbTraces[i])} overlaps with pcb_smtpad ${deriveSelector(pad)}`,
          pcb_trace_id: pcbTraces[i].pcb_trace_id,
          source_trace_id: "",
          pcb_error_id: `overlap_${pcbTraces[i].pcb_trace_id}_${pad.pcb_smtpad_id}`,
          pcb_component_ids: [],
          pcb_port_ids: getPcbPortIdsConnectedToTrace(pcbTraces[i]),
        })
      }
    }
  }

  return errors
}

export { checkEachPcbTraceNonOverlapping }
