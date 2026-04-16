import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllRoutingChecks } from "lib/run-all-checks"

const ThicknessMismatchRepro = () => (
  <board width="30mm" height="20mm">
    <pinheader name="PWR" pinCount={1} pcbX={-10} pcbY={0} />

    <chip
      name="TINY_CHIP"
      footprint="qfn16_3x3_0.5mm"
      pcbX={10}
      pcbY={0}
      pinLabels={{ pin1: ["VDD"] }}
    />

    <trace from=".PWR > .pin1" to=".TINY_CHIP > .VDD" thickness="1mm" />
  </board>
)

test("repro03: trace thickness mismatch shows routing error on pcb", async () => {
  const circuit = new Circuit({
    platform: {
      routingDrcChecksDisabled: true,
      placementDrcChecksDisabled: true,
      netlistDrcChecksDisabled: true,
    },
  })
  circuit.add(<ThicknessMismatchRepro />)

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const routingIssues = await runAllRoutingChecks(circuitJson as any)

  expect(routingIssues.some((issue) => issue.type === "pcb_trace_error")).toBe(
    true,
  )
  expect(JSON.stringify(routingIssues)).toContain(
    "routed thinner than requested",
  )

  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...routingIssues], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
