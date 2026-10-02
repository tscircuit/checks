import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkTiSysConfigPinmux } from "../lib/check-ti-sysconfig-pinmux"

const deviceData = {
  parts: {
    part: { name: "AM3352-ZCZ", packageIDWrapper: [{ packageID: "pkg" }] },
  },
  packages: {
    pkg: {
      packagePin: [
        { ball: "U7", devicePinID: "pad1" },
        { ball: "V7", devicePinID: "pad2" },
      ],
    },
  },
  muxes: [
    { devicePinID: "pad1", muxSetting: [{ peripheralPinID: "f1" }] },
    { devicePinID: "pad2", muxSetting: [{ peripheralPinID: "f2" }] },
  ],
  peripheralPins: { f1: { name: "gpmc_ad0" }, f2: { name: "gpmc_ad1" } },
}

const port = (id: string, ball?: string, fn?: string) => ({
  type: "source_port" as const,
  source_component_id: "U1",
  source_port_id: id,
  name: id,
  package_pin: ball,
  active_function: fn,
})

test("TI pinmux check distinguishes valid, invalid, and unannotated connected pins", () => {
  const circuit = [
    port("p1", "U7", "gpmc_ad0"),
    port("p2", "V7", "gpmc_ad0"),
    port("p3"),
    {
      type: "source_trace",
      source_trace_id: "t1",
      connected_source_port_ids: ["p1", "p3"],
    },
  ] as AnyCircuitElement[]

  expect(
    checkTiSysConfigPinmux([circuit[0]], "U1", "AM3352-ZCZ", deviceData),
  ).toEqual([])
  expect(
    checkTiSysConfigPinmux(circuit, "U1", "AM3352-ZCZ", deviceData).map(
      (issue) => issue.code,
    ),
  ).toEqual(["invalid_pin_function", "missing_pin_data"])
  expect(
    checkTiSysConfigPinmux(circuit, "U1", "AM3352-ZCE", deviceData)[0]?.code,
  ).toBe("unknown_part")
})
