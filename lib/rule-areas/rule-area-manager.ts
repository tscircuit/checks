import {
  cju,
  distanceBetweenCircleAndCircle,
  distanceBetweenCircleAndPolygon,
  distanceBetweenPolygonAndPolygon,
  getPrimaryId,
} from "@tscircuit/circuit-json-util"
import { type Point, segmentToCircleMinDistance } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PCBKeepout,
  PcbComponent,
  PcbPlatedHole,
  PcbSmtPad,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  getPadCenter,
  getPadToPadGap,
  getPads,
} from "../check-pad-clearance/common"
import {
  getRotatedRectPoints,
  getSegmentToPolygonClearanceFromPoints,
} from "../check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"
import { DEFAULT_TRACE_THICKNESS, EPSILON } from "../drc-defaults"
import {
  courtyardToKeepout,
  type CourtyardElement,
} from "../util/courtyard-to-keepout"
import {
  getReadableNameForComponent,
  getReadableNameForElementId,
} from "../util/get-readable-names"
import type {
  PcbMissingComponentGeometryError,
  PcbRuleAreaViolationError,
  PcbRuleAreaViolationWarning,
  RuleAreaDiagnostic,
  RuleAreaInput,
  RuleAreaRule,
  TransformedRuleArea,
} from "./types"

export function parseDimension(
  val: number | string | undefined,
  defaultVal = 0,
): number {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const trimmed = val.trim().toLowerCase()
    if (trimmed.endsWith("mm")) {
      return parseFloat(trimmed.slice(0, -2))
    }
    if (trimmed.endsWith("um")) {
      return parseFloat(trimmed.slice(0, -2)) / 1000
    }
    if (trimmed.endsWith("in") || trimmed.endsWith("inch")) {
      return parseFloat(trimmed) * 25.4
    }
    const parsed = parseFloat(trimmed)
    return isNaN(parsed) ? defaultVal : parsed
  }
  return defaultVal
}

