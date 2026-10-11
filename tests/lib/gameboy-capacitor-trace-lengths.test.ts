import { expect, test } from "bun:test"
import {
  analyzePcbTraceLengths,
  checkPcbTraceLengths,
} from "../../lib/check-pcb-trace-lengths"
import {
  gameboyReviewCandidates,
  loadCorrectedGameboyCircuit,
  loadPublishedGameboyCircuit,
} from "../fixtures/gameboy-advance-0.0.15/load"

test("published GBA findings are reclassified without editing the PCB or authored limits", () => {
  const published = loadPublishedGameboyCircuit()
  const corrected = loadCorrectedGameboyCircuit()
  const original = JSON.stringify(corrected)
  expect(
    published.filter((e) => e.type === "pcb_trace_too_long_error"),
  ).toHaveLength(21)
  const ground = published.find(
    (e) => e.type === "source_trace" && e.name === "C_IOVDD5_GND",
  )!
  expect(
    published.filter(
      (e) =>
        e.type === "pcb_trace" &&
        "source_trace_id" in ground &&
        e.source_trace_id === ground.source_trace_id,
    ),
  ).toHaveLength(72)
  expect(
    analyzePcbTraceLengths(published).find(
      (f) => f.sourceTrace.name === "C_IOVDD5_GND",
    )!.measurement.status,
  ).toBe("indeterminate")
  const findings = analyzePcbTraceLengths(corrected)
  for (const name of gameboyReviewCandidates) {
    const finding = findings.find((f) => f.sourceTrace.name === name)
    expect(finding).toBeDefined()
    expect(finding!.sourceTrace.max_length).toBe(5.5)
    expect(
      finding!.sourceTrace.capacitor_connection?.associated_source_port_id,
    ).toBeDefined()
  }
  for (const name of [
    "LCD_UNUSED_RD_HIGH",
    "IOVDD6_IOVDD5_BRIDGE",
    "IOVDD4_IOVDD5_BRIDGE",
    "V3V3_AVDD_ADC_BRIDGE",
    "AMP_CAP_GROUND_BRIDGE",
    "BAT_OUTPUT_FEEDBACK_LINK",
    "C_IOVDD5_GND",
  ]) {
    expect(findings.find((f) => f.sourceTrace.name === name)).toBeUndefined()
  }
  // Eight of the reviewed false-decoupling labels have real authored constraints.
  // Reclassification must not silently remove these independent length rules.
  for (const name of [
    "C_DVDD2_BULK_SUPPLY",
    "VREG_AVDD_CORE_GND_BRIDGE",
    "XIN_IOVDD4_GND_BRIDGE",
    "CORE_VREG_IN_GND_BRIDGE",
    "QSPI_IOVDD6_GND_BRIDGE",
    "FLASH_GND_EP_MANUAL_BRIDGE",
    "ADC_DVDD1_OFFPAD_GND",
    "VBUS_XOUT_OFFPAD_GROUND",
  ]) {
    const finding = findings.find((f) => f.sourceTrace.name === name)!
    expect(finding.sourceTrace.max_length).toBe(5.5)
    expect(finding.sourceTrace.max_length_origin).toBe("explicit")
    expect(finding.sourceTrace.capacitor_connection).toBeUndefined()
  }
  expect(corrected.filter((e) => e.type.startsWith("pcb_"))).toEqual(
    published.filter((e) => e.type.startsWith("pcb_")),
  )
  for (const diagnostic of checkPcbTraceLengths(corrected)) {
    if (diagnostic.type === "pcb_trace_too_long_error")
      expect(diagnostic.actual_trace_length).toBeLessThan(100)
  }
  expect(JSON.stringify(corrected)).toBe(original)
})
