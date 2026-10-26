# Eltek Flatpack2 adapter: JC3 XT60 connector

This fixture uses the complete JC3 footprint and four existing vias from
[Flatpack2 Adapter by neg2led / neggles](https://github.com/neggles/flatpack2-adapter/tree/208545145e046e09d95dc1f875ffcb484e7fcce5).
The author's README describes the XT60 combination footprint and manufactured boards.

- [Original board](https://github.com/neggles/flatpack2-adapter/blob/208545145e046e09d95dc1f875ffcb484e7fcce5/EltekFlatpack2/EltekFlatpack2.kicad_pcb)
- [Amass XT60PW-M combination footprint](https://github.com/neggles/flatpack2-adapter/blob/208545145e046e09d95dc1f875ffcb484e7fcce5/EltekFlatpack2/EltekFlatpack2.pretty/Amass_XT60PW-M_Kombifootprint.kicad_mod)
- License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), included here.
  The original PCB is unmodified. The extracted JSON and its rendered snapshots
  are adaptations distributed under the same license.

## What the regression demonstrates

JC3 has two custom plated copper pads, two circular terminal-block pads, and two
slotted mounting pads. Four original 0.4 mm via drills lie inside the long custom
copper extensions, away from the connector's 2.7 mm drills:

| KiCad via position (mm) | JC3 pin | Net |
| --- | --- | --- |
| 158, 66.55 | 1 | /VBUS- |
| 159.5, 66.55 | 1 | /VBUS- |
| 158, 71.45 | 2 | /VBUS+ |
| 159.5, 71.45 | 2 | /VBUS+ |

No via was added or moved. KiCad's effective pad polygons independently confirm
all four via centers are inside copper. This is a via-in-pad coverage example
with same-net vias; it does not establish an electrical short. Intentional use
is allowed by the checks library's `is_via_in_pad_allowed` board setting.

## Regeneration

1. Copy `EltekFlatpack2.kicad_pcb` to a temporary directory and upgrade the copy
   with `kicad-cli pcb upgrade` (KiCad 10.0.7 was used).
2. Import it with `KicadToCircuitJsonConverter` from `kicad-to-circuit-json` 0.0.143
   ([source commit](https://github.com/tscircuit/kicad-to-circuit-json/tree/6563c11586a73fa189d9f2c4d23e5eeedfa0ce4e)):
   add the upgraded PCB file, call `runUntilFinished()`, then `getOutput()`.
3. Select the `source_component` named `JC3`, every element with its
   `source_component_id` or the associated `pcb_component_id`, the board record,
   vias `pcb_via_84`, `pcb_via_85`, `pcb_via_100`, `pcb_via_101`, and their
   `source_net` records. Serialize these objects without modifying their fields.

The JSON contains 39 original imported objects. Every selected object compares
equal to the complete importer output. Coordinate conversion is
`x = KiCad x - 150.625`, `y = 90.5 - KiCad y`.

The importer has already oriented `pad_outline` for JC3's -90 degree rotation.
No `ccw_rotation` is emitted for these circular drills. Applying the component's
rotation again moves the copper away from the real vias and misses the overlap.
