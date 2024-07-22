import type {
  PCBTrace,
  PCBSMTPad,
  AnySoupElement,
  PCBTraceError,
} from "@tscircuit/soup"

function lineIntersects(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (denom === 0) return false // parallel lines

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1
}

function tracesOverlap(trace1: PCBTrace, trace2: PCBTrace): boolean {
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
        seg1.layer === seg3.layer &&
        lineIntersects(seg1.x, seg1.y, seg2.x, seg2.y, seg3.x, seg3.y, seg4.x, seg4.y)
      ) {
        return true
      }
    }
  }
  return false
}

function traceOverlapsWithPad(trace: PCBTrace, pad: PCBSMTPad): boolean {
  for (let i = 0; i < trace.route.length - 1; i++) {
    const seg1 = trace.route[i]
    const seg2 = trace.route[i + 1]

    if (seg1.route_type === "wire" && seg2.route_type === "wire" && seg1.layer === pad.layer) {
      const padLeft = pad.x - pad.width / 2
      const padRight = pad.x + pad.width / 2
      const padTop = pad.y - pad.height / 2
      const padBottom = pad.y + pad.height / 2

      if (
        lineIntersects(seg1.x, seg1.y, seg2.x, seg2.y, padLeft, padTop, padRight, padTop) ||
        lineIntersects(seg1.x, seg1.y, seg2.x, seg2.y, padRight, padTop, padRight, padBottom) ||
        lineIntersects(seg1.x, seg1.y, seg2.x, seg2.y, padRight, padBottom, padLeft, padBottom) ||
        lineIntersects(seg1.x, seg1.y, seg2.x, seg2.y, padLeft, padBottom, padLeft, padTop)
      ) {
        return true
      }
    }
  }
  return false
}

function checkEachPcbTraceNonOverlapping(soup: AnySoupElement[]): PCBTraceError[] {
  const pcbTraces: PCBTrace[] = soup.filter((item): item is PCBTrace => item.type === "pcb_trace")
  const pcbSMTPads: PCBSMTPad[] = soup.filter((item): item is PCBSMTPad => item.type === "pcb_smtpad")
  const errors: PCBTraceError[] = []

  for (let i = 0; i < pcbTraces.length; i++) {
    for (let j = i + 1; j < pcbTraces.length; j++) {
      if (tracesOverlap(pcbTraces[i], pcbTraces[j])) {
        errors.push({
          type: "pcb_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${pcbTraces[i].pcb_trace_id} overlaps with ${pcbTraces[j].pcb_trace_id}`,
          pcb_trace_id: pcbTraces[i].pcb_trace_id,
          source_trace_id: "",
          pcb_error_id: `overlap_${pcbTraces[i].pcb_trace_id}_${pcbTraces[j].pcb_trace_id}`,
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
      }
    }

    for (const pad of pcbSMTPads) {
      if (traceOverlapsWithPad(pcbTraces[i], pad)) {
        errors.push({
          type: "pcb_error",
          error_type: "pcb_trace_error",
          message: `PCB trace ${pcbTraces[i].pcb_trace_id} overlaps with pcb_smtpad ${pad.pcb_smtpad_id}`,
          pcb_trace_id: pcbTraces[i].pcb_trace_id,
          source_trace_id: "",
          pcb_error_id: `overlap_${pcbTraces[i].pcb_trace_id}_${pad.pcb_smtpad_id}`,
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
      }
    }
  }

  return errors
}

export { checkEachPcbTraceNonOverlapping }
