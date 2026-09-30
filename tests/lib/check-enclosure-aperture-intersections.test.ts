import { expect, test } from "bun:test"
import { getManifoldModule } from "@tscircuit/manifold-2d"
import type { AnyCircuitElement, CadComponent } from "circuit-json"
import {
  checkEnclosureApertureIntersections,
  runAllAssemblyChecks,
  type AssemblyGeometry,
  type CadMesh,
  type EnclosureApertureFace,
} from "../../index"

const kernel = await getManifoldModule()
function box(
  size: [number, number, number],
  center: [number, number, number] = [0, 0, 0],
): CadMesh {
  const cube = kernel.Manifold.cube(size, true)
  const positioned = cube.translate(center)
  try {
    const mesh = positioned.getMesh()
    return { positions: mesh.vertProperties, indices: mesh.triVerts }
  } finally {
    cube.delete()
    positioned.delete()
  }
}
function cad(id: string, pcbId = id): CadComponent {
  return {
    type: "cad_component",
    cad_component_id: id,
    pcb_component_id: pcbId,
    source_component_id: `source_${id}`,
    position: { x: 0, y: 0, z: 0 },
    model_object_fit: "contain_within_bounds",
    anchor_alignment: "center",
  }
}
const records: AnyCircuitElement[] = [cad("base"), cad("lid"), cad("part")]
function context(
  meshes: Record<string, CadMesh>,
  face: EnclosureApertureFace = "y_pos",
): AssemblyGeometry {
  return {
    enclosures: [
      {
        cadComponentIds: ["base"],
        apertures: [{ pcbComponentId: "part", face }],
      },
    ],
    getCadComponentMesh: async (cad) => meshes[cad.cad_component_id]!,
  }
}

test("no assembly context or no apertures never requests a model", async () => {
  expect(await runAllAssemblyChecks(records)).toEqual([])
  const geometry = context({})
  geometry.enclosures[0]!.apertures = []
  geometry.getCadComponentMesh = async () => {
    throw new Error("must not load")
  }
  expect(
    await runAllAssemblyChecks(records, { assemblyGeometry: geometry }),
  ).toEqual([])
})

test("projected area is independent of wall thickness on all six faces", async () => {
  for (const face of [
    "x_pos",
    "x_neg",
    "y_pos",
    "y_neg",
    "z_pos",
    "z_neg",
  ] as const) {
    const axis = face.startsWith("x") ? 0 : face.startsWith("y") ? 1 : 2
    for (const thickness of [0.02, 2]) {
      const shellSize: [number, number, number] = [10, 10, 10]
      const partSize: [number, number, number] = [3, 1, 1]
      shellSize[axis] = thickness
      partSize[axis] = 4
      partSize[(axis + 1) % 3] = 3
      partSize[(axis + 2) % 3] = 1
      const result = await runAllAssemblyChecks(records, {
        assemblyGeometry: context(
          { base: box(shellSize), part: box(partSize) },
          face,
        ),
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: "cad_collision_error",
        error_type: "cad_collision_error",
        cad_component_ids: ["part", "base"],
        pcb_component_ids: ["part", "base"],
        source_component_ids: ["source_part", "source_base"],
        intersection_area_mm2: 3,
        threshold_area_mm2: 2,
      })
    }
  }
})

test("strict threshold excludes equality, slivers, disjoint solids and touching faces", async () => {
  for (const width of [1.5, 2, 2.5]) {
    const geometry = context({
      base: box([10, 2, 10]),
      part: box([width, 4, 1]),
    })
    expect(
      (
        await checkEnclosureApertureIntersections(records, {
          assemblyGeometry: geometry,
        })
      ).length,
    ).toBe(width > 2 ? 1 : 0)
  }
  for (const x of [6, 7]) {
    expect(
      await runAllAssemblyChecks(records, {
        assemblyGeometry: context({
          base: box([10, 2, 10]),
          part: box([2, 4, 1], [x, 0, 0]),
        }),
      }),
    ).toEqual([])
  }
  expect(
    await runAllAssemblyChecks(records, {
      assemblyGeometry: context({
        base: box([10, 2, 10]),
        part: box([2, 4, 1]),
      }),
      intersectionAreaThresholdMm2: 1,
    }),
  ).toHaveLength(1)
})

