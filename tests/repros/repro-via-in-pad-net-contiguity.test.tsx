import { expect, test } from "bun:test"
import { any_circuit_element, type AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { getViaInPadSensorRegion } from "../fixtures/via-in-pad-sensor-region"

test("accepts connected sensor-board endpoints with intentional via-in-pad", async () => {
  const circuitJson = await getViaInPadSensorRegion()
  for (const element of circuitJson) {
    if (element.type === "pcb_trace" || element.type === "pcb_via") {
      any_circuit_element.parse(element)
    }
  }
  const errors = checkTracesAreContiguous(circuitJson)

  expect(
    errors.every((error) =>
      error.message.includes("has disconnected endpoint"),
    ),
  ).toBe(true)

  // Every inner-layer endpoint reaches its real top pad through a separate
  // same-net via. The fixture is identical to the baseline repro; only the
  // checker and the expected diagnostics have changed.
  expect(errors).toEqual([])

  const errorCountNote: AnyCircuitElement = {
    type: "pcb_note_text",
    pcb_note_text_id: "pcb_note_text_contiguity_count",
    text: `Reported disconnected endpoints: ${errors.length} (physically expected: 0)`,
    anchor_position: { x: 0, y: -5.35 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.36,
    layer: "top",
    color: "#fbbf24",
  }
  // Abbreviate display labels only so diagnostics do not obscure the board.
  // The raw errors above retain their original identities, locations and type.
  const labeledErrors = errors.map((error, index) => ({
    ...error,
    message: `E${index + 1}`,
  }))
  expect(
    convertCircuitJsonToPcbSvg(
      [...circuitJson, ...labeledErrors, errorCountNote],
      {
        width: 1200,
        height: 860,
        shouldDrawErrors: true,
        showErrorsInTextOverlay: false,
        showPcbNotes: true,
        colorOverrides: {
          copper: { top: "#eab308", inner1: "#22d3ee", inner2: "#a78bfa" },
        },
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
