# @tscircuit/checks

Validity check functions. These functions generally take [a tscircuit json array](https://github.com/tscircuit/soup)
and output an array of arrays for any issues found.

[Getting Started Contributor Video](https://share.cleanshot.com/pk216661)

## Function Overview

| Function | Description |
| --- | --- |
| [`checkConnectorAccessibleOrientation`](./lib/check-connector-accessible-orientation.ts) | Returns `pcb_accessibility_error` for connectors whose orientation makes them inaccessible. |
| [`checkAllPinsInComponentAreUnderspecified`](./lib/check-all-pins-in-component-are-underspecified.ts) | Returns `source_component_pins_underspecified_warning` when every pin on a chip lacks pin attributes. |
| [`checkNoPowerPinDefined`](./lib/check-no-power-pin-defined.ts) | Returns `source_no_power_pin_defined_warning` when a chip has no pin with `requires_power=true`. |
| [`checkNoGroundPinDefined`](./lib/check-no-ground-pin-defined.ts) | Returns `source_no_ground_pin_defined_warning` when a chip has no pin with `requires_ground=true`. |
| [`checkDifferentNetViaSpacing`](./lib/check-different-net-via-spacing.ts) | Returns `pcb_via_clearance_error` if vias on different nets are too close together. |
| [`checkEachPcbPortConnectedToPcbTraces`](./lib/check-each-pcb-port-connected-to-pcb-trace.ts) | Returns `pcb_trace_error` if any `source_port` is not connected to its corresponding PCB traces. |
| [`checkEachPcbTraceNonOverlapping`](./lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping.ts) | Returns `pcb_trace_error` when `pcb_trace` segments overlap incompatible geometry on the same layer. |
| [`checkPcbComponentOverlap`](./lib/check-pcb-components-overlap/checkPcbComponentOverlap.ts) | Returns `pcb_footprint_overlap_error` when footprint elements from different components overlap in disallowed ways. |
| [`checkPcbComponentsOutOfBoard`](./lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard.ts) | Returns `pcb_placement_error` when PCB components do not fit inside the board area. |
| [`checkPcbTracesOutOfBoard`](./lib/check-trace-out-of-board/checkTraceOutOfBoard.ts) | Returns `pcb_trace_error` when any trace segment or via extends beyond the board boundary. |
| [`checkPinMustBeConnected`](./lib/check-pin-must-be-connected.ts) | Returns `pcb_trace_error` when required source pins are not connected. |
| [`checkSameNetViaSpacing`](./lib/check-same-net-via-spacing.ts) | Returns `pcb_via_clearance_error` if vias on the same net are closer than the allowed margin. |
| [`checkSourceTracesHavePcbTraces`](./lib/check-source-traces-have-pcb-traces.ts) | Returns `pcb_trace_error` when source traces are missing corresponding `pcb_trace` routes. |
| [`checkTracesAreContiguous`](./lib/check-traces-are-contiguous/check-traces-are-contiguous.ts) | Returns `pcb_trace_error` when trace endpoints are floating or do not connect as expected. |
| [`checkViasOffBoard`](./lib/check-pcb-components-out-of-board/checkViasOffBoard.ts) | Returns `pcb_placement_error` if any PCB via lies outside or crosses the board boundary. |

## Aggregate check runner functions

| Function | Description |
| --- | --- |
| [`runAllPlacementChecks`](./lib/run-all-checks.ts) | Runs all placement checks (`checkViasOffBoard`, `checkPcbComponentsOutOfBoard`, `checkPcbComponentOverlap`, and `checkConnectorAccessibleOrientation`). |
| [`runAllNetlistChecks`](./lib/run-all-checks.ts) | Runs netlist connectivity checks (currently `checkPinMustBeConnected`). |
| [`runAllPinSpecificationChecks`](./lib/run-all-checks.ts) | Runs pin specification checks (e.g. `checkAllPinsInComponentAreUnderspecified`, `checkNoPowerPinDefined`, and `checkNoGroundPinDefined`). |
| [`runAllRoutingChecks`](./lib/run-all-checks.ts) | Runs all routing checks currently enabled (`checkEachPcbPortConnectedToPcbTraces`, `checkSourceTracesHavePcbTraces`, `checkEachPcbTraceNonOverlapping`, same/different net via spacing, and `checkPcbTracesOutOfBoard`). |
| [`runAllChecks`](./lib/run-all-checks.ts) | Runs placement, netlist, pin specification, and routing checks and returns a combined list of issues. |

## Implementation Details

> [!NOTE]
> It can be helpful to look at an [example soup file](./tests/assets/unrouted-soup-example.json)

tscircuit soup JSON array containing elements. For checks involving source ports,
and pcb traces here are the relevant elements (the types are produced below)

> [!NOTE]
> For the most up-to-date types, check out [@tscircuit/soup](https://github.com/tscircuit/soup)

```ts
// You can import these types from the @tscircuit/soup package e.g.
// import type { PCBPort, PCBTrace, AnySoupElement } from "circuit-json"

import { z } from "zod"
import { distance } from "../units"

export const pcb_trace = z.object({
  type: z.literal("pcb_trace"),
  source_trace_id: z.string().optional(),
  pcb_component_id: z.string().optional(),
  pcb_trace_id: z.string(),
  route: z.array(
    z.union([
      z.object({
        route_type: z.literal("wire"),
        x: distance,
        y: distance,
        width: distance,
        start_pcb_port_id: z.string().optional(),
        end_pcb_port_id: z.string().optional(),
        layer: z.string(),
      }),
      z.object({
        route_type: z.literal("via"),
        x: distance,
        y: distance,
        from_layer: z.string(),
        to_layer: z.string(),
      }),
    ])
  ),
})

export type PCBTraceInput = z.input<typeof pcb_trace>
export type PCBTrace = z.output<typeof pcb_trace>

import { distance } from "../units"
import { layer_ref } from "./properties/layer_ref"

export const pcb_port = z
  .object({
    type: z.literal("pcb_port"),
    pcb_port_id: z.string(),
    source_port_id: z.string(),
    pcb_component_id: z.string(),
    x: distance,
    y: distance,
    layers: z.array(layer_ref),
  })
  .describe("Defines a port on the PCB")

export type PCBPort = z.infer<typeof pcb_port>
export type PCBPortInput = z.input<typeof pcb_port>

export const source_port = z.object({
  type: z.literal("source_port"),
  pin_number: z.number().optional(),
  port_hints: z.array(z.string()).optional(),
  name: z.string(),
  source_port_id: z.string(),
  source_component_id: z.string(),
})

export type SourcePort = z.infer<typeof source_port>

export const source_net = z.object({
  type: z.literal("source_net"),
  source_net_id: z.string(),
  name: z.string(),
  member_source_group_ids: z.array(z.string()),
  is_power: z.boolean().optional(),
  is_ground: z.boolean().optional(),
  is_digital_signal: z.boolean().optional(),
  is_analog_signal: z.boolean().optional(),
})

export type SourceNet = z.infer<typeof source_net>
export type SourceNetInput = z.input<typeof source_net>

import { z } from "zod"

export const pcb_trace_error = z
  .object({
    pcb_error_id: z.string(),
    type: z.literal("pcb_error"),
    error_type: z.literal("pcb_trace_error"),
    message: z.string(),
    pcb_trace_id: z.string(),
    source_trace_id: z.string(),
    pcb_component_ids: z.array(z.string()),
    pcb_port_ids: z.array(z.string()),
  })
  .describe("Defines a trace error on the PCB")

export type PCBTraceErrorInput = z.input<typeof pcb_trace_error>
export type PCBTraceError = z.infer<typeof pcb_trace_error>
```
