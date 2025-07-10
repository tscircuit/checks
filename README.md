# @tscircuit/checks

Validity check functions. These functions generally take [a tscircuit json array](https://github.com/tscircuit/soup)
and output an array of arrays for any issues found.

## `checkEachPcbPortConnected(soup: AnySoupElement[]) => PCBTraceError[]`

Returns `pcb_trace_error` if any `source_port` is not connected to a net or it's other
source ports.

## `checkEachPcbTraceNonOverlapping(soup: AnySoupElement[]) => PCBTraceError[]`

Returns `pcb_trace_error` if any `pcb_trace` is overlapping with another `pcb_trace`
that is not connected to the same net.

## `checkSameNetViaSpacing(circuitJson: AnyCircuitElement[]) => PcbPlacementError[]`

Returns `pcb_placement_error` if any vias on the same net are placed closer
than the allowed margin.

## `checkViasOffBoard(circuitJson: AnyCircuitElement[]) => PcbPlacementError[]`

Returns `pcb_placement_error` if any PCB via lies outside or crosses the board
boundary.

## `checkPcbComponentsOutOfBoard(circuitJson: AnyCircuitElement[]) => PcbPlacementError[]`

Returns `pcb_placement_error` when a PCB component does not fit inside the board
area.

## `checkTracesAreContiguous(circuitJson: AnyCircuitElement[]) => PCBTraceError[]`

Returns `pcb_trace_error` if a PCB trace is misaligned or does not properly
connect to its expected pads.

## `checkTraceSpacing(circuitJson: AnyCircuitElement[]) => PCBTraceError[]`

Returns `pcb_trace_error` if two PCB traces are closer than the minimum given
distance between them.

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
