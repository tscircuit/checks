# Offset board outline / connector orientation reproduction

Run `bun test tests/repros/connector-explicit-outline.test.tsx`.
Regenerate the SVG with `BUN_UPDATE_SNAPSHOTS=1` before that command.

The fixture is a native TSX reduction of the AM3352 board at
[3e6fd066](https://github.com/0hmX/am3352-ddr-track-a-local-dfm-wip-20261007/tree/3e6fd0663d36d712c7005dd92cbd3ba0523fdc5a).
It retains all 14 microSD SMT lands, all 19 HDMI signal lands and four shield
slots, both courtyard rectangles, placements, rotations and explicit board outline.
Unrelated circuitry is omitted. The original `chip` representation is retained.
Circuit JSON, insertion inference, rotated metadata and warnings are generated
by core, never hand-authored. The test bundles core with this checkout's checks
to avoid results from core's installed checks dependency. Only orientation
warnings are displayed in the snapshot; other placement checks are out of scope.
Warning labels are shortened for display only; assertions inspect native warnings.

Inspect the microSD connector at (-16.4, -17.5), rotated 270°. Its left-facing
mouth is nearer the actual left edge (8.6 mm) than the bottom (11.5 mm).
The declared 75 × 55 rectangle centered on (0,0) instead suggests 21.1 mm left
and 10 mm bottom. `getBoardBounds` prioritizes that rectangle over the outline.
The reproduction records the erroneous recommendation to face down.

HDMI at (44.625, -20), 0°, is a separate control: its physical mouth faces right,
but the pad-only heuristic guesses left. `<footprint insertionDirection="from_right">`
is the supported metadata. MicroSD uses `from_bottom` in its unrotated footprint;
core transforms it to `from_left` at 270°. The second panel adds only these
metadata values. It must still expose the outline bug until the checker is fixed.

Footprints come from the board's `data/support-footprints.tsx` (MICROSD),
`data/support-mechanics.tsx`, and `hdmi/data/footprints.tsx` (HDMI_A_MOLEX_2086581001).
They derive from KiCad's `microSD_HC_Hirose_DM3AT-SF-PEJM5.kicad_mod` and
`HDMI_A_Molex_208658-1001_Horizontal.kicad_mod`, respectively. Pad dimensions are
unchanged; the microSD shell is pin11 and HDMI shields are pin20–23.
The board's mechanical audit identifies the microSD mouth at local y≈-8.125
and HDMI front at local x=8.025. Primary drawings:
[Hirose DM3AT](https://www.hirose.com/product/download/?distributor=chip1&lang=en&num=DM3AT-SF-PEJM5&type=2d),
[Molex 2086581001](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/208/208658/2086581001_sd.pdf).

This tests axis-aligned outline bounds, not nearest segments of a concave board,
enclosure clearance or mechanical qualification. No hardware needs rotating.
