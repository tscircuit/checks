import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { runAllPlacementChecks, runAllRoutingChecks } from "../../index"
import {
  board,
  bend,
  via,
  pad,
  stiffener,
  trace,
} from "../fixtures/pcb-bend-zones"
import {
  getReadableNameForElementId,
  getReadableNameForSourceTrace,
  getReadableNameForTrace,
} from "lib/util/get-readable-names"

test("check messages use names or unnamed labels while keeping diagnostic IDs", async () => {
  for (const named of [true, false]) {
    const circuit: AnyCircuitElement[] = [
      { ...board, pcb_board_id: "pcb_board_private_91" },
      {
        ...bend,
        pcb_bend_id: "pcb_bend_private_92",
        pcb_board_id: "pcb_board_private_91",
        name: named ? "FOLD" : undefined,
      },
      via("pcb_via_private_93", 0, 4),
      pad("pcb_smtpad_private_94", 0, -4),
      {
        ...stiffener,
        pcb_stiffener_id: "pcb_stiffener_private_95",
        pcb_board_id: "pcb_board_private_91",
        name: named ? "CONTACT_BACKING" : undefined,
      },
      trace("pcb_trace_private_96", [
        [-5, 0],
        [0, 0],
        [0, 3],
      ]),
    ]
    const diagnostics = [
      ...(await runAllPlacementChecks(circuit)),
      ...(await runAllRoutingChecks(circuit)),
    ]
    const bendDiagnostics = diagnostics.filter((error) =>
      error.message.includes("PCB bend zone"),
    )
    expect(bendDiagnostics).toHaveLength(4)
    for (const error of diagnostics) {
      expect(error.message).not.toMatch(
        /\b(?:pcb|source|schematic|subcircuit)_[a-z0-9_]+\b/i,
      )
    }
    expect(
      bendDiagnostics.some((error) =>
        error.message.includes(named ? "CONTACT_BACKING" : "unnamed stiffener"),
      ),
    ).toBe(true)
    expect(
      bendDiagnostics.every((error) =>
        error.message.includes(named ? "FOLD" : "unnamed bend"),
      ),
    ).toBe(true)
    expect(
      bendDiagnostics.some(
        (error) =>
          "pcb_trace_id" in error &&
          error.pcb_trace_id === "pcb_trace_private_96",
      ),
    ).toBe(true)
    expect(getReadableNameForElementId(circuit, "pcb_via_private_93")).toBe(
      "unnamed via",
    )
  }
  const customPad = pad("private-pad-token", 0, 0)
  expect(
    getReadableNameForElementId([customPad], customPad.pcb_smtpad_id),
  ).toBe("unnamed SMD pad")
  const danglingTrace = trace("private-trace-token", [
    [0, 0],
    [1, 0],
  ])
  if (danglingTrace.route[0].route_type === "wire")
    danglingTrace.route[0].start_pcb_port_id = "private-missing-port-token"
  expect(
    getReadableNameForTrace([danglingTrace], danglingTrace.pcb_trace_id),
  ).toBe("unnamed trace")
  const sourceTrace = {
    type: "source_trace",
    source_trace_id: "source_trace_private_97",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
  } as const
  expect(
    getReadableNameForSourceTrace([], {
      ...sourceTrace,
      connected_source_port_ids: [],
      connected_source_net_ids: [],
    }),
  ).toBe("unnamed trace")
})
