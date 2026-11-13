import { cju, getPrimaryId } from "@tscircuit/circuit-json-util"
import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  LayerRef,
  PcbComponent,
  PcbPlatedHole,
  PcbPort,
  PcbSmtPad,
  PcbTrace,
  PcbVia,
  SourceComponentBase,
  SourceNet,
  SourcePort,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import type { PcbTraceSegment } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import {
  type PadClearanceElement,
  type PadElement,
  type TraceClearanceObstacle,
  getPadBounds,
  getPadCenter,
  getPadToPadGap,
  getPads,
  getTraceObstacleClearance,
  isTraceObstacleOverlap,
} from "lib/check-pad-clearance/common"
import type { Bounds } from "lib/data-structures/SpatialIndex"
import { EPSILON } from "lib/drc-defaults"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"

export type RawPadGroupInput = string[] | string[][]

export interface NetTieDefinition {
  net_tie_id?: string
  /** Net names (e.g. ["AGND", "DGND"]), source_net_ids, or connectivity net IDs joined at this tie */
  nets?: string[]
  /** Specific PCB port IDs joined at this tie */
  pcb_port_ids?: string[]
  /** Specific PCB pad / plated hole IDs joined at this tie */
  pcb_pad_ids?: string[]
  /** Backing net-tie PCB component ID */
  pcb_component_id?: string
  /** Backing net-tie source component ID */
  source_component_id?: string
  /** Tie center in mm for point/region net ties */
  center?: { x: number; y: number }
  /** Tie region width in mm (used with center) */
  width?: number
  /** Tie region height in mm (used with center) */
  height?: number
  /** Tie region radius in mm (used with center; defaults to 0.25mm when center is set without pads) */
  radius?: number
  /** Copper layer where the tie occurs */
  layer?: LayerRef
  /** Copper layers where the tie occurs */
  layers?: LayerRef[]
  /** Optional extra clearance exemption margin around the tie copper */
  clearance_margin?: number
}

export interface ResolvedNetTieGroup {
  id: string
  netIds: Set<string>
  memberElementIds: Set<string>
  bounds: Bounds
  layers: Set<LayerRef> | null
  clearanceMargin: number
}

interface LineSegment2D {
  x1: number
  y1: number
  x2: number
  y2: number
}

const DEFAULT_POINT_TIE_RADIUS_MM = 0.25

const normalizePinToken = (token: string): string[] => {
  const trimmed = token.trim()
  if (!trimmed) return []
  const lower = trimmed.toLowerCase()
  const variants = new Set<string>([trimmed, lower])
  const pinMatch = /^pin[_-]?(\d+)$/i.exec(trimmed)
  if (pinMatch?.[1]) {
    variants.add(pinMatch[1])
  } else if (/^\d+$/.test(trimmed)) {
    variants.add(`pin${trimmed}`)
  }
  return [...variants]
}

export const parseNetTiePadGroups = (
  rawGroups: unknown,
): string[][] | undefined => {
  if (!Array.isArray(rawGroups) || rawGroups.length === 0) return undefined

  if (rawGroups.every((entry) => Array.isArray(entry))) {
    const groups = (rawGroups as unknown[][])
      .map((group) =>
        group
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0),
      )
      .filter((group) => group.length >= 2)
    return groups.length > 0 ? groups : undefined
  }

  const stringEntries = rawGroups
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0)
  if (stringEntries.length === 0) return undefined

  const hasGroupDelimiters = stringEntries.some((entry) => /[,;\s]/.test(entry))
  if (!hasGroupDelimiters) {
    return stringEntries.length >= 2 ? [stringEntries] : undefined
  }

  const groups = stringEntries
    .map((entry) =>
      entry
        .split(/[,;\s]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0),
    )
    .filter((group) => group.length >= 2)
  return groups.length > 0 ? groups : undefined
}

export const isNetTieComponentRecord = (
  element: Record<string, unknown>,
): boolean => {
  if (element.is_net_tie === true) return true
  if (element.ftype === "net_tie") return true
  if (
    Array.isArray(element.net_tie_pad_groups) &&
    element.net_tie_pad_groups.length > 0
  ) {
    return true
  }
  return false
}

