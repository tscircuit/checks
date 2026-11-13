import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPlatedHole,
  PcbSmtPad,
  PcbTrace,
  PcbVia,
  SourceNet,
  SourceTrace,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { getPrimaryId } from "@tscircuit/circuit-json-util"

export interface NetClassDefinition {
  name: string
  clearance?: number
  nets?: string[]
  net_names?: string[]
}

export type ClearanceMatrix = Record<string, Record<string, number>>

export interface NetClassClearanceOptions {
  netClasses?: NetClassDefinition[]
  clearanceMatrix?: ClearanceMatrix
  defaultNetClass?: string
  connMap?: ConnectivityMap
  minClearance?: number
  clearanceManager?: NetClassClearanceManager
}

export class NetClassClearanceManager {
  public readonly netClasses = new Map<string, NetClassDefinition>()
  public readonly clearanceMatrix: ClearanceMatrix = {}
  public readonly defaultNetClass?: string
  public readonly connMap: ConnectivityMap

  private networkIdToClassName = new Map<string, string>()
  private networkIdToDirectClearance = new Map<string, number>()
  private elementIdToNetworkId = new Map<string, string>()
  private elementIdToClassName = new Map<string, string>()
  private elementIdToDirectClearance = new Map<string, number>()

  public maxConfiguredClearance = 0

  constructor(
    circuitJson: AnyCircuitElement[],
    options?: NetClassClearanceOptions,
  ) {
    this.defaultNetClass = options?.defaultNetClass
    this.connMap =
      options?.connMap ?? getFullConnectivityMapFromCircuitJson(circuitJson)

    // 1. Load net classes & clearance matrix from circuitJson elements
    this.loadDefinitionsFromCircuitJson(circuitJson)

    // 2. Load net classes & clearance matrix from explicit options (overriding / augmenting)
    if (options?.netClasses) {
      for (const netClass of options.netClasses) {
        this.addNetClassDefinition(netClass)
      }
    }
    if (options?.clearanceMatrix) {
      this.mergeClearanceMatrix(options.clearanceMatrix)
    }

    // 3. Build mappings from elements & connectivity network IDs to net classes
    this.indexCircuit(circuitJson)

    // 4. Compute max configured clearance for fast bounding box / spatial radius expansion
    this.computeMaxClearance(options?.minClearance ?? 0)
  }

  private addNetClassDefinition(def: NetClassDefinition) {
    const existing = this.netClasses.get(def.name)
    const combinedNets = [
      ...(existing?.nets ?? []),
      ...(existing?.net_names ?? []),
      ...(def.nets ?? []),
      ...(def.net_names ?? []),
    ]
    this.netClasses.set(def.name, {
      name: def.name,
      clearance: def.clearance ?? existing?.clearance,
      nets: Array.from(new Set(combinedNets)),
    })
  }

  private mergeClearanceMatrix(matrix: ClearanceMatrix) {
    for (const [classA, targetClasses] of Object.entries(matrix)) {
      if (!this.clearanceMatrix[classA]) {
        this.clearanceMatrix[classA] = {}
      }
      for (const [classB, clearance] of Object.entries(targetClasses)) {
        if (typeof clearance === "number") {
          this.clearanceMatrix[classA][classB] = clearance
          if (!this.clearanceMatrix[classB]) {
            this.clearanceMatrix[classB] = {}
          }
          this.clearanceMatrix[classB][classA] = clearance
        }
      }
    }
  }

  private loadDefinitionsFromCircuitJson(circuitJson: AnyCircuitElement[]) {
    for (const el of circuitJson) {
      const elAny = el as any
      // PCB Board metadata
      if (el.type === "pcb_board") {
        const board = el as PcbBoard & {
          net_classes?: NetClassDefinition[]
          clearance_matrix?: ClearanceMatrix
          drc_config?: {
            net_classes?: NetClassDefinition[]
            clearance_matrix?: ClearanceMatrix
          }
        }
        const boardClasses =
          board.net_classes ?? board.drc_config?.net_classes ?? []
        for (const cls of boardClasses) {
          this.addNetClassDefinition(cls)
        }
        const boardMatrix =
          board.clearance_matrix ?? board.drc_config?.clearance_matrix
        if (boardMatrix) {
          this.mergeClearanceMatrix(boardMatrix)
        }
      }

      // Explicit net class elements
      if (
        elAny.type === "source_net_class" ||
        elAny.type === "pcb_net_class" ||
        elAny.type === "net_class"
      ) {
        const name = elAny.name ?? elAny.net_class_name
        if (name) {
          this.addNetClassDefinition({
            name,
            clearance: elAny.clearance,
            nets: elAny.nets ?? elAny.net_names,
          })
        }
      }

      // Explicit clearance matrix elements
      if (
        elAny.type === "clearance_matrix" ||
        elAny.type === "pcb_clearance_matrix" ||
        elAny.type === "source_clearance_matrix"
      ) {
        const matrix = elAny.matrix ?? elAny.clearance_matrix
        if (matrix && typeof matrix === "object") {
          this.mergeClearanceMatrix(matrix)
        }
      }
    }
  }

