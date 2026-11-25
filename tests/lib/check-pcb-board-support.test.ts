import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  applyToPoint,
  compose,
  rotateDEG,
  translate,
} from "transformation-matrix"
import { checkPcbBoardSupport } from "../../lib/check-pcb-board-support"
import { runAllPlacementChecks } from "../../lib/run-all-checks"
import unsupportedJson from "../fixtures/panel-support/unsupported.json"
import supportedJson from "../fixtures/panel-support/supported.json"

const unsupported = unsupportedJson as AnyCircuitElement[]
const supported = supportedJson as AnyCircuitElement[]
const visualOptions = {
  shouldDrawErrors: true,
  showSolderMask: true,
  backgroundColor: "white",
  colorOverrides: { drill: "white" },
  width: 900,
  height: 1050,
}

test("manual TSX panel: detect four boards hanging from one side", () => {
  const errors = checkPcbBoardSupport(unsupported)
  expect(errors).toHaveLength(4)
  expect(errors.map((e) => [e.center.x, e.center.y]).sort()).toEqual(
    [
      [9, 19],
      [9, -47],
      [9, -14],
      [12, 49],
    ].sort(),
  )
  for (const error of errors) {
    expect(error.support_count).toBe(2)
    expect(error.width).toBeGreaterThan(20)
    expect(error.height).toBeGreaterThan(20)
    expect(error.message).toContain(
      "all surviving mouse-bite tabs attach along one side",
    )
    expect(error.message).not.toContain("pcb_board_panel")
  }
  const svg = convertCircuitJsonToPcbSvg(
    [...unsupported, ...errors],
    visualOptions,
  )
  expect(svg.match(/data-error-region="true"/g)).toHaveLength(4)
  expect(svg).toContain("Support error")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("corrected carrier panel passes", () => {
  expect(checkPcbBoardSupport(supported)).toEqual([])
  const svg = convertCircuitJsonToPcbSvg(supported, visualOptions)
  expect(svg).not.toContain('data-type="pcb_placement_error"')
  expect(svg).toMatchSvgSnapshot(
    import.meta.path,
    "check-pcb-board-support-supported",
  )
})

test("placement runner includes support DRC", async () => {
  const errors = await runAllPlacementChecks(unsupported)
  expect(
    errors.filter((e) => e.message.includes("poorly supported")),
  ).toHaveLength(4)
})

test("native panel envelope takes precedence over child-board envelopes", () => {
  const board = unsupported.find((e) => e.type === "pcb_board")!
  const native: AnyCircuitElement[] = [
    ...unsupported.filter((e) => e.type !== "pcb_board"),
    {
      type: "pcb_panel",
      pcb_panel_id: "native_panel",
      covered_with_solder_mask: true,
      center: board.center,
      width: board.width!,
      height: board.height!,
      thickness: 1.6,
    },
    {
      type: "pcb_board",
      pcb_board_id: "child",
      pcb_panel_id: "native_panel",
      center: { x: 9, y: 19 },
      width: 24,
      height: 30,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
  ]
  expect(checkPcbBoardSupport(native)).toHaveLength(4)
})

for (const angle of [0, 90, 180, 270, 37]) {
  test(`support inference is invariant under ${angle} degree rotation and translation`, () => {
    const matrix = compose(translate(250, -130), rotateDEG(angle))
    const rotated = unsupported.map((e): AnyCircuitElement => {
      if (e.type === "pcb_cutout" && e.shape === "polygon")
        return { ...e, points: e.points.map((p) => applyToPoint(matrix, p)) }
      if (e.type === "pcb_hole") return { ...e, ...applyToPoint(matrix, e) }
      if (e.type === "pcb_board")
        return {
          ...e,
          center: applyToPoint(matrix, e.center),
          outline: [
            { x: -e.width! / 2, y: -e.height! / 2 },
            { x: e.width! / 2, y: -e.height! / 2 },
            { x: e.width! / 2, y: e.height! / 2 },
            { x: -e.width! / 2, y: e.height! / 2 },
          ].map((p) => applyToPoint(matrix, p)),
        }
      return e
    })
    expect(checkPcbBoardSupport(rotated)).toHaveLength(4)
  })
}

test("named and unnamed regions use readable diagnostics", () => {
  for (const name of ["U_LIMIT", undefined]) {
    const circuit = [
      ...unsupported,
      {
        type: "source_component",
        source_component_id: "secret_source",
        ftype: "simple_chip",
        name,
      },
      {
        type: "pcb_component",
        pcb_component_id: "secret_component",
        source_component_id: "secret_source",
        center: { x: 9, y: 19 },
        width: 2,
        height: 2,
        layer: "top",
        rotation: 0,
      },
    ] as AnyCircuitElement[]
    const error = checkPcbBoardSupport(circuit).find(
      (e) => e.center.x === 9 && e.center.y === 19,
    )!
    expect(error.message).toContain(name ?? "unnamed component")
    expect(error.message).not.toContain("secret_")
  }
})

test("ordinary board/drill rows without routing slots are not panel errors", () => {
  expect(
    checkPcbBoardSupport(unsupported.filter((e) => e.type !== "pcb_cutout")),
  ).toEqual([])
  expect(
    checkPcbBoardSupport(unsupported.filter((e) => e.type !== "pcb_hole")),
  ).toEqual([])
})

test("one-tab and fully detached board regions are errors", () => {
  for (const remaining of [1, 0]) {
    const extraSlots = [12, 26].slice(0, 2 - remaining).map(
      (y, i): AnyCircuitElement => ({
        type: "pcb_cutout",
        pcb_cutout_id: `sever_tab_${i}`,
        shape: "rect",
        center: { x: 22.5, y },
        width: 3,
        height: 4,
      }),
    )
    const errors = checkPcbBoardSupport([...unsupported, ...extraSlots])
    const region = errors.find(
      (e) => Math.abs(e.center.x - 9) < 0.1 && Math.abs(e.center.y - 19) < 0.1,
    )
    expect(region?.support_count).toBe(remaining)
  }
})

test("does not mutate the input circuit", () => {
  const before = JSON.stringify(unsupported)
  checkPcbBoardSupport(unsupported)
  expect(JSON.stringify(unsupported)).toBe(before)
})

test("perforation discovery does not depend on record order", () => {
  expect(checkPcbBoardSupport([...unsupported].reverse())).toHaveLength(4)
})
