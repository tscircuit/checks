import { cju } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  SourceComponentBase,
  SourceNet,
  SourcePinMissingTraceWarning,
  SourcePort,
  SourceSimpleCapacitor,
} from "circuit-json"
import {
  type ConnectivityMap,
  getSourcePortConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { capacitorConnectsPowerSourcePortToGround } from "./decoupling-capacitor-checker-capacitor-connects-power-source-port-to-ground"
import { getDecouplingCapacitorWarnings } from "./decoupling-capacitor-checker-get-warnings"
import { sourcePortHasConnection } from "./decoupling-capacitor-checker-source-port-has-connection"
import { sourcePortIsConnectedToGround } from "./decoupling-capacitor-checker-source-port-is-connected-to-ground"
import { sourcePortShouldHaveDecouplingCapacitor } from "./decoupling-capacitor-checker-source-port-should-have-decoupling-capacitor"
import type { SourceComponentId } from "./types"

export class DecouplingCapacitorChecker {
  readonly sourceComponents: SourceComponentBase[]
  readonly sourcePorts: SourcePort[]
  readonly groundSourcePorts: SourcePort[]
  readonly groundSourceNets: SourceNet[]
  readonly capacitorSourceComponents: SourceSimpleCapacitor[]
  readonly sourcePortsBySourceComponentId = new Map<
    SourceComponentId,
    SourcePort[]
  >()
  readonly sourceConnectivityMap: ConnectivityMap

  constructor(circuitJson: AnyCircuitElement[]) {
    const db = cju(circuitJson)
    this.sourceComponents = db.source_component.list() as SourceComponentBase[]
    this.sourcePorts = db.source_port.list()
    this.groundSourcePorts = this.sourcePorts.filter(
      (sourcePort) =>
        sourcePort.requires_ground === true ||
        sourcePort.provides_ground === true,
    )
    this.groundSourceNets = db.source_net
      .list()
      .filter((sourceNet) => sourceNet.is_ground)
    this.capacitorSourceComponents = this.sourceComponents.filter(
      (sourceComponent): sourceComponent is SourceSimpleCapacitor =>
        sourceComponent.ftype === "simple_capacitor",
    )
    this.sourceConnectivityMap =
      getSourcePortConnectivityMapFromCircuitJson(circuitJson)

    for (const sourcePort of this.sourcePorts) {
      if (!sourcePort.source_component_id) continue
      const sourceComponentPorts =
        this.sourcePortsBySourceComponentId.get(
          sourcePort.source_component_id,
        ) ?? []
      sourceComponentPorts.push(sourcePort)
      this.sourcePortsBySourceComponentId.set(
        sourcePort.source_component_id,
        sourceComponentPorts,
      )
    }
  }

  getWarnings(): SourcePinMissingTraceWarning[] {
    return getDecouplingCapacitorWarnings(this)
  }

  getSourcePorts(sourceComponentId: SourceComponentId): SourcePort[] {
    return this.sourcePortsBySourceComponentId.get(sourceComponentId) ?? []
  }

  sourcePortShouldHaveDecouplingCapacitor(sourcePort: SourcePort): boolean {
    return sourcePortShouldHaveDecouplingCapacitor(sourcePort)
  }

  sourcePortHasConnection(sourcePort: SourcePort): boolean {
    return sourcePortHasConnection(this, sourcePort)
  }

  sourcePortIsConnectedToGround(sourcePort: SourcePort): boolean {
    return sourcePortIsConnectedToGround(this, sourcePort)
  }

  capacitorConnectsPowerSourcePortToGround(
    capacitorSourceComponent: SourceSimpleCapacitor,
    chipPowerSourcePort: SourcePort,
  ): boolean {
    return capacitorConnectsPowerSourcePortToGround(
      this,
      capacitorSourceComponent,
      chipPowerSourcePort,
    )
  }
}