const unionBounds = (boundsList: Bounds[]): Bounds | undefined => {
  if (boundsList.length === 0) return undefined
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const b of boundsList) {
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  return { minX, minY, maxX, maxY }
}

export const expandBounds = (bounds: Bounds, margin: number): Bounds => ({
  minX: bounds.minX - margin,
  minY: bounds.minY - margin,
  maxX: bounds.maxX + margin,
  maxY: bounds.maxY + margin,
})

const pointInBounds = (
  point: { x: number; y: number },
  bounds: Bounds,
): boolean =>
  point.x >= bounds.minX &&
  point.x <= bounds.maxX &&
  point.y >= bounds.minY &&
  point.y <= bounds.maxY

const boundsOverlap = (a: Bounds, b: Bounds): boolean =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY

const subtractBoxFromSingleSegment = (
  seg: LineSegment2D,
  box: Bounds,
): LineSegment2D[] => {
  const dx = seg.x2 - seg.x1
  const dy = seg.y2 - seg.y1

  if (Math.abs(dx) <= 1e-12 && Math.abs(dy) <= 1e-12) {
    return pointInBounds({ x: seg.x1, y: seg.y1 }, box) ? [] : [seg]
  }

  let t0 = 0
  let t1 = 1
  const checks: [number, number][] = [
    [-dx, seg.x1 - box.minX],
    [dx, box.maxX - seg.x1],
    [-dy, seg.y1 - box.minY],
    [dy, box.maxY - seg.y1],
  ]

  for (const [p, q] of checks) {
    if (Math.abs(p) <= 1e-12) {
      if (q < 0) return [seg]
      continue
    }
    const r = q / p
    if (p < 0) {
      if (r > t1) return [seg]
      if (r > t0) t0 = r
    } else {
      if (r < t0) return [seg]
      if (r < t1) t1 = r
    }
  }

  if (t0 > t1) return [seg]

  const result: LineSegment2D[] = []
  if (t0 > 1e-9) {
    result.push({
      x1: seg.x1,
      y1: seg.y1,
      x2: seg.x1 + dx * t0,
      y2: seg.y1 + dy * t0,
    })
  }
  if (t1 < 1 - 1e-9) {
    result.push({
      x1: seg.x1 + dx * t1,
      y1: seg.y1 + dy * t1,
      x2: seg.x2,
      y2: seg.y2,
    })
  }
  return result
}

const subtractBoxesFromSegment = (
  seg: LineSegment2D,
  boxes: Bounds[],
): LineSegment2D[] => {
  let parts: LineSegment2D[] = [seg]
  for (const box of boxes) {
    parts = parts.flatMap((part) => subtractBoxFromSingleSegment(part, box))
    if (parts.length === 0) break
  }
  return parts
}

const hasPotentialNetTieData = (
  circuitJson: AnyCircuitElement[],
  netTies?: NetTieDefinition[],
): boolean => {
  if (netTies && netTies.length > 0) return true
  for (const element of circuitJson) {
    const rec = element as unknown as Record<string, unknown>
    if (rec.type === "pcb_net_tie" || rec.type === "source_net_tie") {
      return true
    }
    if (
      (element.type === "source_component" ||
        element.type === "pcb_component") &&
      isNetTieComponentRecord(rec)
    ) {
      return true
    }
    if (element.type === "pcb_board") {
      if (Array.isArray(rec.net_ties) && rec.net_ties.length > 0) return true
      const drcConfig = rec.drc_config as Record<string, unknown> | undefined
      if (
        drcConfig &&
        Array.isArray(drcConfig.net_ties) &&
        drcConfig.net_ties.length > 0
      ) {
        return true
      }
    }
  }
  return false
}

export class NetTieManager {
  readonly groups: ResolvedNetTieGroup[] = []
  readonly netTieSourceComponentIds = new Set<string>()
  readonly netTiePcbComponentIds = new Set<string>()
  private readonly connMap?: ConnectivityMap

