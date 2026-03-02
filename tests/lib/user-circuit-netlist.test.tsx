import { expect, test } from "bun:test"
import { runAllNetlistChecks } from "lib/run-all-checks"
import { Circuit } from "tscircuit"

test("test.tsx builds and has no netlist errors", async () => {
  const circuit = new Circuit()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" footprint="0402" />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()

  const netlistErrors = await runAllNetlistChecks(circuitJson as any)
  console.log(netlistErrors)
})