function rotatePoint(point: Point, angleDegrees: number): Point {
  const rad = (angleDegrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

function normalizeNet(name: string): string {
  return name.toLowerCase().replace(/^(net\.|source_net_)/, "")
}

function isNetMatching(
  netName: string | undefined,
  allowedNets: string[],
): boolean {
  if (!netName) return false
  const norm = normalizeNet(netName)
  return allowedNets.some((allowed) => {
    if (allowed.toLowerCase() === netName.toLowerCase()) return true
    return normalizeNet(allowed) === norm
  })
}

export class RuleAreaManager {
  circuitJson: AnyCircuitElement[]
  connMap?: ConnectivityMap
  rawRuleAreas: RuleAreaInput[] = []
  transformedRuleAreas: TransformedRuleArea[] = []

  constructor(
    circuitJson: AnyCircuitElement[],
    options: {
      ruleAreas?: RuleAreaInput[]
      connMap?: ConnectivityMap
    } = {},
  ) {
    this.circuitJson = circuitJson
    this.connMap = options.connMap
    this.collectRuleAreas(options.ruleAreas)
    this.transformAllRuleAreas()
  }

  private collectRuleAreas(extraRuleAreas?: RuleAreaInput[]) {
    // 1. Elements of type "pcb_rule_area"
    for (const el of this.circuitJson) {
      if ((el as any).type === "pcb_rule_area") {
        this.rawRuleAreas.push(el as any as RuleAreaInput)
      } else if (
        el.type === "pcb_keepout" &&
        Array.isArray((el as any).rules) &&
        (el as any).rules.length > 0
      ) {
        this.rawRuleAreas.push({
          ...(el as any),
          rule_area_id: (el as any).rule_area_id ?? el.pcb_keepout_id,
        })
      } else if ((el as any).type === "source_rule_area") {
        const sourceArea = el as any
        const pcbComp = sourceArea.source_component_id
          ? (this.circuitJson.find(
              (e) =>
                e.type === "pcb_component" &&
                e.source_component_id === sourceArea.source_component_id,
            ) as PcbComponent | undefined)
          : undefined
        this.rawRuleAreas.push({
          ...sourceArea,
          rule_area_id:
            sourceArea.rule_area_id ?? sourceArea.source_rule_area_id,
          pcb_component_id:
            pcbComp?.pcb_component_id ?? sourceArea.pcb_component_id,
        })
      }
    }

    // 2. Extra rule areas passed via options
    if (extraRuleAreas?.length) {
      this.rawRuleAreas.push(...extraRuleAreas)
    }
  }

  private transformAllRuleAreas() {
    this.transformedRuleAreas = this.rawRuleAreas.map((ra, idx) =>
      this.transformRuleArea(ra, idx),
    )
  }

  private transformRuleArea(
    ra: RuleAreaInput,
    index: number,
  ): TransformedRuleArea {
    const ruleAreaId =
      ra.rule_area_id ??
      ra.pcb_rule_area_id ??
      ra.pcb_keepout_id ??
      `rule_area_${index + 1}`

    const ownerComponent = ra.pcb_component_id
      ? (this.circuitJson.find(
          (e) =>
            e.type === "pcb_component" &&
            e.pcb_component_id === ra.pcb_component_id,
        ) as PcbComponent | undefined)
      : undefined

    const isWorld = ra.is_world_coordinates === true || !ownerComponent
    const compCenter = ownerComponent?.center ?? { x: 0, y: 0 }
    const compRot =
      ownerComponent?.rotation ?? (ownerComponent as any)?.ccw_rotation ?? 0
    const compLayer = ownerComponent?.layer ?? "top"
    const isBottom = compLayer === "bottom"

    // Layer mapping: use explicit layers if provided, otherwise default to component layer or both
    const layers: string[] =
      ra.layers && ra.layers.length > 0
        ? ra.layers
        : ownerComponent
          ? [compLayer]
          : ["top", "bottom"]

    const localCenter = ra.center ?? { x: 0, y: 0 }
    let worldCenter: Point

    if (isWorld) {
      worldCenter = localCenter
    } else {
      let px = localCenter.x
      const py = localCenter.y
      if (isBottom) px = -px
      const rotated = rotatePoint({ x: px, y: py }, compRot)
      worldCenter = {
        x: compCenter.x + rotated.x,
        y: compCenter.y + rotated.y,
      }
    }

    const shape = ra.shape ?? (ra.radius ? "circle" : "rect")

    if (shape === "circle") {
      const radius = parseDimension(ra.radius, 1)
      return {
        rule_area_id: ruleAreaId,
        pcb_rule_area_id: ra.pcb_rule_area_id,
        pcb_keepout_id: ra.pcb_keepout_id,
        name: ra.name,
        description: ra.description,
        pcb_component_id: ra.pcb_component_id,
        source_component_id: ra.source_component_id,
        layers,
        shape: "circle",
        circle: { center: worldCenter, radius },
        rules: ra.rules ?? [],
        subcircuit_id: ra.subcircuit_id,
      }
    }

    let polygon: Point[]
    if (shape === "polygon" || shape === "outline") {
      const pts = ra.points ?? ra.outline ?? []
      if (isWorld) {
        polygon = pts
      } else {
        polygon = pts.map((p) => {
          let px = p.x
          const py = p.y
          if (isBottom) px = -px
          const rotated = rotatePoint({ x: px, y: py }, compRot)
          return {
            x: compCenter.x + rotated.x,
            y: compCenter.y + rotated.y,
          }
        })
      }
    } else {
      // Default to "rect"
      const width = parseDimension(ra.width, 2)
      const height = parseDimension(ra.height, 2)
      let totalRot = 0
      if (!isWorld) {
        totalRot = isBottom ? (360 - compRot) % 360 : compRot
      }
      polygon = getRotatedRectPoints({
        x: worldCenter.x,
        y: worldCenter.y,
        width,
        height,
        ccwRotation: totalRot,
      })
    }

    return {
      rule_area_id: ruleAreaId,
      pcb_rule_area_id: ra.pcb_rule_area_id,
      pcb_keepout_id: ra.pcb_keepout_id,
      name: ra.name,
      description: ra.description,
      pcb_component_id: ra.pcb_component_id,
      source_component_id: ra.source_component_id,
      layers,
      shape: "polygon",
      polygon,
      rules: ra.rules ?? [],
      subcircuit_id: ra.subcircuit_id,
    }
  }

  getTransformedRuleAreas(): TransformedRuleArea[] {
    return this.transformedRuleAreas
  }

  private ruleAreaToKeepout(ra: TransformedRuleArea): PCBKeepout {
    const common = {
      type: "pcb_keepout" as const,
      pcb_keepout_id: ra.pcb_keepout_id ?? ra.rule_area_id,
      layers: ra.layers as any,
    }

    if (ra.shape === "circle" && ra.circle) {
      return {
        ...common,
        shape: "circle",
        center: ra.circle.center,
        radius: ra.circle.radius,
      }
    }

    return {
      ...common,
      shape: "outline",
      outline: ra.polygon ?? [],
      stroke_width: 0,
    }
  }

  private getComponentInfo(comp: PcbComponent) {
    const sourceComponent = comp.source_component_id
      ? (this.circuitJson.find(
          (e) =>
            e.type === "source_component" &&
            e.source_component_id === comp.source_component_id,
        ) as any)
      : undefined

    const ref =
      sourceComponent?.name ?? (comp as any).name ?? comp.pcb_component_id

    const classes: string[] = []
    if (Array.isArray(sourceComponent?.component_classes)) {
      classes.push(...sourceComponent.component_classes)
    }
    if (Array.isArray(sourceComponent?.classes)) {
      classes.push(...sourceComponent.classes)
    }
    if (Array.isArray((comp as any).component_classes)) {
      classes.push(...(comp as any).component_classes)
    }
    if (sourceComponent?.ftype) {
      classes.push(sourceComponent.ftype)
    }

    return { ref, classes, sourceComponent }
  }

  private isComponentExempt(
    comp: PcbComponent,
    ra: TransformedRuleArea,
    rule: RuleAreaRule,
  ): boolean {
    if (rule.excludeOwner && ra.pcb_component_id === comp.pcb_component_id) {
      return true
    }
    const { ref, classes } = this.getComponentInfo(comp)
    if (
      rule.excludeRefs?.some(
        (r) =>
          r.toLowerCase() === ref.toLowerCase() || r === comp.pcb_component_id,
      )
    ) {
      return true
    }
    if (
      rule.excludeComponentClasses?.some((ec) =>
        classes.some((c) => c.toLowerCase() === ec.toLowerCase()),
      )
    ) {
      return true
    }
    return false
  }

  private getElementNet(element: AnyCircuitElement): string | undefined {
    const primaryId = getPrimaryId(element)
    if (this.connMap) {
      const net = this.connMap.getNetConnectedToId(primaryId)
      if (net) return net
    }

    if ("pcb_port_id" in element && element.pcb_port_id) {
      const portNet = this.getPortNet(element.pcb_port_id as string)
      if (portNet) return portNet
    }

    if ("source_net_id" in element && element.source_net_id) {
      const sn = this.circuitJson.find(
        (e) =>
          e.type === "source_net" && e.source_net_id === element.source_net_id,
      ) as any
      if (sn?.name) return sn.name
      return element.source_net_id as string
    }

    if ("source_trace_id" in element && element.source_trace_id) {
      const st = this.circuitJson.find(
        (e) =>
          e.type === "source_trace" &&
          e.source_trace_id === element.source_trace_id,
      ) as any
      if (st?.connected_source_net_ids?.[0]) {
        const sn = this.circuitJson.find(
          (e) =>
            e.type === "source_net" &&
            e.source_net_id === st.connected_source_net_ids[0],
        ) as any
        if (sn?.name) return sn.name
        return st.connected_source_net_ids[0]
      }
    }

    return undefined
  }

  private getPortNet(portId: string): string | undefined {
    if (this.connMap) {
      const net = this.connMap.getNetConnectedToId(portId)
      if (net) return net
    }
    const pcbPort = this.circuitJson.find(
      (e) => e.type === "pcb_port" && e.pcb_port_id === portId,
    ) as any
    if (pcbPort?.source_port_id) {
      const sourcePort = this.circuitJson.find(
        (e) =>
          e.type === "source_port" &&
          e.source_port_id === pcbPort.source_port_id,
      ) as any
      if (sourcePort?.source_net_id) {
        const sn = this.circuitJson.find(
          (e) =>
            e.type === "source_net" &&
            e.source_net_id === sourcePort.source_net_id,
        ) as any
        if (sn?.name) return sn.name
        return sourcePort.source_net_id
      }
      if (sourcePort?.name) return sourcePort.name
    }
    return undefined
  }

  public checkRuleAreas(): RuleAreaDiagnostic[] {
    const diagnostics: RuleAreaDiagnostic[] = []
    const emittedViolationIds = new Set<string>()

    const pcbComponents = this.circuitJson.filter(
      (e): e is PcbComponent => e.type === "pcb_component",
    )
    const pcbPads = getPads(this.circuitJson)
    const pcbTraces = cju(this.circuitJson).pcb_trace.list() as PcbTrace[]
    const pcbVias = cju(this.circuitJson).pcb_via.list() as PcbVia[]

    const courtyards = this.circuitJson.filter(
      (e): e is CourtyardElement =>
        e.type === "pcb_courtyard_rect" ||
        e.type === "pcb_courtyard_circle" ||
        e.type === "pcb_courtyard_outline" ||
        e.type === "pcb_courtyard_polygon",
    )

    for (const ra of this.transformedRuleAreas) {
      const keepout = this.ruleAreaToKeepout(ra)

      for (const rule of ra.rules) {
        const requiredClearance = parseDimension(rule.constraint?.clearance, 0)
        const isDisallowOrOutside =
          rule.constraint?.type === "outside" ||
          rule.constraint?.type === "disallow" ||
          !rule.constraint?.type

        if (!isDisallowOrOutside) continue

        const targets = new Set(rule.targets)
        const checkComponents =
          targets.has("component") || targets.has("footprint")
        const checkPads = targets.has("pad")
        const checkTracks = targets.has("track") || targets.has("trace")
        const checkVias = targets.has("via")

        // 1. Check components
        if (checkComponents) {
          for (const comp of pcbComponents) {
            const compLayer = comp.layer ?? "top"
            if (!ra.layers.includes(compLayer)) continue

            if (this.isComponentExempt(comp, ra, rule)) continue

            // Determine component occupancy geometry
            const compCourtyards = courtyards.filter(
              (c) => c.pcb_component_id === comp.pcb_component_id,
            )
            const compPads = pcbPads.filter(
              (p) =>
                "pcb_component_id" in p &&
                p.pcb_component_id === comp.pcb_component_id,
            )

            let geometriesToCheck: Array<
              PCBKeepout | PcbSmtPad | PcbPlatedHole
            > = []
            if (compCourtyards.length > 0) {
              geometriesToCheck = compCourtyards.map(courtyardToKeepout)
            } else if (compPads.length > 0) {
              geometriesToCheck = compPads
            } else if (
              typeof (comp as any).width === "number" &&
              typeof (comp as any).height === "number"
            ) {
              geometriesToCheck = [
                {
                  type: "pcb_keepout",
                  pcb_keepout_id: `body_${comp.pcb_component_id}`,
                  layers: [compLayer],
                  shape: "outline",
                  outline: getRotatedRectPoints({
                    x: comp.center.x,
                    y: comp.center.y,
                    width: (comp as any).width,
                    height: (comp as any).height,
                    ccwRotation:
                      comp.rotation ?? (comp as any).ccw_rotation ?? 0,
                  }),
                  stroke_width: 0,
                },
              ]
            } else {
              // Component geometry missing!
              const missingId = `missing_geom_${comp.pcb_component_id}_${ra.rule_area_id}`
              if (!emittedViolationIds.has(missingId)) {
                emittedViolationIds.add(missingId)
                const name = getReadableNameForComponent(
                  this.circuitJson,
                  comp.pcb_component_id,
                )
                diagnostics.push({
                  type: "pcb_placement_error",
                  error_type: "pcb_placement_error",
                  pcb_placement_error_id: missingId,
                  message: `Component ${name} (${comp.pcb_component_id}) matches rule area "${ra.name ?? ra.rule_area_id}" but has no courtyard, pad, or body geometry to evaluate occupancy`,
                  severity: "error",
                  pcb_component_id: comp.pcb_component_id,
                  rule_area_id: ra.rule_area_id,
                  rule_id: rule.id,
                  subcircuit_id: comp.subcircuit_id,
                })
              }
              continue
            }

            for (const geom of geometriesToCheck) {
              const gap = getPadToPadGap(geom as any, keepout)
              const violates =
                requiredClearance > 0
                  ? gap < requiredClearance - EPSILON
                  : gap <= EPSILON

              if (violates) {
                const violationId = `${ra.rule_area_id}_${rule.id}_comp_${comp.pcb_component_id}`
                if (emittedViolationIds.has(violationId)) continue
                emittedViolationIds.add(violationId)

                const name = getReadableNameForComponent(
                  this.circuitJson,
                  comp.pcb_component_id,
                )
                const isWarning = rule.severity === "warning"
                const diagCommon = {
                  rule_area_violation_id: violationId,
                  rule_area_id: ra.rule_area_id,
                  rule_id: rule.id,
                  pcb_rule_area_id: ra.pcb_rule_area_id,
                  rule_area_name: ra.name,
                  message: `Component ${name} violates ${isWarning ? "advisory " : ""}rule area "${ra.name ?? ra.rule_area_id}" (rule "${rule.id}"): clearance is ${gap.toFixed(3)}mm, required ${requiredClearance.toFixed(3)}mm`,
                  layer: compLayer,
                  offender_id: comp.pcb_component_id,
                  owner_id: ra.pcb_component_id,
                  center: comp.center,
                  required_clearance: requiredClearance,
                  actual_clearance: gap,
                  pcb_component_ids: [comp.pcb_component_id],
                  subcircuit_id: comp.subcircuit_id,
                }

                if (isWarning) {
                  diagnostics.push({
                    type: "pcb_keepout_overlap_warning",
                    warning_type: "pcb_keepout_overlap_warning",
                    pcb_keepout_id: ra.pcb_keepout_id ?? ra.rule_area_id,
                    pcb_keepout_overlap_warning_id: `pcb_keepout_overlap_warning_${violationId}`,
                    severity: "warning",
                    ...diagCommon,
                  })
                } else {
                  diagnostics.push({
                    type: "pcb_placement_error",
                    error_type: "pcb_placement_error",
                    pcb_placement_error_id: `pcb_placement_error_${violationId}`,
                    severity: "error",
                    ...diagCommon,
                  })
                }
                break
              }
            }
          }
        }

        // 2. Check pads
        if (checkPads) {
          for (const pad of pcbPads) {
            const padLayers =
              pad.type === "pcb_smtpad"
                ? [pad.layer]
                : (pad.layers ?? ["top", "bottom"])
            if (!padLayers.some((l) => ra.layers.includes(l))) continue

            const padCompId =
              "pcb_component_id" in pad ? pad.pcb_component_id : undefined

            if (
              rule.excludeOwner &&
              padCompId &&
              ra.pcb_component_id === padCompId
            ) {
              continue
            }

            if (padCompId) {
              const comp = pcbComponents.find(
                (c) => c.pcb_component_id === padCompId,
              )
              if (comp && this.isComponentExempt(comp, ra, rule)) {
                continue
              }
            }

            if (rule.exceptNets?.length) {
              const net = this.getElementNet(pad)
              if (net && isNetMatching(net, rule.exceptNets)) {
                continue
              }
            }

            const gap = getPadToPadGap(pad, keepout)
            const violates =
              requiredClearance > 0
                ? gap < requiredClearance - EPSILON
                : gap <= EPSILON

            if (violates) {
              const padId = getPrimaryId(pad)
              const violationId = `${ra.rule_area_id}_${rule.id}_pad_${padId}`
              if (emittedViolationIds.has(violationId)) continue
              emittedViolationIds.add(violationId)

              const isWarning = rule.severity === "warning"
              const diagCommon = {
                rule_area_violation_id: violationId,
                rule_area_id: ra.rule_area_id,
                rule_id: rule.id,
                pcb_rule_area_id: ra.pcb_rule_area_id,
                rule_area_name: ra.name,
                message: `Pad ${padId} violates ${isWarning ? "advisory " : ""}rule area "${ra.name ?? ra.rule_area_id}" (rule "${rule.id}"): clearance is ${gap.toFixed(3)}mm, required ${requiredClearance.toFixed(3)}mm`,
                layer: padLayers[0],
                offender_id: padId,
                owner_id: ra.pcb_component_id,
                center: getPadCenter(pad),
                required_clearance: requiredClearance,
                actual_clearance: gap,
                ...(padCompId ? { pcb_component_ids: [padCompId] } : {}),
                ...(pad.type === "pcb_smtpad"
                  ? { pcb_smtpad_ids: [padId] }
                  : { pcb_plated_hole_ids: [padId] }),
                subcircuit_id: pad.subcircuit_id,
              }

              if (isWarning) {
                diagnostics.push({
                  type: "pcb_keepout_overlap_warning",
                  warning_type: "pcb_keepout_overlap_warning",
                  pcb_keepout_id: ra.pcb_keepout_id ?? ra.rule_area_id,
                  pcb_keepout_overlap_warning_id: `pcb_keepout_overlap_warning_${violationId}`,
                  severity: "warning",
                  ...diagCommon,
                })
              } else {
                diagnostics.push({
                  type: "pcb_placement_error",
                  error_type: "pcb_placement_error",
                  pcb_placement_error_id: `pcb_placement_error_${violationId}`,
                  severity: "error",
                  ...diagCommon,
                })
              }
            }
          }
        }

        // 3. Check traces
        if (checkTracks) {
          for (const trace of pcbTraces) {
            if (rule.exceptNets?.length) {
              const net = this.getElementNet(trace)
              if (net && isNetMatching(net, rule.exceptNets)) {
                continue
              }
            }

            const route = (trace as any).route ?? []

            for (let i = 0; i < route.length - 1; i++) {
              const p1 = route[i]
              const p2 = route[i + 1]
              const segLayer =
                p1.layer ?? p2.layer ?? (trace as any).layer ?? "top"
              if (!ra.layers.includes(segLayer)) continue

              const thickness =
                p1.width ?? (trace as any).width ?? DEFAULT_TRACE_THICKNESS
              let gap: number
              let center: Point

              if (ra.shape === "polygon" && ra.polygon) {
                const res = getSegmentToPolygonClearanceFromPoints(
                  { x: p1.x, y: p1.y },
                  { x: p2.x, y: p2.y },
                  ra.polygon,
                )
                gap = res.distance - thickness / 2
                center = res.center
              } else if (ra.shape === "circle" && ra.circle) {
                const dist = segmentToCircleMinDistance(
                  { x: p1.x, y: p1.y },
                  { x: p2.x, y: p2.y },
                  {
                    x: ra.circle.center.x,
                    y: ra.circle.center.y,
                    radius: ra.circle.radius,
                  },
                )
                gap = dist - thickness / 2
                center = ra.circle.center
              } else {
                continue
              }

              const violates =
                requiredClearance > 0
                  ? gap < requiredClearance - EPSILON
                  : gap <= EPSILON

              if (violates) {
                const violationId = `${ra.rule_area_id}_${rule.id}_trace_${trace.pcb_trace_id}`
                if (emittedViolationIds.has(violationId)) break
                emittedViolationIds.add(violationId)

                const isWarning = rule.severity === "warning"
                const diagCommon = {
                  rule_area_violation_id: violationId,
                  rule_area_id: ra.rule_area_id,
                  rule_id: rule.id,
                  pcb_rule_area_id: ra.pcb_rule_area_id,
                  rule_area_name: ra.name,
                  message: `Trace ${trace.pcb_trace_id} violates ${isWarning ? "advisory " : ""}rule area "${ra.name ?? ra.rule_area_id}" (rule "${rule.id}"): clearance is ${gap.toFixed(3)}mm, required ${requiredClearance.toFixed(3)}mm`,
                  layer: segLayer,
                  offender_id: trace.pcb_trace_id,
                  owner_id: ra.pcb_component_id,
                  center,
                  required_clearance: requiredClearance,
                  actual_clearance: gap,
                  pcb_trace_ids: [trace.pcb_trace_id],
                  subcircuit_id: trace.subcircuit_id,
                }

                if (isWarning) {
                  diagnostics.push({
                    type: "pcb_keepout_overlap_warning",
                    warning_type: "pcb_keepout_overlap_warning",
                    pcb_keepout_id: ra.pcb_keepout_id ?? ra.rule_area_id,
                    pcb_keepout_overlap_warning_id: `pcb_keepout_overlap_warning_${violationId}`,
                    severity: "warning",
                    ...diagCommon,
                  })
                } else {
                  diagnostics.push({
                    type: "pcb_placement_error",
                    error_type: "pcb_placement_error",
                    pcb_placement_error_id: `pcb_placement_error_${violationId}`,
                    severity: "error",
                    ...diagCommon,
                  })
                }
                break
              }
            }
          }
        }

        // 4. Check vias
        if (checkVias) {
          for (const via of pcbVias) {
            const viaLayers = via.layers ?? ["top", "bottom"]
            if (!viaLayers.some((l) => ra.layers.includes(l))) continue

            if (rule.exceptNets?.length) {
              const net = this.getElementNet(via)
              if (net && isNetMatching(net, rule.exceptNets)) {
                continue
              }
            }

            const gap = getPadToPadGap(via, keepout)
            const violates =
              requiredClearance > 0
                ? gap < requiredClearance - EPSILON
                : gap <= EPSILON

            if (violates) {
              const violationId = `${ra.rule_area_id}_${rule.id}_via_${via.pcb_via_id}`
              if (emittedViolationIds.has(violationId)) continue
              emittedViolationIds.add(violationId)

              const isWarning = rule.severity === "warning"
              const diagCommon = {
                rule_area_violation_id: violationId,
                rule_area_id: ra.rule_area_id,
                rule_id: rule.id,
                pcb_rule_area_id: ra.pcb_rule_area_id,
                rule_area_name: ra.name,
                message: `Via ${via.pcb_via_id} violates ${isWarning ? "advisory " : ""}rule area "${ra.name ?? ra.rule_area_id}" (rule "${rule.id}"): clearance is ${gap.toFixed(3)}mm, required ${requiredClearance.toFixed(3)}mm`,
                layer: viaLayers[0],
                offender_id: via.pcb_via_id,
                owner_id: ra.pcb_component_id,
                center: { x: via.x, y: via.y },
                required_clearance: requiredClearance,
                actual_clearance: gap,
                pcb_via_ids: [via.pcb_via_id],
                subcircuit_id: via.subcircuit_id,
              }

              if (isWarning) {
                diagnostics.push({
                  type: "pcb_keepout_overlap_warning",
                  warning_type: "pcb_keepout_overlap_warning",
                  pcb_keepout_id: ra.pcb_keepout_id ?? ra.rule_area_id,
                  pcb_keepout_overlap_warning_id: `pcb_keepout_overlap_warning_${violationId}`,
                  severity: "warning",
                  ...diagCommon,
                })
              } else {
                diagnostics.push({
                  type: "pcb_placement_error",
                  error_type: "pcb_placement_error",
                  pcb_placement_error_id: `pcb_placement_error_${violationId}`,
                  severity: "error",
                  ...diagCommon,
                })
              }
            }
          }
        }
      }
    }

    return diagnostics
  }
}