  constructor(
    circuitJson: AnyCircuitElement[],
    options: {
      connMap?: ConnectivityMap
      netTies?: NetTieDefinition[]
    } = {},
  ) {
    if (!hasPotentialNetTieData(circuitJson, options.netTies)) {
      return
    }

    const connMap =
      options.connMap ?? getFullConnectivityMapFromCircuitJson(circuitJson)
    this.connMap = connMap

    const db = cju(circuitJson)
    const sourceComponents = db.source_component.list() as SourceComponentBase[]
    const pcbComponents = db.pcb_component.list() as PcbComponent[]
    const sourcePorts = db.source_port.list() as SourcePort[]
    const pcbPorts = db.pcb_port.list() as PcbPort[]
    const sourceNets = db.source_net.list() as SourceNet[]
    const allPads = getPads(circuitJson)

    const padById = new Map<string, PadElement>()
    const padsByPcbPortId = new Map<string, PadElement[]>()
    const padsByPcbComponentId = new Map<string, PadElement[]>()

    for (const pad of allPads) {
      const id = getPrimaryId(pad)
      padById.set(id, pad)
      if (pad.pcb_port_id) {
        const list = padsByPcbPortId.get(pad.pcb_port_id) ?? []
        list.push(pad)
        padsByPcbPortId.set(pad.pcb_port_id, list)
      }
      if (pad.pcb_component_id) {
        const list = padsByPcbComponentId.get(pad.pcb_component_id) ?? []
        list.push(pad)
        padsByPcbComponentId.set(pad.pcb_component_id, list)
      }
    }

    const pcbPortById = new Map<string, PcbPort>(
      pcbPorts.map((port) => [port.pcb_port_id, port]),
    )
    const sourcePortById = new Map<string, SourcePort>(
      sourcePorts.map((port) => [port.source_port_id, port]),
    )
    const sourceComponentById = new Map<string, SourceComponentBase>(
      sourceComponents.map((comp) => [comp.source_component_id, comp]),
    )
    const pcbComponentsBySourceId = new Map<string, PcbComponent[]>()
    for (const pcbComp of pcbComponents) {
      if (!pcbComp.source_component_id) continue
      const list =
        pcbComponentsBySourceId.get(pcbComp.source_component_id) ?? []
      list.push(pcbComp)
      pcbComponentsBySourceId.set(pcbComp.source_component_id, list)
    }

    const netRefToConnNetIds = new Map<string, Set<string>>()
    const addNetAlias = (alias: string, connNetId: string) => {
      const trimmed = alias.trim()
      if (!trimmed) return
      for (const key of [trimmed, trimmed.toLowerCase()]) {
        const set = netRefToConnNetIds.get(key) ?? new Set<string>()
        set.add(connNetId)
        netRefToConnNetIds.set(key, set)
      }
    }

    for (const net of sourceNets) {
      const resolved =
        connMap.getNetConnectedToId(net.source_net_id) ?? net.source_net_id
      addNetAlias(net.source_net_id, resolved)
      if (net.name) {
        addNetAlias(net.name, resolved)
      }
    }

    const resolveNetRef = (ref: string): string[] => {
      const direct = connMap.getNetConnectedToId(ref)
      if (direct) return [direct]
      const byAlias =
        netRefToConnNetIds.get(ref.trim()) ??
        netRefToConnNetIds.get(ref.trim().toLowerCase())
      if (byAlias && byAlias.size > 0) return [...byAlias]
      return []
    }

    // 1. Discover component-backed net ties (source_component / pcb_component)
    const handledPcbComponentIds = new Set<string>()

    const buildComponentTieGroups = (
      pcbComp: PcbComponent,
      sourceComp?: SourceComponentBase,
    ) => {
      handledPcbComponentIds.add(pcbComp.pcb_component_id)
      this.netTiePcbComponentIds.add(pcbComp.pcb_component_id)
      if (sourceComp) {
        this.netTieSourceComponentIds.add(sourceComp.source_component_id)
      }

      const compPads = padsByPcbComponentId.get(pcbComp.pcb_component_id) ?? []
      if (compPads.length === 0) return

      const pcbRec = pcbComp as unknown as Record<string, unknown>
      const srcRec = (sourceComp ?? {}) as unknown as Record<string, unknown>
      const rawPadGroups =
        pcbRec.net_tie_pad_groups ?? srcRec.net_tie_pad_groups
      const parsedGroups = parseNetTiePadGroups(rawPadGroups)
      const clearanceMargin =
        typeof pcbRec.clearance_margin === "number"
          ? pcbRec.clearance_margin
          : typeof srcRec.clearance_margin === "number"
            ? srcRec.clearance_margin
            : 0

      const portedPads = compPads.filter((pad) => Boolean(pad.pcb_port_id))
      const unportedPads = compPads.filter((pad) => !pad.pcb_port_id)

      const getTokensForPad = (pad: PadElement): Set<string> => {
        const tokens = new Set<string>()
        const padId = getPrimaryId(pad)
        tokens.add(padId)
        for (const hint of pad.port_hints ?? []) {
          for (const v of normalizePinToken(String(hint))) tokens.add(v)
        }
        if (pad.pcb_port_id) {
          tokens.add(pad.pcb_port_id)
          const pcbPort = pcbPortById.get(pad.pcb_port_id)
          const sourcePort = pcbPort?.source_port_id
            ? sourcePortById.get(pcbPort.source_port_id)
            : undefined
          if (sourcePort) {
            tokens.add(sourcePort.source_port_id)
            if (sourcePort.name) {
              for (const v of normalizePinToken(sourcePort.name)) tokens.add(v)
            }
            if (sourcePort.pin_number !== undefined) {
              for (const v of normalizePinToken(
                String(sourcePort.pin_number),
              )) {
                tokens.add(v)
              }
            }
            for (const hint of sourcePort.port_hints ?? []) {
              for (const v of normalizePinToken(String(hint))) tokens.add(v)
            }
          }
        }
        return tokens
      }

      const padGroupsToBuild: PadElement[][] = []
      if (parsedGroups) {
        const padTokensMap = new Map<PadElement, Set<string>>(
          compPads.map((pad) => [pad, getTokensForPad(pad)]),
        )
        for (const tokenGroup of parsedGroups) {
          const normalizedGroupTokens = new Set(
            tokenGroup.flatMap((token) => normalizePinToken(token)),
          )
          const matched = compPads.filter((pad) => {
            const padTokens = padTokensMap.get(pad)!
            for (const t of normalizedGroupTokens) {
              if (padTokens.has(t)) return true
            }
            return false
          })
          if (matched.length >= 2) {
            padGroupsToBuild.push(matched)
          }
        }
      } else if (portedPads.length >= 2) {
        padGroupsToBuild.push(portedPads)
      } else if (compPads.length >= 2) {
        padGroupsToBuild.push(compPads)
      }

      for (const [groupIdx, groupPads] of padGroupsToBuild.entries()) {
        const memberElementIds = new Set<string>([pcbComp.pcb_component_id])
        if (sourceComp) memberElementIds.add(sourceComp.source_component_id)
        const netIds = new Set<string>()
        const layers = new Set<LayerRef>()
        const groupBoundsList: Bounds[] = []

        const includePad = (pad: PadElement) => {
          const padId = getPrimaryId(pad)
          memberElementIds.add(padId)
          groupBoundsList.push(getPadBounds(pad))
          for (const layer of getLayersOfPcbElement(pad)) {
            layers.add(layer as LayerRef)
          }
          const padNet = connMap.getNetConnectedToId(padId)
          if (padNet) netIds.add(padNet)
          if (pad.pcb_port_id) {
            memberElementIds.add(pad.pcb_port_id)
            const portNet = connMap.getNetConnectedToId(pad.pcb_port_id)
            if (portNet) netIds.add(portNet)
            const pcbPort = pcbPortById.get(pad.pcb_port_id)
            if (pcbPort?.source_port_id) {
              memberElementIds.add(pcbPort.source_port_id)
              const srcNet = connMap.getNetConnectedToId(pcbPort.source_port_id)
              if (srcNet) netIds.add(srcNet)
            }
          }
        }

        for (const pad of groupPads) {
          includePad(pad)
        }

        // Attach unported copper bridge pads on the same component that touch/bridge this group's pads
        for (const bridgePad of unportedPads) {
          const sharesLayer = getLayersOfPcbElement(bridgePad).some((layer) =>
            layers.has(layer as LayerRef),
          )
          if (!sharesLayer) continue
          const touchesGroup = groupPads.some(
            (groupPad) => getPadToPadGap(bridgePad, groupPad) <= EPSILON,
          )
          if (touchesGroup) {
            includePad(bridgePad)
          }
        }

        const mergedBounds = unionBounds(groupBoundsList)
        if (!mergedBounds || netIds.size < 2) continue

        this.groups.push({
          id: `${pcbComp.pcb_component_id}_group_${groupIdx}`,
          netIds,
          memberElementIds,
          bounds: mergedBounds,
          layers: layers.size > 0 ? layers : null,
          clearanceMargin,
        })
      }
    }

    for (const sourceComp of sourceComponents) {
      if (
        isNetTieComponentRecord(
          sourceComp as unknown as Record<string, unknown>,
        )
      ) {
        this.netTieSourceComponentIds.add(sourceComp.source_component_id)
        for (const pcbComp of pcbComponentsBySourceId.get(
          sourceComp.source_component_id,
        ) ?? []) {
          buildComponentTieGroups(pcbComp, sourceComp)
        }
      }
    }

    for (const pcbComp of pcbComponents) {
      if (handledPcbComponentIds.has(pcbComp.pcb_component_id)) continue
      const sourceComp = pcbComp.source_component_id
        ? sourceComponentById.get(pcbComp.source_component_id)
        : undefined
      if (
        isNetTieComponentRecord(pcbComp as unknown as Record<string, unknown>)
      ) {
        buildComponentTieGroups(pcbComp, sourceComp)
      }
    }

    // 2. Discover standalone pcb_net_tie / source_net_tie elements, board.net_ties, and options.netTies
    const explicitDefinitions: NetTieDefinition[] = [...(options.netTies ?? [])]

    for (const element of circuitJson) {
      const rec = element as unknown as Record<string, unknown>
      if (rec.type === "pcb_net_tie" || rec.type === "source_net_tie") {
        explicitDefinitions.push({
          net_tie_id:
            typeof rec.pcb_net_tie_id === "string"
              ? rec.pcb_net_tie_id
              : typeof rec.source_net_tie_id === "string"
                ? rec.source_net_tie_id
                : typeof rec.net_tie_id === "string"
                  ? rec.net_tie_id
                  : undefined,
          nets: Array.isArray(rec.nets)
            ? rec.nets.map(String)
            : Array.isArray(rec.connected_source_net_ids)
              ? rec.connected_source_net_ids.map(String)
              : undefined,
          pcb_port_ids: Array.isArray(rec.pcb_port_ids)
            ? rec.pcb_port_ids.map(String)
            : undefined,
          pcb_pad_ids: Array.isArray(rec.pcb_pad_ids)
            ? rec.pcb_pad_ids.map(String)
            : undefined,
          pcb_component_id:
            typeof rec.pcb_component_id === "string"
              ? rec.pcb_component_id
              : undefined,
          source_component_id:
            typeof rec.source_component_id === "string"
              ? rec.source_component_id
              : undefined,
          center:
            rec.center &&
            typeof rec.center === "object" &&
            typeof (rec.center as { x?: unknown }).x === "number" &&
            typeof (rec.center as { y?: unknown }).y === "number"
              ? (rec.center as { x: number; y: number })
              : typeof rec.x === "number" && typeof rec.y === "number"
                ? { x: rec.x, y: rec.y }
                : undefined,
          width: typeof rec.width === "number" ? rec.width : undefined,
          height: typeof rec.height === "number" ? rec.height : undefined,
          radius: typeof rec.radius === "number" ? rec.radius : undefined,
          layer:
            typeof rec.layer === "string" ? (rec.layer as LayerRef) : undefined,
          layers: Array.isArray(rec.layers)
            ? (rec.layers as LayerRef[])
            : undefined,
          clearance_margin:
            typeof rec.clearance_margin === "number"
              ? rec.clearance_margin
              : undefined,
        })
      } else if (element.type === "pcb_board") {
        if (Array.isArray(rec.net_ties)) {
          explicitDefinitions.push(...(rec.net_ties as NetTieDefinition[]))
        }
        const drcConfig = rec.drc_config as Record<string, unknown> | undefined
        if (drcConfig && Array.isArray(drcConfig.net_ties)) {
          explicitDefinitions.push(
            ...(drcConfig.net_ties as NetTieDefinition[]),
          )
        }
      }
    }

    for (const [idx, def] of explicitDefinitions.entries()) {
      const netIds = new Set<string>()
      const memberElementIds = new Set<string>()
      const boundsList: Bounds[] = []
      const layers = new Set<LayerRef>()

      if (def.layer) layers.add(def.layer)
      for (const layer of def.layers ?? []) layers.add(layer)

      for (const netRef of def.nets ?? []) {
        for (const resolved of resolveNetRef(netRef)) {
          netIds.add(resolved)
        }
      }

      if (def.pcb_component_id) {
        memberElementIds.add(def.pcb_component_id)
        this.netTiePcbComponentIds.add(def.pcb_component_id)
        for (const pad of padsByPcbComponentId.get(def.pcb_component_id) ??
          []) {
          const padId = getPrimaryId(pad)
          memberElementIds.add(padId)
          boundsList.push(getPadBounds(pad))
          for (const layer of getLayersOfPcbElement(pad)) {
            layers.add(layer as LayerRef)
          }
          const padNet = connMap.getNetConnectedToId(padId)
          if (padNet) netIds.add(padNet)
        }
      }

      if (def.source_component_id) {
        memberElementIds.add(def.source_component_id)
        this.netTieSourceComponentIds.add(def.source_component_id)
      }

      for (const portId of def.pcb_port_ids ?? []) {
        memberElementIds.add(portId)
        const portNet = connMap.getNetConnectedToId(portId)
        if (portNet) netIds.add(portNet)
        for (const pad of padsByPcbPortId.get(portId) ?? []) {
          const padId = getPrimaryId(pad)
          memberElementIds.add(padId)
          boundsList.push(getPadBounds(pad))
          for (const layer of getLayersOfPcbElement(pad)) {
            layers.add(layer as LayerRef)
          }
        }
      }

      for (const padId of def.pcb_pad_ids ?? []) {
        memberElementIds.add(padId)
        const padNet = connMap.getNetConnectedToId(padId)
        if (padNet) netIds.add(padNet)
        const pad = padById.get(padId)
        if (pad) {
          boundsList.push(getPadBounds(pad))
          for (const layer of getLayersOfPcbElement(pad)) {
            layers.add(layer as LayerRef)
          }
          if (pad.pcb_port_id) {
            memberElementIds.add(pad.pcb_port_id)
            const portNet = connMap.getNetConnectedToId(pad.pcb_port_id)
            if (portNet) netIds.add(portNet)
          }
        }
      }

      if (def.center) {
        if (def.width !== undefined || def.height !== undefined) {
          const halfW =
            (def.width ?? def.height ?? DEFAULT_POINT_TIE_RADIUS_MM * 2) / 2
          const halfH =
            (def.height ?? def.width ?? DEFAULT_POINT_TIE_RADIUS_MM * 2) / 2
          boundsList.push({
            minX: def.center.x - halfW,
            minY: def.center.y - halfH,
            maxX: def.center.x + halfW,
            maxY: def.center.y + halfH,
          })
        } else {
          const radius =
            def.radius ??
            (boundsList.length === 0 ? DEFAULT_POINT_TIE_RADIUS_MM : 0)
          boundsList.push({
            minX: def.center.x - radius,
            minY: def.center.y - radius,
            maxX: def.center.x + radius,
            maxY: def.center.y + radius,
          })
        }
      }

      const mergedBounds = unionBounds(boundsList)
      if (!mergedBounds || netIds.size < 2) continue

      this.groups.push({
        id: def.net_tie_id ?? `net_tie_${idx}`,
        netIds,
        memberElementIds,
        bounds: mergedBounds,
        layers: layers.size > 0 ? layers : null,
        clearanceMargin: def.clearance_margin ?? 0,
      })
    }
  }

