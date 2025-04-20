import type {
  AnyCircuitElement,
  PcbTraceError,
  PcbPort,
  PcbTrace,
  SourceTrace,
  PcbSmtPad,
  PcbPlatedHole,
} from "circuit-json"
import { isPointInPad } from "./check-each-pcb-port-connected/is-point-in-pad"

function checkTracesAreConnected(soup: AnyCircuitElement[]): PcbTraceError[] {
  const errors: PcbTraceError[] = []

  const pcbPorts = soup.filter((el) => el.type === "pcb_port") as PcbPort[]
  const pcbTraces = soup.filter((el) => el.type === "pcb_trace") as PcbTrace[]
  const sourceTraces = soup.filter(
    (el) => el.type === "source_trace",
  ) as SourceTrace[]
  const pcbSmtPads = soup.filter(
    (el) => el.type === "pcb_smtpad",
  ) as PcbSmtPad[]
  const pcbPlatedHoles = soup.filter(
    (el) => el.type === "pcb_plated_hole",
  ) as PcbPlatedHole[]

  for (const trace of pcbTraces) {
    if (trace.route.length === 0) continue

    const firstPoint = trace.route[0]
    const lastPoint = trace.route[trace.route.length - 1]

    const sourceTrace = sourceTraces.find(
      (st) => st.source_trace_id === trace.source_trace_id,
    )

    if (!sourceTrace) continue

    const expectedPorts = pcbPorts.filter((port) =>
      sourceTrace.connected_source_port_ids?.includes(port.source_port_id),
    )

    for (const port of expectedPorts) {
      const pad = [...pcbSmtPads, ...pcbPlatedHoles].find(
        (p) => p.pcb_port_id === port.pcb_port_id,
      )

      if (!pad) continue

      const isFirstPointConnected =
        firstPoint.route_type === "wire" &&
        isPointInPad({ x: firstPoint.x, y: firstPoint.y }, pad)

      const isLastPointConnected =
        lastPoint.route_type === "wire" &&
        isPointInPad({ x: lastPoint.x, y: lastPoint.y }, pad)

      if (!isFirstPointConnected && !isLastPointConnected) {
        errors.push({
          type: "pcb_trace_error",
          message: `PCB port: ${port.pcb_port_id} is missing a connection from PCB trace: ${trace.pcb_trace_id}`,
          source_trace_id: sourceTrace.source_trace_id,
          error_type: "pcb_trace_error",
          pcb_trace_id: trace.pcb_trace_id,
          pcb_trace_error_id: "",
          pcb_component_ids: [],
          pcb_port_ids: [port.pcb_port_id],
        })
      }
    }
  }

  return errors
}

export { checkTracesAreConnected }
