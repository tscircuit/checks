import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"
import { distance } from "lib/util/distance"
import { Circuit } from "tscircuit"

test("repro: different-net via copper overlap passes the drill-spacing check", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board width={1.6} height={1.2} layers={4} routingDisabled>
      <via
        name="V1"
        pcbX={-0.19906367815}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="top"
        toLayer="bottom"
        connectsTo="net.LCD_B3"
      />
      <via
        name="V2"
        pcbX={0.19906367815}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="top"
        toLayer="bottom"
        connectsTo="net.LCD_B2"
      />
      <pcbnotetext text="LCD_B3" pcbX={-0.4} pcbY={0.35} fontSize={0.08} />
      <pcbnotetext text="LCD_B2" pcbX={0.4} pcbY={0.35} fontSize={0.08} />
      <pcbnotetext
        text="Copper overlap: 0.001873 mm"
        pcbX={0}
        pcbY={-0.38}
        fontSize={0.065}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const vias = circuitJson.filter((element) => element.type === "pcb_via")
  expect(vias).toHaveLength(2)
  const [viaA, viaB] = vias
  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)
  expect(connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)).toBe(false)
  expect(viaA.layers).toEqual(["top", "inner1", "inner2", "bottom"])
  expect(viaB.layers).toEqual(viaA.layers)
  const centerDistance = distance(viaA, viaB)
  const holeGap =
    centerDistance - viaA.hole_diameter / 2 - viaB.hole_diameter / 2
  const copperGap =
    centerDistance - viaA.outer_diameter / 2 - viaB.outer_diameter / 2
  expect(holeGap).toBeCloseTo(0.1981273563, 10)
  expect(copperGap).toBeCloseTo(-0.0018726437, 10)

  const errors = checkDifferentNetViaSpacing(circuitJson)
  expect(errors).toHaveLength(0)
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      width: 1000,
      height: 750,
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