  get hasNetTies(): boolean {
    return this.groups.length > 0
  }

  private getNetId(
    elementId: string,
    explicitSourceNetId?: string,
  ): string | undefined {
    if (!this.connMap) return explicitSourceNetId
    if (explicitSourceNetId) {
      return (
        this.connMap.getNetConnectedToId(explicitSourceNetId) ??
        explicitSourceNetId
      )
    }
    return this.connMap.getNetConnectedToId(elementId)
  }

  private groupAllowsElement(
    group: ResolvedNetTieGroup,
    elementId: string,
    netId: string | undefined,
  ): boolean {
    if (netId !== undefined) {
      return group.netIds.has(netId)
    }
    return group.memberElementIds.has(elementId)
  }

  findMatchingGroups({
    idA,
    idB,
    layers,
    explicitNetA,
    explicitNetB,
  }: {
    idA: string
    idB: string
    layers?: LayerRef[]
    explicitNetA?: string
    explicitNetB?: string
  }): ResolvedNetTieGroup[] {
    if (!this.hasNetTies) return []

    const netA = this.getNetId(idA, explicitNetA)
    const netB = this.getNetId(idB, explicitNetB)

    return this.groups.filter((group) => {
      if (
        layers &&
        layers.length > 0 &&
        group.layers !== null &&
        !layers.some((layer) => group.layers!.has(layer))
      ) {
        return false
      }
      if (!this.groupAllowsElement(group, idA, netA)) return false
      if (!this.groupAllowsElement(group, idB, netB)) return false
      return true
    })
  }

