import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "../../lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

test("a pill hole aborts routing checks instead of returning a different-net crossing", async () => {
  // Run this repository's checker explicitly after core produces the fixture.
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width={10} height={6}>
      <net name="A" />
      <net name="B" />
      <testpoint
        name="A1"
        pcbX={-4}
        pcbY={-2}
        layer="bottom"
        padDiameter={0.5}
      />
      <testpoint name="A2" pcbX={4} pcbY={2} layer="bottom" padDiameter={0.5} />
      <testpoint
        name="B1"
        pcbX={-4}
        pcbY={2}
        layer="bottom"
        padDiameter={0.5}
      />
      <testpoint
        name="B2"
        pcbX={4}
        pcbY={-2}
        layer="bottom"
        padDiameter={0.5}
      />
      <trace
        path={[".A1 > .pin1", ".A2 > .pin1", "net.A"]}
        thickness={0.2}
        pcbPathRelativeTo=".A1 > .pin1"
        pcbPath={["bottom", { x: 0, y: 0 }, { x: 8, y: 4 }]}
      />
      <trace
        path={[".B1 > .pin1", ".B2 > .pin1", "net.B"]}
        thickness={0.2}
        pcbPathRelativeTo=".B1 > .pin1"
        pcbPath={["bottom", { x: 0, y: 0 }, { x: 8, y: -4 }]}
      />
      <hole name="slot" shape="pill" width={1} height={0.5} pcbX={2} pcbY={0} />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const traces = circuitJson.filter((element) => element.type === "pcb_trace")
  expect(traces).toHaveLength(2)
  const connectivity = getFullConnectivityMapFromCircuitJson(circuitJson)
  expect(
    connectivity.areIdsConnected(
      traces[0]!.pcb_trace_id,
      traces[1]!.pcb_trace_id,
    ),
  ).toBe(false)

  expect(() =>
    checkEachPcbTraceNonOverlapping(structuredClone(circuitJson)),
  ).toThrow("Could not determine radius of element:")
  await expect(
    runAllRoutingChecks(structuredClone(circuitJson)),
  ).rejects.toThrow("Could not determine radius of element:")

  // Diagnostic control only: remove the hole, keeping every copper element.
  const withoutSlot = circuitJson.filter(
    (element) => element.type !== "pcb_hole",
  )
  const errors = checkEachPcbTraceNonOverlapping(structuredClone(withoutSlot))
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_trace_error",
    center: { x: 0, y: 0 },
  })
  expect(errors[0].message).toContain("(accidental contact)")
  expect(await runAllRoutingChecks(withoutSlot)).toEqual(errors)
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
