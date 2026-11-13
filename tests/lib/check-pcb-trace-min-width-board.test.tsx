import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbTraceMinWidth } from "lib/check-pcb-trace-min-width"
import { runAllChecks } from "lib/run-all-checks"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

test("hand-routed traces thinner than the board's minTraceWidth are reported (#5559)", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="20mm" height="10mm" minTraceWidth={0.15} routingDisabled>
      <resistor name="R1" resistance="1k" footprint="0603" pcbX={-3} pcbY={0} />
      <resistor name="R2" resistance="1k" footprint="0603" pcbX={3} pcbY={0} />
      <resistor
        name="R3"
        resistance="1k"
        footprint="0603"
        pcbX={-3}
        pcbY={-3}
      />
      <resistor name="R4" resistance="1k" footprint="0603" pcbX={3} pcbY={-3} />
      <trace
        from=".R1 > .pin2"
        to=".R2 > .pin1"
        thickness={0.05}
        pcbPath={[
          { x: 0, y: 2 },
          { x: 4.4, y: 2 },
        ]}
      />
      <trace
        from=".R3 > .pin2"
        to=".R4 > .pin1"
        thickness={0.15}
        pcbPath={[
          { x: 0, y: 1.2 },
          { x: 4.4, y: 1.2 },
        ]}
      />
      <pcbnotetext
        pcbX={0}
        pcbY={4.2}
        fontSize={0.45}
        text="0.05mm trace: FAIL (board min 0.15mm)"
      />
      <pcbnotetext
        pcbX={0}
        pcbY={-4.4}
        fontSize={0.45}
        text="0.15mm trace: OK"
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson() as AnyCircuitElement[]

  const errors = checkPcbTraceMinWidth(circuitJson)
  expect(errors.map((error) => error.message)).toEqual([
    "Trace .R1 > .pin2 to .R2 > .pin1 is 0.05mm wide, below the minimum trace width of 0.15mm",
  ])
  expect(containsCircuitJsonId(errors[0].message)).toBe(false)
  expect(await runAllChecks(circuitJson)).toContainEqual(errors[0])

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors] as any, {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
