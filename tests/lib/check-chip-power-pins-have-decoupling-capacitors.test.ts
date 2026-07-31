import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkChipPowerPinsHaveDecouplingCapacitors } from "lib/check-chip-power-pins-have-decoupling-capacitors"
import { runAllNetlistChecks } from "lib/run-all-checks"

test("warns only for connected chip power pins missing a decoupling capacitor", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      ftype: "simple_chip",
      source_component_id: "missing_chip",
      name: "U_MISSING",
    },
    {
      type: "source_component",
      ftype: "simple_chip",
      source_component_id: "decoupled_chip",
      name: "U_WITH_CAP",
    },
    {
      type: "source_component",
      ftype: "simple_chip",
      source_component_id: "opt_out_chip",
      name: "U_OPT_OUT",
    },
    {
      type: "source_component",
      ftype: "simple_chip",
      source_component_id: "power_source_chip",
      name: "U_POWER_SOURCE",
    },
    {
      type: "source_component",
      ftype: "simple_chip",
      source_component_id: "unconnected_chip",
      name: "U_UNCONNECTED",
    },
    {
      type: "source_component",
      ftype: "simple_capacitor",
      source_component_id: "decoupling_capacitor",
      name: "C1",
      capacitance: 1e-7,
    },
    {
      type: "source_port",
      source_port_id: "missing_vcc",
      source_component_id: "missing_chip",
      name: "pin1",
      port_hints: ["pin1", "VCC"],
      requires_power: true,
      should_have_decoupling_capacitor: true,
      recommended_decoupling_capacitor_capacitance: "100nF",
    },
    {
      type: "source_port",
      source_port_id: "missing_gnd",
      source_component_id: "missing_chip",
      name: "pin2",
      port_hints: ["pin2", "GND"],
      requires_ground: true,
    },
    {
      type: "source_port",
      source_port_id: "decoupled_vdd",
      source_component_id: "decoupled_chip",
      name: "VDD",
      should_have_decoupling_capacitor: true,
    },
    {
      type: "source_port",
      source_port_id: "decoupled_gnd",
      source_component_id: "decoupled_chip",
      name: "GND",
      requires_ground: true,
    },
    {
      type: "source_port",
      source_port_id: "opt_out_vbat",
      source_component_id: "opt_out_chip",
      name: "VBAT",
      requires_power: true,
      should_have_decoupling_capacitor: false,
    },
    {
      type: "source_port",
      source_port_id: "opt_out_gnd",
      source_component_id: "opt_out_chip",
      name: "GND",
      requires_ground: true,
    },
    {
      type: "source_port",
      source_port_id: "power_source_vcc",
      source_component_id: "power_source_chip",
      name: "VCC",
      provides_power: true,
      should_have_decoupling_capacitor: false,
    },
    {
      type: "source_port",
      source_port_id: "power_source_gnd",
      source_component_id: "power_source_chip",
      name: "GND",
      provides_ground: true,
    },
    {
      type: "source_port",
      source_port_id: "unconnected_vcc",
      source_component_id: "unconnected_chip",
      name: "VCC",
      requires_power: true,
      should_have_decoupling_capacitor: true,
    },
    {
      type: "source_port",
      source_port_id: "unconnected_gnd",
      source_component_id: "unconnected_chip",
      name: "GND",
      requires_ground: true,
    },
    {
      type: "source_port",
      source_port_id: "capacitor_power",
      source_component_id: "decoupling_capacitor",
      name: "pin1",
    },
    {
      type: "source_port",
      source_port_id: "capacitor_ground",
      source_component_id: "decoupling_capacitor",
      name: "pin2",
    },
    {
      type: "source_net",
      source_net_id: "ground_net",
      name: "GND",
      member_source_group_ids: [],
      is_ground: true,
    },
    {
      type: "source_net",
      source_net_id: "missing_power_net",
      name: "VCC_MISSING",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "opt_out_power_net",
      name: "VBAT",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "provided_power_net",
      name: "VCC_SOURCE",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "ground_trace",
      connected_source_port_ids: [
        "missing_gnd",
        "decoupled_gnd",
        "opt_out_gnd",
        "power_source_gnd",
        "unconnected_gnd",
        "capacitor_ground",
      ],
      connected_source_net_ids: ["ground_net"],
    },
    {
      type: "source_trace",
      source_trace_id: "missing_power_trace",
      connected_source_port_ids: ["missing_vcc"],
      connected_source_net_ids: ["missing_power_net"],
    },
    {
      type: "source_trace",
      source_trace_id: "decoupled_power_trace",
      connected_source_port_ids: ["decoupled_vdd", "capacitor_power"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "opt_out_power_trace",
      connected_source_port_ids: ["opt_out_vbat"],
      connected_source_net_ids: ["opt_out_power_net"],
    },
    {
      type: "source_trace",
      source_trace_id: "provided_power_trace",
      connected_source_port_ids: ["power_source_vcc"],
      connected_source_net_ids: ["provided_power_net"],
    },
  ]

  const warnings = checkChipPowerPinsHaveDecouplingCapacitors(circuitJson)

  expect(warnings).toEqual([
    {
      type: "source_pin_missing_trace_warning",
      source_pin_missing_trace_warning_id:
        "source_pin_missing_trace_warning_decoupling_missing_vcc",
      warning_type: "source_pin_missing_trace_warning",
      message:
        "Power pin VCC on U_MISSING should have a 100nF decoupling capacitor connected to ground",
      source_component_id: "missing_chip",
      source_port_id: "missing_vcc",
      subcircuit_id: undefined,
    },
  ])
  expect(await runAllNetlistChecks(circuitJson)).toContainEqual(warnings[0])
})