  arePadElementsExempt(
    elemA: PadClearanceElement,
    elemB: PadClearanceElement,
    requiredClearance: number,
  ): boolean {
    if (!this.hasNetTies) return false
    const idA = getPrimaryId(elemA)
    const idB = getPrimaryId(elemB)
    const layersA = getLayersOfPcbElement(elemA) as LayerRef[]
    const layersB = getLayersOfPcbElement(elemB) as LayerRef[]
    const sharedLayers = layersA.filter((layer) => layersB.includes(layer))

    const matching = this.findMatchingGroups({
      idA,
      idB,
      layers: sharedLayers,
    })
    if (matching.length === 0) return false

    const boundsA = getPadBounds(elemA)
    const boundsB = getPadBounds(elemB)
    const centerA = getPadCenter(elemA)
    const centerB = getPadCenter(elemB)
    const mid = {
      x: (centerA.x + centerB.x) / 2,
      y: (centerA.y + centerB.y) / 2,
    }

    return matching.some((group) => {
      const margin =
        Math.max(requiredClearance, group.clearanceMargin) + EPSILON
      const region = expandBounds(group.bounds, margin)
      return (
        boundsOverlap(boundsA, region) &&
        boundsOverlap(boundsB, region) &&
        pointInBounds(mid, region)
      )
    })
  }

