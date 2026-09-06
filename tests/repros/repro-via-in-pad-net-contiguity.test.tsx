import { expect, test } from "bun:test"
import { any_circuit_element, type AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { getViaInPadSensorRegion } from "../fixtures/via-in-pad-sensor-region"

test("reproduces false disconnected endpoints on a sensor board with intentional via-in-pad", async () => {
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

  // These are known false positives: each endpoint touches a same-net 0.4 mm
  // through-via centered inside a real top pad. A corrected checker should
  // report zero, without changing this fixture's geometry or connectivity.
  expect(
    errors.map(({ pcb_trace_error_id, center }) => ({
      pcb_trace_error_id,
      center,
    })),
  ).toMatchInlineSnapshot(`
    [
      {
        "center": {
          "x": -1.15,
          "y": 1.905,
        },
        "pcb_trace_error_id": "disconnected_endpoint_pcb_trace_vdd_u1_c1_start",
      },
      {
        "center": {
          "x": -3.175,
          "y": -2,
        },
        "pcb_trace_error_id": "disconnected_endpoint_pcb_trace_vdd_c1_c2_end",
      },
      {
        "center": {
          "x": -1.15,
          "y": -1.905,
        },
        "pcb_trace_error_id": "disconnected_endpoint_pcb_trace_gnd_u1_c1_start",
      },
      {
        "center": {
          "x": -4.825,
          "y": -2,
        },
        "pcb_trace_error_id": "disconnected_endpoint_pcb_trace_gnd_c1_c2_end",
      },
      {
        "center": {
          "x": 3.15,
          "y": -1.905,
        },
        "pcb_trace_error_id": "disconnected_endpoint_pcb_trace_sda_start",
      },
      {
        "center": {
          "x": 7,
          "y": -0.5,
        },
        "pcb_trace_error_id": "disconnected_endpoint_pcb_trace_sda_end",
      },
      {
        "center": {
          "x": 3.15,
          "y": -0.635,
        },
        "pcb_trace_error_id": "disconnected_endpoint_pcb_trace_scl_start",
      },
      {
        "center": {
          "x": 7,
          "y": -1.5,
        },
        "pcb_trace_error_id": "disconnected_endpoint_pcb_trace_scl_end",
      },
    ]
  `)

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