  private indexCircuit(circuitJson: AnyCircuitElement[]) {
    const sourceNets = circuitJson.filter(
      (el): el is SourceNet => el.type === "source_net",
    )
    const sourceNetsById = new Map<string, SourceNet>()
    for (const sn of sourceNets) {
      sourceNetsById.set(sn.source_net_id, sn)
    }

    // Direct mapping of source_nets with explicit net_class or clearance
    for (const sn of sourceNets) {
      const snAny = sn as any
      const explicitClass = snAny.net_class ?? snAny.net_class_name
      if (explicitClass) {
        this.elementIdToClassName.set(sn.source_net_id, explicitClass)
        if (sn.name) this.elementIdToClassName.set(sn.name, explicitClass)
      }
      if (typeof snAny.clearance === "number") {
        this.elementIdToDirectClearance.set(sn.source_net_id, snAny.clearance)
        if (sn.name) {
          this.elementIdToDirectClearance.set(sn.name, snAny.clearance)
        }
      }
    }

    // Map each network in connMap to a net class and/or direct clearance
    const netMap = this.connMap?.netMap ?? {}
    for (const [networkId, memberIds] of Object.entries(netMap)) {
      const memberIdSet = new Set(memberIds)
      let resolvedClass: string | undefined
      let maxDirectClearance: number | undefined

      // Check if any member has an explicit net class or direct clearance
      for (const id of memberIds) {
        this.elementIdToNetworkId.set(id, networkId)
        const sn = sourceNetsById.get(id)
        if (sn) {
          const snAny = sn as any
          const explicitClass = snAny.net_class ?? snAny.net_class_name
          if (explicitClass) resolvedClass = explicitClass
          if (typeof snAny.clearance === "number") {
            maxDirectClearance = Math.max(
              maxDirectClearance ?? 0,
              snAny.clearance,
            )
          }
        }
      }

      // If not yet resolved, match against configured netClasses
      if (!resolvedClass) {
        for (const [className, classDef] of this.netClasses.entries()) {
          const targets = new Set([
            className,
            ...(classDef.nets ?? []),
            ...(classDef.net_names ?? []),
          ])

          // Check if any member ID is listed in classDef.nets
          let matched = false
          for (const target of targets) {
            if (memberIdSet.has(target)) {
              matched = true
              break
            }
          }

          // Check if any source_net's name or key is listed
          if (!matched) {
            for (const id of memberIds) {
              const sn = sourceNetsById.get(id)
              if (!sn) continue
              if (
                (sn.name && targets.has(sn.name)) ||
                (sn.subcircuit_connectivity_map_key &&
                  targets.has(sn.subcircuit_connectivity_map_key))
              ) {
                matched = true
                break
              }
            }
          }

          if (matched) {
            resolvedClass = className
            break
          }
        }
      }

      if (resolvedClass) {
        this.networkIdToClassName.set(networkId, resolvedClass)
      }
      if (maxDirectClearance !== undefined) {
        this.networkIdToDirectClearance.set(networkId, maxDirectClearance)
      }
    }

    // Index remaining PCB elements to their network IDs if possible
    for (const el of circuitJson) {
      if (
        el.type === "pcb_trace" ||
        el.type === "pcb_smtpad" ||
        el.type === "pcb_plated_hole" ||
        el.type === "pcb_via"
      ) {
        const id = getPrimaryId(el)
        if (!this.elementIdToNetworkId.has(id)) {
          const netId = this.connMap?.getNetConnectedToId?.(id)
          if (netId) {
            this.elementIdToNetworkId.set(id, netId)
          } else if (el.type === "pcb_trace" && el.source_trace_id) {
            const stNet = this.connMap?.getNetConnectedToId?.(
              el.source_trace_id,
            )
            if (stNet) this.elementIdToNetworkId.set(id, stNet)
          } else if (
            (el.type === "pcb_smtpad" || el.type === "pcb_plated_hole") &&
            el.pcb_port_id
          ) {
            const portNet = this.connMap?.getNetConnectedToId?.(el.pcb_port_id)
            if (portNet) this.elementIdToNetworkId.set(id, portNet)
          } else if (el.type === "pcb_via" && (el as PcbVia).pcb_trace_id) {
            const trNet = this.connMap?.getNetConnectedToId?.(
              (el as PcbVia).pcb_trace_id!,
            )
            if (trNet) this.elementIdToNetworkId.set(id, trNet)
          }
        }
      }
    }
  }

