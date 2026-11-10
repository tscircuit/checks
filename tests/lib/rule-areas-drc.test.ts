import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  checkRuleAreas,
  RuleAreaManager,
  runAllPlacementChecks,
} from "../../index"
import { checkCourtyardOverlap } from "../../lib/check-courtyard-overlap/checkCourtyardOverlap"

describe("Rule Areas DRC (tscircuit/tscircuit#4991)", () => {
  // Fixture 1: MP next to MC on legal grid: no advisory warning; original hard checks remain active.
  test("Fixture 1: MP next to MC on legal grid produces no advisory warning while hard checks remain active", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "src_mp1",
        name: "MP1",
        ftype: "simple_chip",
        component_classes: ["machine-pin"],
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_mp1",
        source_component_id: "src_mp1",
        center: { x: 0, y: 0 },
        layer: "top",
      },
      {
        type: "pcb_courtyard_circle",
        pcb_courtyard_circle_id: "cy_mp1",
        pcb_component_id: "pcb_mp1",
        center: { x: 0, y: 0 },
        radius: 1, // 2mm diameter
        layer: "top",
      },
      {
        type: "pcb_rule_area",
        pcb_rule_area_id: "ra_mp1",
        name: "connector-access",
        pcb_component_id: "pcb_mp1",
        shape: "rect",
        width: 4,
        height: 4,
        layers: ["top", "bottom"],
        rules: [
          {
            id: "component-access",
            targets: ["component", "pad"],
            excludeOwner: true,
            excludeComponentClasses: ["machine-pin", "machine-contact"],
            constraint: { type: "outside", clearance: "0.2mm" },
            severity: "warning",
          },
        ],
      } as any,
      {
        type: "source_component",
        source_component_id: "src_mc1",
        name: "MC1",
        ftype: "simple_chip",
        component_classes: ["machine-contact"],
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_mc1",
        source_component_id: "src_mc1",
        center: { x: 2.5, y: 0 }, // 2.5mm pitch, inside 4mm rule area
        layer: "top",
      },
      {
        type: "pcb_courtyard_circle",
        pcb_courtyard_circle_id: "cy_mc1",
        pcb_component_id: "pcb_mc1",
        center: { x: 2.5, y: 0 },
        radius: 1, // 2mm diameter, legal gap of 0.5mm between courtyards
        layer: "top",
      },
    ]

    const diagnostics = checkRuleAreas(circuitJson)
    expect(diagnostics).toHaveLength(0)

    const courtyardErrors = checkCourtyardOverlap(circuitJson)
    expect(courtyardErrors).toHaveLength(0)
  })

  // Fixture 2: Ordinary capacitor clears physical courtyard but enters advisory area: warning only.
  test("Fixture 2: Ordinary capacitor clears physical courtyard but enters advisory area: warning only", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "src_mp1",
        name: "MP1",
        ftype: "simple_chip",
        component_classes: ["machine-pin"],
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_mp1",
        source_component_id: "src_mp1",
        center: { x: 0, y: 0 },
        layer: "top",
      },
      {
        type: "pcb_courtyard_circle",
        pcb_courtyard_circle_id: "cy_mp1",
        pcb_component_id: "pcb_mp1",
        center: { x: 0, y: 0 },
        radius: 1, // 2mm diameter
        layer: "top",
      },
      {
        type: "pcb_rule_area",
        pcb_rule_area_id: "ra_mp1",
        name: "connector-access",
        pcb_component_id: "pcb_mp1",
        shape: "rect",
        width: 5,
        height: 5,
        layers: ["top"],
        rules: [
          {
            id: "component-access",
            targets: ["component", "pad"],
            excludeOwner: true,
            excludeComponentClasses: ["machine-pin", "machine-contact"],
            constraint: { type: "outside", clearance: "0.2mm" },
            severity: "warning",
          },
        ],
      } as any,
      {
        type: "source_component",
        source_component_id: "src_c1",
        name: "C1",
        ftype: "simple_capacitor",
        component_classes: [],
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_c1",
        source_component_id: "src_c1",
        center: { x: 1.8, y: 0 }, // clears 1mm radius courtyard (gap 0.3mm > 0), enters 2.5mm half-width area
        layer: "top",
      },
      {
        type: "pcb_courtyard_rect",
        pcb_courtyard_rect_id: "cy_c1",
        pcb_component_id: "pcb_c1",
        center: { x: 1.8, y: 0 },
        width: 1,
        height: 1,
        layer: "top",
      },
    ]

    const courtyardErrors = checkCourtyardOverlap(circuitJson)
    expect(courtyardErrors).toHaveLength(0)

    const diagnostics = checkRuleAreas(circuitJson)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.severity).toBe("warning")
    expect(diagnostics[0]?.type).toBe("pcb_keepout_overlap_warning")
    expect((diagnostics[0] as any).rule_id).toBe("component-access")
    expect((diagnostics[0] as any).offender_id).toBe("pcb_c1")
  })

  // Fixture 3: Same component also violates hard courtyard/keepout: error remains regardless of declaration order.
  test("Fixture 3: Component violates both hard courtyard and advisory rule area: error and warning coexist", async () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "src_mp1",
        name: "MP1",
        ftype: "simple_chip",
        component_classes: ["machine-pin"],
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_mp1",
        source_component_id: "src_mp1",
        center: { x: 0, y: 0 },
        layer: "top",
      },
      {
        type: "pcb_courtyard_circle",
        pcb_courtyard_circle_id: "cy_mp1",
        pcb_component_id: "pcb_mp1",
        center: { x: 0, y: 0 },
        radius: 1,
        layer: "top",
      },
      {
        type: "pcb_rule_area",
        pcb_rule_area_id: "ra_mp1",
        name: "connector-access",
        pcb_component_id: "pcb_mp1",
        shape: "rect",
        width: 5,
        height: 5,
        layers: ["top"],
        rules: [
          {
            id: "component-access",
            targets: ["component", "pad"],
            excludeOwner: true,
            excludeComponentClasses: ["machine-pin", "machine-contact"],
            constraint: { type: "outside", clearance: "0.2mm" },
            severity: "warning",
          },
        ],
      } as any,
      {
        type: "source_component",
        source_component_id: "src_c1",
        name: "C1",
        ftype: "simple_capacitor",
        component_classes: [],
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_c1",
        source_component_id: "src_c1",
        center: { x: 0.8, y: 0 }, // Overlaps 1mm radius courtyard AND inside 5mm rule area
        layer: "top",
      },
      {
        type: "pcb_courtyard_rect",
        pcb_courtyard_rect_id: "cy_c1",
        pcb_component_id: "pcb_c1",
        center: { x: 0.8, y: 0 },
        width: 1,
        height: 1,
        layer: "top",
      },
    ]

    const courtyardErrors = checkCourtyardOverlap(circuitJson)
    expect(courtyardErrors.length).toBeGreaterThan(0)

    const ruleAreaDiagnostics = checkRuleAreas(circuitJson)
    expect(ruleAreaDiagnostics).toHaveLength(1)
    expect(ruleAreaDiagnostics[0]?.severity).toBe("warning")

    // In runAllPlacementChecks, both hard errors and advisory warnings are retained
    const allPlacement = await runAllPlacementChecks(circuitJson)
    const hasHardError = allPlacement.some(
      (d: any) =>
        d.error_type === "pcb_placement_error" ||
        d.type === "pcb_courtyard_overlap_error" ||
        d.type === "pcb_footprint_overlap_error",
    )
    const hasAdvisoryWarning = allPlacement.some(
      (d: any) => d.type === "pcb_keepout_overlap_warning",
    )

    expect(hasHardError).toBe(true)
    expect(hasAdvisoryWarning).toBe(true)
  })

  // Fixture 4: Allowed track crossing area; forbidden via: error; allowed GND track passes; non-GND and unconnected track restricted.
  test("Fixture 4: Allowed track crossing area; forbidden via: error; allowed GND track passes; non-GND track restricted", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_net",
        source_net_id: "net_gnd",
        name: "net.GND",
        member_source_group_ids: [],
      },
      {
        type: "source_net",
        source_net_id: "net_vcc",
        name: "net.VCC",
        member_source_group_ids: [],
      },
      {
        type: "pcb_rule_area",
        pcb_rule_area_id: "ra_keepout",
        shape: "rect",
        center: { x: 0, y: 0 },
        width: 4,
        height: 4,
        layers: ["top"],
        is_world_coordinates: true,
        rules: [
          {
            id: "no-vias",
            targets: ["via"],
            constraint: { type: "outside" },
            severity: "error",
          },
          {
            id: "assigned-net-only",
            targets: ["track"],
            exceptNets: ["net.GND"],
            constraint: { type: "outside" },
            severity: "error",
          },
        ],
      } as any,
      // Allowed GND track crossing the area
      {
        type: "source_trace",
        source_trace_id: "st_gnd",
        connected_source_net_ids: ["net_gnd"],
      } as any,
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_gnd",
        source_trace_id: "st_gnd",
        route: [
          { x: -3, y: 0, layer: "top", route_type: "wire", width: 0.2 },
          { x: 3, y: 0, layer: "top", route_type: "wire", width: 0.2 },
        ],
      },
    ]

    // 1. Only GND track present: passes completely
    let diagnostics = checkRuleAreas(circuitJson)
    expect(diagnostics).toHaveLength(0)

    // 2. Add a non-GND (VCC) track crossing the area: fails assigned-net-only
    const withVcc = [
      ...circuitJson,
      {
        type: "source_trace",
        source_trace_id: "st_vcc",
        connected_source_net_ids: ["net_vcc"],
      } as any,
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_vcc",
        source_trace_id: "st_vcc",
        route: [
          { x: 0, y: -3, layer: "top", route_type: "wire", width: 0.2 },
          { x: 0, y: 3, layer: "top", route_type: "wire", width: 0.2 },
        ],
      },
    ]
    diagnostics = checkRuleAreas(withVcc)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.type).toBe("pcb_placement_error")
    expect(diagnostics[0]?.severity).toBe("error")
    expect((diagnostics[0] as any).rule_id).toBe("assigned-net-only")
    expect((diagnostics[0] as any).offender_id).toBe("trace_vcc")

    // 3. Add a via inside the area: fails no-vias
    const withVia: AnyCircuitElement[] = [
      ...circuitJson,
      {
        type: "pcb_via" as const,
        pcb_via_id: "via_forbidden",
        x: 0,
        y: 0,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top", "bottom"],
      },
    ]
    diagnostics = checkRuleAreas(withVia)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.type).toBe("pcb_placement_error")
    expect(diagnostics[0]?.severity).toBe("error")
    expect((diagnostics[0] as any).rule_id).toBe("no-vias")
    expect((diagnostics[0] as any).offender_id).toBe("via_forbidden")
  })

  // Fixture 5: Owner pads exempt; unrelated same-net capacitor not exempt; peer exemption cannot disable another rule.
  test("Fixture 5: Owner pads exempt; unrelated same-net capacitor not exempt; peer exemption cannot disable another rule", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_net",
        source_net_id: "net_gnd",
        name: "net.GND",
        member_source_group_ids: [],
      },
      {
        type: "source_component",
        source_component_id: "src_owner",
        name: "MP1",
        component_classes: ["machine-pin"],
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_owner",
        source_component_id: "src_owner",
        center: { x: 0, y: 0 },
        layer: "top",
      },
      // Owner pad inside rule area
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_owner_1",
        pcb_component_id: "pcb_owner",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      },
      {
        type: "pcb_rule_area",
        pcb_rule_area_id: "ra_owner",
        pcb_component_id: "pcb_owner",
        shape: "rect",
        width: 4,
        height: 4,
        layers: ["top"],
        rules: [
          {
            id: "advisory-access",
            targets: ["pad"],
            excludeOwner: true,
            excludeComponentClasses: ["machine-pin"],
            constraint: { type: "outside" },
            severity: "warning",
          },
          {
            id: "hard-pad-limit",
            targets: ["pad"],
            // Note: Does NOT exempt machine-pin peer class!
            constraint: { type: "outside" },
            severity: "error",
          },
        ],
      } as any,
      // Unrelated capacitor on same GND net
      {
        type: "source_component",
        source_component_id: "src_c2",
        name: "C2",
        component_classes: [],
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_c2",
        source_component_id: "src_c2",
        center: { x: 1, y: 0 },
        layer: "top",
      },
      {
        type: "source_port",
        source_port_id: "sp_c2_1",
        source_component_id: "src_c2",
        source_net_id: "net_gnd",
      } as any,
      {
        type: "pcb_port",
        pcb_port_id: "port_c2_1",
        source_port_id: "sp_c2_1",
        pcb_component_id: "pcb_c2",
        x: 1,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_c2_1",
        pcb_component_id: "pcb_c2",
        pcb_port_id: "port_c2_1",
        shape: "rect",
        x: 1,
        y: 0,
        width: 0.5,
        height: 0.5,
        layer: "top",
      },
    ]

    const diagnostics = checkRuleAreas(circuitJson)

    // Owner pad is exempt from advisory-access (excludeOwner: true), but C2 pad is NOT exempt.
    const c2Advisory = diagnostics.find(
      (d) => d.severity === "warning" && (d as any).offender_id === "pad_c2_1",
    )
    expect(c2Advisory).toBeDefined()

    // Owner pad is not exempt from hard-pad-limit (no excludeOwner on rule 2)
    const ownerHard = diagnostics.find(
      (d) => d.severity === "error" && (d as any).offender_id === "pad_owner_1",
    )
    expect(ownerHard).toBeDefined()
  })

  // Fixture 6: Rotated/flipped owner, both sides, partial overlap with component origin outside, exact boundary, nonzero margin.
  test("Fixture 6: Rotated/flipped owner, both sides, partial overlap with component origin outside, exact boundary, nonzero margin", () => {
    // Owner is rotated 90 deg CCW, on bottom layer, at (10, 20)
    // Local rule area is 4mm wide x 2mm high centered on component.
    // When rotated 90 deg, width is 2mm along X and 4mm along Y (world bounds: x in [9, 11], y in [18, 22]).
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_component",
        pcb_component_id: "comp_owner",
        center: { x: 10, y: 20 },
        rotation: 90,
        layer: "bottom",
      },
      {
        type: "pcb_rule_area",
        pcb_rule_area_id: "ra_rot",
        pcb_component_id: "comp_owner",
        shape: "rect",
        width: 4,
        height: 2,
        layers: ["bottom"],
        rules: [
          {
            id: "test-rule",
            targets: ["component"],
            excludeOwner: true,
            constraint: { type: "outside", clearance: "0.2mm" },
            severity: "error",
          },
        ],
      } as any,
      // Target component has center OUTSIDE rule area (e.g. x = 12.5, y = 20)
      // but its courtyard is 3mm wide (x from 11.0 to 14.0), touching the rule area boundary x = 11.0
      {
        type: "pcb_component",
        pcb_component_id: "comp_target_touch",
        center: { x: 12.5, y: 20 },
        layer: "bottom",
      },
      {
        type: "pcb_courtyard_rect",
        pcb_courtyard_rect_id: "cy_target_touch",
        pcb_component_id: "comp_target_touch",
        center: { x: 12.5, y: 20 },
        width: 3,
        height: 2,
        layer: "bottom",
      },
    ]

    // Gap between x = 11.0 and x = 11.0 is 0. Required clearance is 0.2mm -> Violation!
    const diagnostics = checkRuleAreas(circuitJson)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.severity).toBe("error")
    expect((diagnostics[0] as any).offender_id).toBe("comp_target_touch")

    // If moved so gap is 0.3mm (center at x = 12.8, so edge is at 11.3, gap to 11.0 is 0.3mm > 0.2mm clearance):
    const moved = circuitJson.map((el) => {
      if (
        el.type === "pcb_component" &&
        el.pcb_component_id === "comp_target_touch"
      ) {
        return { ...el, center: { x: 12.8, y: 20 } }
      }
      if (
        el.type === "pcb_courtyard_rect" &&
        el.pcb_courtyard_rect_id === "cy_target_touch"
      ) {
        return { ...el, center: { x: 12.8, y: 20 } }
      }
      return el
    })
    const movedDiagnostics = checkRuleAreas(moved)
    expect(movedDiagnostics).toHaveLength(0)
  })

  // Fixture 7: Missing component geometry diagnosed.
  test("Fixture 7: Missing component geometry is diagnosed explicitly", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "src_mystery",
        name: "U_MYSTERY",
      } as any,
      {
        type: "pcb_component",
        pcb_component_id: "comp_mystery",
        source_component_id: "src_mystery",
        center: { x: 0, y: 0 },
        layer: "top",
        // No courtyard, no pads, no width/height!
      },
      {
        type: "pcb_rule_area",
        pcb_rule_area_id: "ra_strict",
        shape: "circle",
        center: { x: 0, y: 0 },
        radius: 5,
        layers: ["top"],
        is_world_coordinates: true,
        rules: [
          {
            id: "component-check",
            targets: ["component"],
            constraint: { type: "outside" },
            severity: "error",
          },
        ],
      } as any,
    ]

    const diagnostics = checkRuleAreas(circuitJson)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]?.type).toBe("pcb_placement_error")
    expect((diagnostics[0] as any).pcb_component_id).toBe("comp_mystery")
    expect(diagnostics[0]?.message).toContain(
      "has no courtyard, pad, or body geometry",
    )
  })
})
