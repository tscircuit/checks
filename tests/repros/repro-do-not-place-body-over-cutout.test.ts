import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement, PcbComponent, PcbCutout } from "circuit-json"
import { checkPcbComponentOverCutout } from "lib/check-pcb-component-over-cutout"

test("repro: an unpopulated component body still reports a cutout overlap", () => {
  const component: PcbComponent = {
    type: "pcb_component",
    pcb_component_id: "encoder_option",
    source_component_id: "source_encoder_option",
    center: { x: 0, y: 0 },
    width: 6,
    height: 2,
    rotation: 0,
    layer: "top",
    obstructs_within_bounds: true,
    do_not_place: true,
  }
  const cutout: PcbCutout = {
    type: "pcb_cutout",
    pcb_cutout_id: "slot",
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
  }
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 10,
      height: 6,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_component",
      source_component_id: "source_encoder_option",
      name: "ENCODER_OPTION",
      ftype: "simple_chip",
    },
    component,
    ...[-2.5, 2.5].map(
      (x): AnyCircuitElement => ({
        type: "pcb_smtpad",
        pcb_smtpad_id: `pad_${x}`,
        pcb_component_id: component.pcb_component_id,
        shape: "rect",
        x,
        y: 0,
        width: 1,
        height: 1,
        layer: "top",
      }),
    ),
    cutout,
  ]

  // A populated body over the slot is a genuine placement violation.
  expect(
    checkPcbComponentOverCutout([
      { ...component, do_not_place: false },
      cutout,
    ]),
  ).toHaveLength(1)

  const errors = checkPcbComponentOverCutout(circuitJson)
  // Current bug: do_not_place does not remove the body-only violation.
  // The pads are outside the slot and must remain checked after the fix.
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("Component ENCODER_OPTION overlaps")

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
