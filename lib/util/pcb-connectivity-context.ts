import {
  type AnyCircuitElement,
  type LayerRef,
  type PcbBoard,
  type PcbComponent,
  type PcbCopperPour,
  type PcbPlatedHole,
  type PcbPort,
  type PcbSmtPad,
  type PcbTrace,
  type PcbVia,
  type SourceNet,
  type SourcePort,
  type SourceTrace,
  all_layers,
} from "circuit-json"

export type PcbPortId = PcbPort["pcb_port_id"]
export type PcbTraceId = PcbTrace["pcb_trace_id"]
export type PcbComponentId = PcbComponent["pcb_component_id"]
export type SourcePortId = SourcePort["source_port_id"]
export type SourceNetId = SourceNet["source_net_id"]
export type ConnectivityNetId = string

export type PcbCopperElement =
  | PcbSmtPad
  | PcbPlatedHole
  | PcbVia
  | PcbTrace
  | PcbCopperPour

/** Typed lookups shared by the independent logical and physical graphs. */
export class PcbConnectivityContext {
  readonly sourceTraces: SourceTrace[] = []
  readonly sourceNets: SourceNet[] = []
  readonly sourcePorts: SourcePort[] = []
  readonly pcbPorts: PcbPort[] = []
  readonly pcbPortsById = new Map<PcbPortId, PcbPort>()
  readonly pcbTracesById = new Map<PcbTraceId, PcbTrace>()
  readonly pcbComponentsById = new Map<PcbComponentId, PcbComponent>()
  readonly pcbVias: PcbVia[] = []
  readonly copperElements: PcbCopperElement[] = []
  readonly pcbLayerStack: LayerRef[]
  readonly padPortIds = new Set<PcbPortId>()
  readonly modeledPortIds = new Set<PcbPortId>()

  constructor(circuitJson: AnyCircuitElement[]) {
    let pcbBoard: PcbBoard | undefined
    for (const element of circuitJson) {
      switch (element.type) {
        case "source_trace":
          this.sourceTraces.push(element)
          break
        case "source_net":
          this.sourceNets.push(element)
          break
        case "source_port":
          this.sourcePorts.push(element)
          break
        case "pcb_port":
          this.pcbPorts.push(element)
          this.pcbPortsById.set(element.pcb_port_id, element)
          break
        case "pcb_trace":
          this.pcbTracesById.set(element.pcb_trace_id, element)
          this.copperElements.push(element)
          break
        case "pcb_component":
          this.pcbComponentsById.set(element.pcb_component_id, element)
          break
        case "pcb_via":
          this.pcbVias.push(element)
          this.copperElements.push(element)
          for (const pcbPortId of element.pcb_port_ids ?? [])
            this.modeledPortIds.add(pcbPortId)
          break
        case "pcb_smtpad":
        case "pcb_plated_hole":
          this.copperElements.push(element)
          if (element.pcb_port_id) {
            this.padPortIds.add(element.pcb_port_id)
            this.modeledPortIds.add(element.pcb_port_id)
          }
          break
        case "pcb_copper_pour":
          this.copperElements.push(element)
          break
        case "pcb_board":
          pcbBoard ??= element
          break
      }
    }
    this.pcbLayerStack = [
      "top",
      ...all_layers
        .filter((layer) => layer.startsWith("inner"))
        .slice(0, pcbBoard ? Math.max(0, pcbBoard.num_layers - 2) : undefined),
      ...(pcbBoard?.num_layers === 1 ? [] : (["bottom"] as const)),
    ]
  }
}