  areDifferentNetViasExempt(
    viaA: PcbVia,
    viaB: PcbVia,
    requiredClearance: number,
  ): boolean {
    return this.arePadElementsExempt(viaA, viaB, requiredClearance)
  }

  areSmtPadsCrossNetTied(padA: PcbSmtPad, padB: PcbSmtPad): boolean {
    if (!this.hasNetTies || !this.connMap) return false
    const idA = getPrimaryId(padA)
    const idB = getPrimaryId(padB)
    if (this.connMap.areIdsConnected(idA, idB)) return false
    return this.arePadElementsExempt(padA, padB, 0)
  }

  isSegmentPairExempt(
    segmentA: PcbTraceSegment,
    segmentB: PcbTraceSegment,
    requiredClearance: number,
  ): boolean {
    if (!this.hasNetTies || segmentA.layer !== segmentB.layer) return false
    const matching = this.findMatchingGroups({
      idA: segmentA.pcb_trace_id,
      idB: segmentB.pcb_trace_id,
      layers: [segmentA.layer as LayerRef],
    })
    if (matching.length === 0) return false

    const halfWidthSum = (segmentA.thickness + segmentB.thickness) / 2
    const boxes = matching.map((group) =>
      expandBounds(
        group.bounds,
        Math.max(requiredClearance, group.clearanceMargin) +
          halfWidthSum +
          EPSILON,
      ),
    )

    const outsideA = subtractBoxesFromSegment(segmentA, boxes)
    const outsideB = subtractBoxesFromSegment(segmentB, boxes)
    if (outsideA.length === 0 || outsideB.length === 0) return true

    for (const subA of outsideA) {
      for (const subB of outsideB) {
        const gap =
          segmentToSegmentMinDistance(
            { x: subA.x1, y: subA.y1 },
            { x: subA.x2, y: subA.y2 },
            { x: subB.x1, y: subB.y1 },
            { x: subB.x2, y: subB.y2 },
          ) - halfWidthSum
        if (gap <= requiredClearance - EPSILON) {
          return false
        }
      }
    }
    return true
  }

