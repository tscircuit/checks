import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

const Fs3000OptionalHeaders = () => (
  <board width={25.4} height={25.4} routingDisabled>
    <jumper
      name="JP4"
      doNotPlace
      noConnect
      pinLabels={{
        pin1: ["VCM"],
        pin2: ["ADCR"],
      }}
      cadModel={null}
      footprint="pinrow2_doublesidedpinlabel_pinlabeltextalignright_pinlabelorthogonal_pinlabelverticallyinverted_nosquareplating_id1.016_od1.88_p2.54"
      pcbX={5.08}
      pcbY={-11.43}
    />
    <jumper
      name="JP5"
      doNotPlace
      noConnect
      pinLabels={{
        pin1: ["GND"],
        pin2: ["V3_3"],
        pin3: ["SDA"],
        pin4: ["SCL"],
      }}
      cadModel={null}
      footprint="pinrow4_doublesidedpinlabel_pinlabeltextalignright_pinlabelorthogonal_pinlabelverticallyinverted_nosquareplating_id1.016_od1.88_p2.54"
      pcbX={-2.54}
      pcbY={-11.43}
    />
  </board>
)

test("FS3000 optional headers may cross each other's courtyards", async () => {
  const circuit = new Circuit({
    platform: {
      netlistDrcChecksDisabled: true,
      placementDrcChecksDisabled: true,
    },
  })
  circuit.add(<Fs3000OptionalHeaders />)

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const doNotPlaceComponents = circuitJson.filter(
    (element) => element.type === "pcb_component" && element.do_not_place,
  )
  const platedHoles = circuitJson.filter(
    (element) => element.type === "pcb_plated_hole",
  )
  const courtyards = circuitJson.filter((element) =>
    element.type.startsWith("pcb_courtyard_"),
  )

  expect(doNotPlaceComponents).toHaveLength(2)
  expect(platedHoles).toHaveLength(6)
  expect(courtyards).toHaveLength(2)
  expect(checkPcbComponentOverlap(circuitJson)).toHaveLength(0)
  expect(circuitJson).toMatchSnapshot()
  expect(
    convertCircuitJsonToPcbSvg(circuitJson, { showCourtyards: true }),
  ).toMatchSvgSnapshot(import.meta.path)
})