test("a correctly cut aperture clears its real solid; a misplaced aperture reports a collision", async () => {
  for (const cutX of [0, 5]) {
    const wall = kernel.Manifold.cube([12, 2, 12], true)
    const tool = kernel.Manifold.cube([4, 4, 4], true).translate([cutX, 0, 0])
    const cutWall = wall.subtract(tool)
    try {
      const mesh = cutWall.getMesh()
      const result = await runAllAssemblyChecks(records, {
        assemblyGeometry: context({
          base: { positions: mesh.vertProperties, indices: mesh.triVerts },
          part: box([3, 4, 1]),
        }),
      })
      expect(result).toHaveLength(cutX === 0 ? 0 : 1)
    } finally {
      wall.delete()
      tool.delete()
      cutWall.delete()
    }
  }
})

test("base/lid are unioned before measuring and duplicate aperture references do not repeat loads", async () => {
  const geometry = context({
    base: box([10, 1, 10], [0, -0.5, 0]),
    lid: box([10, 1, 10], [0, 0.5, 0]),
    part: box([3, 4, 1]),
  })
  geometry.enclosures[0]!.cadComponentIds.push("lid")
  geometry.enclosures[0]!.apertures.push({
    pcbComponentId: "part",
    face: "y_pos",
  })
  const loads: string[] = []
  const original = geometry.getCadComponentMesh
  geometry.getCadComponentMesh = async (cad) => {
    loads.push(cad.cad_component_id)
    return original(cad)
  }
  const result = await runAllAssemblyChecks(records, {
    assemblyGeometry: geometry,
  })
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({
    intersection_area_mm2: 3,
    cad_component_ids: ["part", "base", "lid"],
    pcb_component_ids: ["part", "base", "lid"],
    source_component_ids: ["source_part", "source_base", "source_lid"],
  })
  expect(loads.sort()).toEqual(["base", "lid", "part"])
})

test("failed or non-manifold parts are reported while other parts are still checked", async () => {
  const geometry = context({
    base: box([10, 2, 10]),
    part: box([3, 4, 1]),
    invalid: { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] },
  })
  geometry.enclosures[0]!.apertures.push(
    { pcbComponentId: "invalid", face: "y_pos" },
    { pcbComponentId: "failed", face: "y_pos" },
  )
  const result = await runAllAssemblyChecks(
    [...records, cad("invalid"), cad("failed")],
    { assemblyGeometry: geometry },
  )
  expect(result.filter((r) => r.type === "cad_collision_error")).toHaveLength(1)
  expect(result.filter((r) => r.type === "source_runtime_error")).toHaveLength(
    2,
  )
})

test("a missing enclosure mesh cannot yield partial clearance findings", async () => {
  const geometry = context({ base: box([10, 2, 10]), part: box([3, 4, 1]) })
  geometry.enclosures[0]!.cadComponentIds.push("missing_shell")
  const result = await runAllAssemblyChecks(records, {
    assemblyGeometry: geometry,
  })
  expect(result).toHaveLength(1)
  expect(result[0]?.type).toBe("source_runtime_error")
})

test("model fetches are awaited and each assembly only checks its own referenced parts", async () => {
  const geometry = context({
    base: box([10, 2, 10]),
    part: box([3, 4, 1]),
    other_shell: box([10, 2, 10], [100, 0, 0]),
  })
  geometry.enclosures.push({
    cadComponentIds: ["other_shell"],
    apertures: [{ pcbComponentId: "part", face: "y_pos" }],
  })
  let release!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const original = geometry.getCadComponentMesh
  geometry.getCadComponentMesh = async (cad) => {
    await waiting
    return original(cad)
  }
  let done = false
  const check = runAllAssemblyChecks([...records, cad("other_shell")], {
    assemblyGeometry: geometry,
  }).then((result) => {
    done = true
    return result
  })
  await Promise.resolve()
  expect(done).toBe(false)
  release()
  expect(await check).toHaveLength(1)
})
