import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentOverCutout } from "lib/check-pcb-component-over-cutout"

test("repro: an unpopulated component body still reports a cutout overlap", async () => {
  for (const doNotPlace of [false, true]) {
    const circuit = new Circuit()
    circuit.add(
      <board width={10} height={6} schematicDisabled>
        <chip
          name="ENCODER_OPTION"
          doNotPlace={doNotPlace}
          cadModel={null}
          pinLabels={{ pin1: ["1"], pin2: ["2"] }}
          noConnect={["pin1", "pin2"]}
          footprint={
            <footprint>
              <smtpad
                portHints={["pin1"]}
                shape="rect"
                pcbX={-2.5}
                pcbY={0}
                width={1}
                height={1}
              />
              <smtpad
                portHints={["pin2"]}
                shape="rect"
                pcbX={2.5}
                pcbY={0}
                width={1}
                height={1}
              />
            </footprint>
          }
        />
        <cutout shape="rect" width={1} height={1} pcbX={0} pcbY={0} />
      </board>,
    )
    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()
    const component = circuitJson.find(
      (element) => element.type === "pcb_component",
    )
    expect(component?.do_not_place).toBe(doNotPlace)

    const errors = checkPcbComponentOverCutout(circuitJson)
    // The populated-body collision is valid. Current bug: the same body-only
    // error remains for the DNP case, although both pads are outside the slot.
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("Component ENCODER_OPTION overlaps")

    if (doNotPlace) {
      expect(
        convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
          shouldDrawErrors: true,
          showCourtyards: true,
        }),
      ).toMatchSvgSnapshot(import.meta.path)
    }
  }
})