  isSegmentObstacleExempt(
    segment: PcbTraceSegment,
    obstacle: TraceClearanceObstacle,
    requiredClearance: number,
    { overlapOnly = false }: { overlapOnly?: boolean } = {},
  ): boolean {
    if (!this.hasNetTies) return false
    const obstacleId = getPrimaryId(obstacle)
    const matching = this.findMatchingGroups({
      idA: segment.pcb_trace_id,
      idB: obstacleId,
      layers: [segment.layer as LayerRef],
    })
    if (matching.length === 0) return false

    const obstacleBounds = getPadBounds(obstacle)
    const groupsTouchingObstacle = matching.filter((group) =>
      boundsOverlap(
        obstacleBounds,
        expandBounds(
          group.bounds,
          Math.max(requiredClearance, group.clearanceMargin) + EPSILON,
        ),
      ),
    )
    if (groupsTouchingObstacle.length === 0) return false

    const boxes = groupsTouchingObstacle.map((group) =>
      expandBounds(
        group.bounds,
        Math.max(requiredClearance, group.clearanceMargin) +
          segment.thickness / 2 +
          EPSILON,
      ),
    )

    const outsideSegments = subtractBoxesFromSegment(segment, boxes)
    for (const sub of outsideSegments) {
      const { gap } = getTraceObstacleClearance(
        {
          x1: sub.x1,
          y1: sub.y1,
          x2: sub.x2,
          y2: sub.y2,
          thickness: segment.thickness,
        },
        obstacle,
      )
      if (
        overlapOnly
          ? isTraceObstacleOverlap(gap)
          : gap + EPSILON < requiredClearance
      ) {
        return false
      }
    }
    return true
  }

