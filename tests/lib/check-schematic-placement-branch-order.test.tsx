import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { Circuit } from "tscircuit"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

// Published placement extract: ShiboSoftwareDev/usb-pd-quad-dc-motor-controller.
// The original DRV8847 symbol, pin order and two 300-milliohm shunts are retained.
const labels = {
  pin1: ["nSLEEP"],
  pin2: ["OUT1"],
  pin3: ["ISEN12"],
  pin4: ["OUT2"],
  pin5: ["OUT4"],
  pin6: ["ISEN34"],
  pin7: ["OUT3"],
  pin8: ["nFAULT"],
  pin9: ["IN3"],
  pin10: ["IN4"],
  pin11: ["TRQ"],
  pin12: ["VM"],
  pin13: ["GND"],
  pin14: ["MODE"],
  pin15: ["IN2"],
  pin16: ["IN1"],
  pin17: ["EP", "thermalpad"],
} as const
function BranchOrder({
  corrected = false,
}: {
  corrected?: boolean
}) {
  return (
    <board routingDisabled>
      <net name="GND" isGroundNet />
      <chip
        footprint="dfn16_thermalpad2.1mmx2.03mm_pillpads_p0.65mm_w7.5mm_pw0.34mm_pl1.75mm"
        name="U_DRV12"
        manufacturerPartNumber="DRV8847PWPR"
        schX={-5.2875}
        schY={-1.645}
        schWidth={1.3}
        schHeight={2}
        schPinSpacing={0.2}
        pinLabels={labels}
        pinAttributes={{ pin13: { requiresGround: true } }}
        schPinArrangement={{
          leftSide: {
            pins: [1, 2, 3, 4, 5, 6, 7, 8, 9],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [17, 16, 15, 14, 13, 12, 11, 10],
            direction: "top-to-bottom",
          },
        }}
        connections={{
          pin3: ".RS_M1 > .pin1",
          pin6: ".RS_M2 > .pin1",
          pin11: "net.GND",
          pin13: "net.GND",
          pin14: "net.GND",
          pin17: "net.GND",
        }}
      />
      <resistor
        footprint="1206"
        name="RS_M1"
        resistance="0.3"
        schX={corrected ? -9 : -7.3275}
        schY={corrected ? -1.7 : -3.445}
        schRotation={270}
        connections={{ pin2: "net.GND" }}
      />
      <resistor
        footprint="1206"
        name="RS_M2"
        resistance="0.3"
        schX={-7.3275}
        schY={-2.145}
        schRotation={270}
        connections={{ pin2: "net.GND" }}
      />
    </board>
  )
}
async function createBranchOrder(corrected = false) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(<BranchOrder corrected={corrected} />)
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

test("reports crossed component branches on their host and clears the corrected layout", async () => {
  const json = await createBranchOrder()
  const original = structuredClone(json)
  const warnings = checkSchematicPlacement(json).filter(
    (w) => w.styling_issue_type === "component_branches_out_of_order",
  )
  expect(warnings).toHaveLength(1)
  const w = warnings[0]!
  expect(schematic_component_styling_warning.parse(w)).toEqual(w)
  expect(w.message).toContain("Reorder RS_M1 and RS_M2")
  expect(w.message).toContain("U_DRV12")
  expect(w.message).toContain("without moving the host pins")
  const host = json.find(
    (e) => e.type === "source_component" && e.name === "U_DRV12",
  )!
  if (host.type !== "source_component") throw new Error("Missing host")
  expect(w.source_component_id).toBe(host.source_component_id)
  for (const run of [runAllChecks, runAllSchematicChecks]) {
    expect(
      (await run(structuredClone(json))).filter(
        (e) =>
          e.type === "schematic_component_styling_warning" &&
          e.styling_issue_type === w.styling_issue_type,
      ),
    ).toEqual(warnings)
  }
  expect(checkSchematicPlacement([...json, ...warnings])).toEqual(
    checkSchematicPlacement(json),
  )
  expect(json).toEqual(original)
  expect(
    checkSchematicPlacement(await createBranchOrder(true)).filter(
      (e) => e.styling_issue_type === w.styling_issue_type,
    ),
  ).toEqual([])
  for (const e of json) if (e.type === "source_component") e.name = ""
  const unnamed = checkSchematicPlacement(json).filter(
    (e) => e.styling_issue_type === w.styling_issue_type,
  )
  expect(unnamed).toHaveLength(1)
  expect(unnamed[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(unnamed[0]!.message)).toBe(false)
})
