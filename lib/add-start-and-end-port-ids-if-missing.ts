import type {
  PCBPort,
  PCBTrace,
  SourceTrace,
  AnySoupElement,
  PCBTraceError,
  PCBSMTPad,
} from "@tscircuit/soup"

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

/**
 * HACK: this whole method and all usage of it is a hack because of this issue:
 * https://github.com/tscircuit/tscircuit/issues/291
 */
export const addStartAndEndPortIdsIfMissing = (
  soup: AnySoupElement[],
): void => {
  const pcbPorts: PCBPort[] = soup.filter((item) => item.type === "pcb_port")
  const pcbSmtPads: PCBSMTPad[] = soup.filter(
    (item) => item.type === "pcb_smtpad",
  )
  const pcbTraces: PCBTrace[] = soup.filter((item) => item.type === "pcb_trace")

  function findPortIdOverlappingPoint(
    point: {
      x: number
      y: number
    },
    options: { isFirstOrLastPoint?: boolean; traceWidth?: number } = {},
  ): string | null {
    const traceWidth = options.traceWidth || 0
    const directPort = pcbPorts.find(
      (port) => distance(port.x, port.y, point.x, point.y) < 0.01,
    )
    if (directPort) return directPort.pcb_port_id

    // If it starts or ends inside an smtpad, we'll connect it to the por
    if (options.isFirstOrLastPoint) {
      const smtPad = pcbSmtPads.find((pad) => {
        if (pad.shape === "rect") {
          return (
            Math.abs(point.x - pad.x) < pad.width / 2 + traceWidth / 2 &&
            Math.abs(point.y - pad.y) < pad.height / 2 + traceWidth / 2
          )
          // biome-ignore lint/style/noUselessElse: <explanation>
        } else if (pad.shape === "circle") {
          return distance(point.x, point.y, pad.x, pad.y) < pad.radius
        }
      })
      if (smtPad) return smtPad.pcb_port_id ?? null
    }

    return null
  }

  // Add start_pcb_port_id and end_pcb_port_id if not present
  for (const trace of pcbTraces) {
    for (let index = 0; index < trace.route.length; index++) {
      const segment = trace.route[index]
      const isFirstOrLastPoint = index === 0 || index === trace.route.length - 1
      if (segment.route_type === "wire") {
        if (!segment.start_pcb_port_id && index === 0) {
          const startPortId = findPortIdOverlappingPoint(segment, {
            isFirstOrLastPoint,
            traceWidth: segment.width,
          })
          if (startPortId) {
            segment.start_pcb_port_id = startPortId
          }
        }
        if (!segment.end_pcb_port_id && index === trace.route.length - 1) {
          const endPortId = findPortIdOverlappingPoint(segment, {
            isFirstOrLastPoint,
            traceWidth: segment.width,
          })
          if (endPortId) {
            segment.end_pcb_port_id = endPortId
          }
        }
      }
    }
  }
}
