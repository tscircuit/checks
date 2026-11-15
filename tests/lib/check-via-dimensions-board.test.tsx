import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPlatedHoleAnnularRing } from "lib/check-plated-hole-annular-ring"
import { checkViaDimensions } from "lib/check-via-dimensions"
import { runAllChecks } from "lib/run-all-checks"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

test("via drill, pad and annular ring are checked against the board's via minimums (#5559)", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board
      width="20mm"
      height="10mm"
      minViaHoleDiameter={0.3}
      minViaPadDiameter={0.6}
      routingDisabled
    >
      <resistor name="R1" resistance="1k" footprint="0603" pcbX={0} pcbY={0} />
      <chip name="Q1" footprint="to92" pcbX={6} pcbY={-1} />
      {/* 0.025mm ring, from the issue */}
      <via
        pcbX={0}
        pcbY={-2.5}
        holeDiameter="0.3mm"
        outerDiameter="0.35mm"
        fromLayer="top"
        toLayer="bottom"
        connectsTo=".R1 > .pin1"
      />
      {/* Meets the board's minimums */}
      <via
        pcbX={-4}
        pcbY={-2.5}
        holeDiameter="0.3mm"
        outerDiameter="0.6mm"
        fromLayer="top"
        toLayer="bottom"
      />
      <pcbnotetext
        pcbX={0}
        pcbY={-3.6}
        fontSize={0.45}
        text="FAIL 0.3/0.35mm"
      />
      <pcbnotetext pcbX={-4} pcbY={-3.6} fontSize={0.45} text="OK 0.3/0.6mm" />
      <pcbnotetext
        pcbX={-4}
        pcbY={3.5}
        fontSize={0.5}
        text="board min via: 0.3mm drill / 0.6mm pad"
      />
      <pcbnotetext
        pcbX={6}
        pcbY={-3.6}
        fontSize={0.45}
        text="TO-92 ring 0.115mm"
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson() as AnyCircuitElement[]

  const viaErrors = checkViaDimensions(circuitJson)
  expect(viaErrors.map((error) => error.message)).toEqual([
    "Unnamed via at (0.00mm, -2.50mm): pad 0.35mm is below the minimum via pad of 0.6mm; annular ring 0.025mm is below the minimum of 0.05mm",
  ])

  // footprinter's TO-92 uses a 0.72mm drill in a 0.95mm pad
  const ringErrors = checkPlatedHoleAnnularRing(circuitJson)
  expect(ringErrors.map((error) => error.message)).toContain(
    "Through-hole pad Q1.pin2 at (6.00mm, 1.25mm) annular ring is too small (annular ring: 0.115mm, minimum: 0.13mm)",
  )

  for (const error of [...viaErrors, ...ringErrors]) {
    expect(containsCircuitJsonId(error.message)).toBe(false)
  }

  const allErrors = await runAllChecks(circuitJson)
  expect(allErrors).toContainEqual(viaErrors[0])
  expect(allErrors).toContainEqual(ringErrors[0])

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...viaErrors] as any, {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
