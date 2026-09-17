import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { any_circuit_element, type AnyCircuitElement } from "circuit-json"
import {
  consolidatePinSpecificationWarnings,
  type ConsolidatedPinSpecificationWarning,
} from "../../lib/consolidate-pin-specification-warnings"
import { runAllPinSpecificationChecks } from "../../lib/run-all-checks"
import { renderWarningConsolidation } from "../fixtures/render-warning-consolidation"

function fixture(specified = false) {
  const db = cju([])
  const source = db.source_component.insert({
    name: "U1",
    ftype: "simple_chip",
  })
  for (const name of ["VCC", "GND", "IO"])
    db.source_port.insert({
      source_component_id: source.source_component_id,
      name,
      ...(specified ? { must_be_connected: true } : {}),
    })
  return db.toArray()
}

test("three pin metadata reasons become one warning with all original ports", async () => {
  const circuit = fixture()
  const raw = await runAllPinSpecificationChecks(circuit, {
    consolidatePinWarnings: false,
  })
  const original = structuredClone(raw)
  const result = (await runAllPinSpecificationChecks(
    circuit,
  )) as ConsolidatedPinSpecificationWarning[]
  expect(raw).toHaveLength(3)
  expect(result).toHaveLength(1)
  expect(result[0].type).toBe("source_component_pins_underspecified_warning")
  expect(result[0].related_warnings).toEqual(raw)
  expect(result[0].source_port_ids).toHaveLength(3)
  expect(result[0].message).toContain(
    "no pinAttributes set; no requires_power pin; no requires_ground pin",
  )
  expect(any_circuit_element.safeParse(result[0]).success).toBe(true)
  expect(consolidatePinSpecificationWarnings(circuit, result)).toEqual(result)
  expect(raw).toEqual(original)
  expect(
    renderWarningConsolidation("U1: incomplete pin metadata", raw, result),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("partial metadata combines only the applicable power/ground reasons", async () => {
  const circuit = fixture(true)
  const result = (await runAllPinSpecificationChecks(
    circuit,
  )) as ConsolidatedPinSpecificationWarning[]
  expect(result).toHaveLength(1)
  expect(result[0].type).toBe("source_no_power_pin_defined_warning")
  expect(result[0].related_warnings).toHaveLength(2)
  expect(result[0].message).not.toContain("no pinAttributes set")
})

test("keeps components, subcircuits, severity and connectivity issues separate", async () => {
  const circuit = fixture()
  const raw = await runAllPinSpecificationChecks(circuit, {
    consolidatePinWarnings: false,
  })
  const another = raw.map((e) => ({ ...e, source_component_id: "other" }))
  const subcircuit = { ...raw[0], subcircuit_id: "other" }
  const fatal = { ...raw[0], is_fatal: true }
  const unrelated: AnyCircuitElement = {
    type: "pcb_placement_error",
    pcb_placement_error_id: "unrelated",
    error_type: "pcb_placement_error",
    message: "Outside board",
  }
  const result = consolidatePinSpecificationWarnings(circuit, [
    ...raw,
    ...another,
    subcircuit,
    fatal,
    unrelated,
  ])
  expect(result).toHaveLength(5)
  expect(result.slice(2)).toEqual([subcircuit, fatal, unrelated])
  expect(consolidatePinSpecificationWarnings(circuit, [raw[0]])).toEqual([
    raw[0],
  ])
  expect(consolidatePinSpecificationWarnings(circuit, [])).toEqual([])
  const withExtraPort = raw.map((e, i) => ({
    ...e,
    source_port_ids: [`port_${i}`],
  }))
  const merged = consolidatePinSpecificationWarnings(
    circuit,
    withExtraPort,
  ) as ConsolidatedPinSpecificationWarning[]
  expect(merged[0].source_port_ids).toEqual(["port_0", "port_1", "port_2"])
})
