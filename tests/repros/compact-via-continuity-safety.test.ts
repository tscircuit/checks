import { expect, test } from "bun:test"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import {
  createRouteViaContactContext,
  routeViaConnectsAdjacentWires,
} from "lib/check-traces-are-contiguous/route-via-connects-adjacent-wires"
import { renderCompactViaContinuity } from "../fixtures/compact-via-continuity"

test("compact acceptance preserves invalid transition and disconnected-pad diagnostics", async (): Promise<void> => {
  const compact = await renderCompactViaContinuity()
  const control = await renderCompactViaContinuity({ explicitContacts: true })
  const compactTrace = compact.find((element) => element.type === "pcb_trace")!
  const via = compactTrace.route[1]!
  const incoming = compactTrace.route[0]!
  const outgoing = compactTrace.route[2]!
  if (
    via.route_type !== "via" ||
    incoming.route_type !== "wire" ||
    outgoing.route_type !== "wire"
  )
    throw new Error("Expected unmodified compact fixture points")
  const args = {
    via,
    incoming,
    outgoing,
    traceId: compactTrace.pcb_trace_id,
    context: createRouteViaContactContext(compact),
  }
  expect(routeViaConnectsAdjacentWires(args)).toBeTrue()
  // These are layer-contact classifier controls, not replacement board geometry.
  expect(
    routeViaConnectsAdjacentWires({
      ...args,
      incoming: { ...incoming, x: via.x, y: via.y, layer: "inner1" },
    }),
  ).toBeTrue()
  expect(
    routeViaConnectsAdjacentWires({
      ...args,
      incoming: { ...incoming, layer: "inner1" },
    }),
  ).toBeFalse()
  expect(
    routeViaConnectsAdjacentWires({
      ...args,
      outgoing: { ...outgoing, layer: "inner1" },
    }),
  ).toBeFalse()
  const reversed = {
    ...args,
    via: { ...via, from_layer: "bottom" as const, to_layer: "top" as const },
    incoming: outgoing,
    outgoing: incoming,
  }
  expect(routeViaConnectsAdjacentWires(reversed)).toBeTrue()

  const twoLayerBoard = structuredClone(compact)
  twoLayerBoard.find((element) => element.type === "pcb_board")!.num_layers = 2
  expect(
    routeViaConnectsAdjacentWires({
      ...args,
      context: createRouteViaContactContext(twoLayerBoard),
      incoming: { ...incoming, x: via.x, y: via.y, layer: "inner1" },
    }),
  ).toBeFalse()

  const invalidLayer = structuredClone(compact)
  const invalidLayerTrace = invalidLayer.find(
    (element) => element.type === "pcb_trace",
  )!
  const invalidLayerVia = invalidLayerTrace.route[1]!
  if (invalidLayerVia.route_type !== "via")
    throw new Error("Expected route via")
  invalidLayerVia.from_layer = "inner1"
  const invalidErrors = checkTracesAreContiguous(invalidLayer)
  expect(invalidErrors).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: "misaligned_via_pcb_trace_0_1",
    }),
  )
  expect(invalidErrors[0]!.message).toContain("R1.1 to R2.2")

  const blindSpan = structuredClone(control)
  const barrel = blindSpan.find((element) => element.type === "pcb_via")!
  barrel.layers = ["top", "inner1"]
  barrel.to_layer = "inner1"
  // The stale top-to-bottom route declaration cannot expand an actual blind barrel.
  expect(checkTracesAreContiguous(blindSpan)).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: "misaligned_via_pcb_trace_0_2",
    }),
  )

  const authoredBlind = await renderCompactViaContinuity({
    viaToLayer: "inner1",
  })
  expect(
    authoredBlind.find((element) => element.type === "pcb_via")!.layers,
  ).toEqual(["top", "inner1"])
  const authoredBlindEndPad = authoredBlind.find(
    (element) =>
      element.type === "pcb_smtpad" &&
      element.layer === "bottom" &&
      element.x === outgoing.x &&
      element.y === outgoing.y,
  )!
  if (authoredBlindEndPad.type !== "pcb_smtpad")
    throw new Error("Expected actual R2.2 footprint pad")
  expect(checkTracesAreContiguous(authoredBlind)).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: `missing_layer_connection_${compactTrace.pcb_trace_id}_2_${authoredBlindEndPad.pcb_port_id}`,
    }),
  )

  const displacedPad = structuredClone(control)
  const endPad = displacedPad.find(
    (element) =>
      element.type === "pcb_smtpad" &&
      element.layer === "bottom" &&
      element.x === outgoing.x &&
      element.y === outgoing.y,
  )!
  if (endPad.type !== "pcb_smtpad" || endPad.shape !== "rect")
    throw new Error("Expected rectangular end pad")
  endPad.x += 2
  const endPort = displacedPad.find(
    (element) =>
      element.type === "pcb_port" && element.pcb_port_id === endPad.pcb_port_id,
  )!
  if (endPort.type !== "pcb_port") throw new Error("Expected end port")
  endPort.x += 2
  expect(checkTracesAreContiguous(displacedPad)).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: `missing_connection_${compactTrace.pcb_trace_id}_${endPort.pcb_port_id}`,
    }),
  )

  const unnamed = invalidLayer.filter(
    (element) =>
      !["source_component", "source_port", "source_trace", "pcb_port"].includes(
        element.type,
      ),
  )
  const unnamedError = checkTracesAreContiguous(unnamed).find(
    (error) => error.pcb_trace_error_id === "misaligned_via_pcb_trace_0_1",
  )!
  expect(unnamedError.message).toContain("unnamed trace")
  expect(unnamedError.message).not.toMatch(/(?:pcb_|source_)/)
})