  private computeMaxClearance(baseMinClearance: number) {
    let maxVal = baseMinClearance
    for (const cls of this.netClasses.values()) {
      if (typeof cls.clearance === "number") {
        maxVal = Math.max(maxVal, cls.clearance)
      }
    }
    for (const row of Object.values(this.clearanceMatrix)) {
      for (const val of Object.values(row)) {
        if (typeof val === "number") {
          maxVal = Math.max(maxVal, val)
        }
      }
    }
    for (const val of this.networkIdToDirectClearance.values()) {
      maxVal = Math.max(maxVal, val)
    }
    for (const val of this.elementIdToDirectClearance.values()) {
      maxVal = Math.max(maxVal, val)
    }
    this.maxConfiguredClearance = maxVal
  }

  public getNetClassForId(elementId: string): string | undefined {
    if (this.elementIdToClassName.has(elementId)) {
      return this.elementIdToClassName.get(elementId)
    }
    const networkId =
      this.elementIdToNetworkId.get(elementId) ??
      this.connMap?.getNetConnectedToId?.(elementId)
    if (networkId && this.networkIdToClassName.has(networkId)) {
      return this.networkIdToClassName.get(networkId)
    }
    return this.defaultNetClass
  }

  public getDirectClearanceForId(elementId: string): number | undefined {
    if (this.elementIdToDirectClearance.has(elementId)) {
      return this.elementIdToDirectClearance.get(elementId)
    }
    const networkId =
      this.elementIdToNetworkId.get(elementId) ??
      this.connMap?.getNetConnectedToId?.(elementId)
    if (networkId && this.networkIdToDirectClearance.has(networkId)) {
      return this.networkIdToDirectClearance.get(networkId)
    }
    return undefined
  }

  public getRequiredClearance(
    idA: string,
    idB: string,
    baseMinClearance = 0,
  ): number {
    const classA = this.getNetClassForId(idA)
    const classB = this.getNetClassForId(idB)
    const directA = this.getDirectClearanceForId(idA)
    const directB = this.getDirectClearanceForId(idB)
    const classClearanceA = classA
      ? this.netClasses.get(classA)?.clearance
      : undefined
    const classClearanceB = classB
      ? this.netClasses.get(classB)?.clearance
      : undefined

    let matrixClearance: number | undefined
    if (classA && classB) {
      matrixClearance =
        this.clearanceMatrix[classA]?.[classB] ??
        this.clearanceMatrix[classB]?.[classA]
    }

    if (matrixClearance !== undefined) {
      return Math.max(
        baseMinClearance,
        matrixClearance,
        directA ?? 0,
        directB ?? 0,
      )
    }

    return Math.max(
      baseMinClearance,
      classClearanceA ?? 0,
      classClearanceB ?? 0,
      directA ?? 0,
      directB ?? 0,
    )
  }

  public getMaxClearanceForId(elementId: string, baseMinClearance = 0): number {
    const classId = this.getNetClassForId(elementId)
    const direct = this.getDirectClearanceForId(elementId)
    const ownClassClearance = classId
      ? this.netClasses.get(classId)?.clearance
      : undefined

    let maxReq = Math.max(baseMinClearance, direct ?? 0, ownClassClearance ?? 0)

    if (classId) {
      const row = this.clearanceMatrix[classId]
      if (row) {
        for (const val of Object.values(row)) {
          if (typeof val === "number") maxReq = Math.max(maxReq, val)
        }
      }
      for (const [otherClass, otherClassDef] of this.netClasses.entries()) {
        const matrixVal =
          this.clearanceMatrix[classId]?.[otherClass] ??
          this.clearanceMatrix[otherClass]?.[classId]
        if (matrixVal !== undefined) {
          maxReq = Math.max(maxReq, matrixVal)
        } else if (typeof otherClassDef.clearance === "number") {
          maxReq = Math.max(maxReq, otherClassDef.clearance)
        }
      }
    } else {
      for (const otherClassDef of this.netClasses.values()) {
        if (typeof otherClassDef.clearance === "number") {
          maxReq = Math.max(maxReq, otherClassDef.clearance)
        }
      }
    }

    for (const val of this.networkIdToDirectClearance.values()) {
      maxReq = Math.max(maxReq, val)
    }
    for (const val of this.elementIdToDirectClearance.values()) {
      maxReq = Math.max(maxReq, val)
    }

    return Math.max(maxReq, this.maxConfiguredClearance)
  }
}

export function createNetClassClearanceManager(
  circuitJson: AnyCircuitElement[],
  options?: NetClassClearanceOptions,
): NetClassClearanceManager {
  return new NetClassClearanceManager(circuitJson, options)
}