  isTraceEndpointAnchoredByNetTie(
    trace: PcbTrace,
    point: { x: number; y: number; width: number; layer: LayerRef },
    circuitJson: AnyCircuitElement[],
  ): boolean {
    if (!this.hasNetTies || !this.connMap) return false
    const traceNetId = this.connMap.getNetConnectedToId(trace.pcb_trace_id)
    if (!traceNetId) return false

    for (const group of this.groups) {
      if (!group.netIds.has(traceNetId)) continue
      if (group.layers !== null && !group.layers.has(point.layer)) continue
      const region = expandBounds(
        group.bounds,
        Math.max(point.width / 2, group.clearanceMargin) + EPSILON,
      )
      if (!pointInBounds(point, region)) continue

      if (group.memberElementIds.size > 0) return true

      // For pure point/region net ties without explicit pads, verify peer tied copper reaches the tie
      for (const element of circuitJson) {
        if (
          element.type === "pcb_trace" &&
          element.pcb_trace_id !== trace.pcb_trace_id
        ) {
          const peerNet = this.connMap.getNetConnectedToId(element.pcb_trace_id)
          if (!peerNet || peerNet === traceNetId || !group.netIds.has(peerNet))
            continue
          const hitsRegion = element.route.some(
            (rp) =>
              rp.route_type === "wire" &&
              rp.layer === point.layer &&
              pointInBounds(rp, region),
          )
          if (hitsRegion) return true
        } else if (
          element.type === "pcb_smtpad" ||
          element.type === "pcb_plated_hole" ||
          element.type === "pcb_via"
        ) {
          const elemId = getPrimaryId(element)
          const peerNet = this.connMap.getNetConnectedToId(elemId)
          if (!peerNet || peerNet === traceNetId || !group.netIds.has(peerNet))
            continue
          if (
            getLayersOfPcbElement(element).includes(point.layer) &&
            boundsOverlap(getPadBounds(element as PadClearanceElement), region)
          ) {
            return true
          }
        }
      }
    }
    return false
  }
}

export const getOrCreateNetTieManager = (
  circuitJson: AnyCircuitElement[],
  options: {
    connMap?: ConnectivityMap
    netTieManager?: NetTieManager
    netTies?: NetTieDefinition[]
  } = {},
): NetTieManager => {
  if (options.netTieManager) return options.netTieManager
  return new NetTieManager(circuitJson, {
    connMap: options.connMap,
    netTies: options.netTies,
  })
}
