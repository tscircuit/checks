import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../../index"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("does not misclassify a 2-pin ferrite bead (L3, MH1608-601Y) as a crystal", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="GND" isGroundNet />
      <chip
        name="U1"
        schX={-5}
        schY={0}
        pinLabels={{ pin1: "VCC_IN", pin2: "VCC_OUT", pin3: "GND" }}
        schPinArrangement={{
          rightSide: { pins: ["pin1", "pin2"], direction: "top-to-bottom" },
          bottomSide: { pins: ["pin3"], direction: "left-to-right" },
        }}
      />
      <chip
        name="L3"
        supplierPartNumbers={{ jlcpcb: ["MH1608-601Y"] }}
        schX={5}
        schY={5}
        pinLabels={{ pin1: "1", pin2: "2" }}
      />
      <capacitor
        name="C1"
        capacitance="22pF"
        schOrientation="vertical"
        schX={0}
        schY={-2}
      />
      <capacitor
        name="C2"
        capacitance="22pF"
        schOrientation="vertical"
        schX={2}
        schY={-2}
      />
      <trace from=".U1 > .VCC_IN" to=".L3 > .pin1" />
      <trace from=".L3 > .pin1" to=".C1 > .pin1" />
      <trace from=".U1 > .VCC_OUT" to=".L3 > .pin2" />
      <trace from=".L3 > .pin2" to=".C2 > .pin1" />
      <trace from=".C1 > .pin2" to="net.GND" />
      <trace from=".C2 > .pin2" to="net.GND" />
      <trace from=".U1 > .GND" to="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const cj = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const warnings = checkSchematicPlacement(cj)
  const crystalWarnings = warnings.filter(
    (w) => w.styling_issue_type === "crystal_not_centered_over_load_capacitors",
  )
  expect(crystalWarnings).toHaveLength(0)
})

test("warns when an explicitly declared misplaced crystal (Y1) is not centered over its load capacitors", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="GND" isGroundNet />
      <chip
        name="U1"
        schX={-5}
        schY={0}
        pinLabels={{ pin1: "OSC_IN", pin2: "OSC_OUT", pin3: "GND" }}
        schPinArrangement={{
          rightSide: { pins: ["pin1", "pin2"], direction: "top-to-bottom" },
          bottomSide: { pins: ["pin3"], direction: "left-to-right" },
        }}
      />
      <chip name="Y1" schX={5} schY={5} pinLabels={{ pin1: "1", pin2: "2" }} />
      <capacitor
        name="C1"
        capacitance="22pF"
        schOrientation="vertical"
        schX={0}
        schY={-2}
      />
      <capacitor
        name="C2"
        capacitance="22pF"
        schOrientation="vertical"
        schX={2}
        schY={-2}
      />
      <trace from=".U1 > .OSC_IN" to=".Y1 > .pin1" />
      <trace from=".Y1 > .pin1" to=".C1 > .pin1" />
      <trace from=".U1 > .OSC_OUT" to=".Y1 > .pin2" />
      <trace from=".Y1 > .pin2" to=".C2 > .pin1" />
      <trace from=".C1 > .pin2" to="net.GND" />
      <trace from=".C2 > .pin2" to="net.GND" />
      <trace from=".U1 > .GND" to="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const cj = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const warnings = checkSchematicPlacement(cj)
  const crystalWarnings = warnings.filter(
    (w) => w.styling_issue_type === "crystal_not_centered_over_load_capacitors",
  )
  expect(crystalWarnings).toHaveLength(1)
  expect(crystalWarnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "crystal_not_centered_over_load_capacitors",
    message:
      "Y1 is not centered between load capacitors C1 and C2. Move Y1 so it is centered between them and aligned with their load-side pins.",
  })

  // Also check runAllSchematicChecks and runAllChecks
  const allSchematic = await runAllSchematicChecks(cj)
  expect(
    allSchematic.filter(
      (w) =>
        w.type === "schematic_component_styling_warning" &&
        w.styling_issue_type === "crystal_not_centered_over_load_capacitors",
    ),
  ).toHaveLength(1)
})

