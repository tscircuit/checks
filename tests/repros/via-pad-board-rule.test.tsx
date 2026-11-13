import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"

test("via-to-pad clearance uses the board's via rule", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board
      width={10}
      height={7}
      routingDisabled
      minPadEdgeToPadEdgeClearance={0.1}
      minViaEdgeToPadEdgeClearance={0.2}
    >
      <chip
        name="U1"
        pinLabels={{ pin1: "GND" }}
        connections={{ pin1: "net.GND" }}
        footprint={
          <footprint>
            <smtpad portHints={["pin1"]} shape="rect" width={1} height={1} />
          </footprint>
        }
      />
      <via
        name="V1"
        pcbX={0.95}
        outerDiameter={0.6}
        holeDiameter={0.3}
        fromLayer="top"
        toLayer="bottom"
        connectsTo="net.VCC"
      />
      <pcbnotetext text="GND pad beside a VCC via" pcbY={2.5} fontSize={0.4} />
      <pcbnotetext
        text="Copper gap: 0.15 mm; via-to-pad rule: 0.20 mm"
        pcbY={-1.5}
        fontSize={0.3}
      />
      <pcbnotetext
        text="Pad-to-pad rule: 0.10 mm (must not apply here)"
        pcbY={-2.1}
        fontSize={0.3}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const board = circuit.db.pcb_board.list()[0]
  expect(board.min_via_edge_to_pad_edge_clearance).toBe(0.2)
  expect(board.min_pad_edge_to_pad_edge_clearance).toBe(0.1)
  const pad = circuit.db.pcb_smtpad.list()[0]
  const via = circuit.db.pcb_via.list()[0]
  if (pad.shape !== "rect") throw new Error("Expected a rectangular pad")
  expect(via.x - via.outer_diameter / 2 - pad.x - pad.width / 2).toBeCloseTo(
    0.15,
    6,
  )
  const errors = checkViaPadClearance(circuitJson)
  expect(errors).toHaveLength(0)
  circuitJson.push({
    type: "pcb_note_text",
    pcb_note_text_id: "check_result",
    text: `Via-to-pad check: ${errors.length} findings`,
    anchor_position: { x: 0, y: -2.8 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.4,
    layer: "top",
  })
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