test("warns when a component explicitly declared with role='crystal' is misplaced", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="GND" isGroundNet />
      <chip
        name="U1"
        schX={-5}
        schY={0}
        pinLabels={{ pin1: "OSC_IN", pin2: "OSC_OUT", pin3: "GND" }}
        schPinArrangement={{
          rightSide: { pins: ["pin1", "pin2"], direction: "top-to-bottom" },
          bottomSide: { pins: ["pin3"], direction: "left-to-right" },
        }}
      />
      <chip name="L3" schX={5} schY={5} pinLabels={{ pin1: "1", pin2: "2" }} />
      <capacitor
        name="C1"
        capacitance="22pF"
        schOrientation="vertical"
        schX={0}
        schY={-2}
      />
      <capacitor
        name="C2"
        capacitance="22pF"
        schOrientation="vertical"
        schX={2}
        schY={-2}
      />
      <trace from=".U1 > .OSC_IN" to=".L3 > .pin1" />
      <trace from=".L3 > .pin1" to=".C1 > .pin1" />
      <trace from=".U1 > .OSC_OUT" to=".L3 > .pin2" />
      <trace from=".L3 > .pin2" to=".C2 > .pin1" />
      <trace from=".C1 > .pin2" to="net.GND" />
      <trace from=".C2 > .pin2" to="net.GND" />
      <trace from=".U1 > .GND" to="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const cj = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const l3Source = cj.find(
    (el) => el.type === "source_component" && el.name === "L3",
  ) as any
  l3Source.role = "crystal"

  const warnings = checkSchematicPlacement(cj)
  const crystalWarnings = warnings.filter(
    (w) => w.styling_issue_type === "crystal_not_centered_over_load_capacitors",
  )
  expect(crystalWarnings).toHaveLength(1)
})

test("warns when a component explicitly declared with ftype='simple_crystal' is misplaced", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <net name="GND" isGroundNet />
      <chip
        name="U1"
        schX={-5}
        schY={0}
        pinLabels={{ pin1: "OSC_IN", pin2: "OSC_OUT", pin3: "GND" }}
        schPinArrangement={{
          rightSide: { pins: ["pin1", "pin2"], direction: "top-to-bottom" },
          bottomSide: { pins: ["pin3"], direction: "left-to-right" },
        }}
      />
      <chip
        name="XTAL1"
        schX={5}
        schY={5}
        pinLabels={{ pin1: "1", pin2: "2" }}
      />
      <capacitor
        name="C1"
        capacitance="22pF"
        schOrientation="vertical"
        schX={0}
        schY={-2}
      />
      <capacitor
        name="C2"
        capacitance="22pF"
        schOrientation="vertical"
        schX={2}
        schY={-2}
      />
      <trace from=".U1 > .OSC_IN" to=".XTAL1 > .pin1" />
      <trace from=".XTAL1 > .pin1" to=".C1 > .pin1" />
      <trace from=".U1 > .OSC_OUT" to=".XTAL1 > .pin2" />
      <trace from=".XTAL1 > .pin2" to=".C2 > .pin1" />
      <trace from=".C1 > .pin2" to="net.GND" />
      <trace from=".C2 > .pin2" to="net.GND" />
      <trace from=".U1 > .GND" to="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const cj = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const xtalSource = cj.find(
    (el) => el.type === "source_component" && el.name === "XTAL1",
  ) as any
  xtalSource.ftype = "simple_crystal"

  const warnings = checkSchematicPlacement(cj)
  const crystalWarnings = warnings.filter(
    (w) => w.styling_issue_type === "crystal_not_centered_over_load_capacitors",
  )
  expect(crystalWarnings).toHaveLength(1)
})
