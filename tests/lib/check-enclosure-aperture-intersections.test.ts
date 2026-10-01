import { beforeAll, expect, test } from "bun:test"
import {
  getManifoldModule,
  type ManifoldToplevel,
} from "@tscircuit/manifold-2d"
import type {
  AnyCircuitElement,
  CadComponent,
  CadEnclosure,
} from "circuit-json"
import {
  checkEnclosureApertureIntersections,
  runAllAssemblyChecks,
  type CadMesh,
  type EnclosureApertureFace,
} from "../../index"
let kernel: ManifoldToplevel
beforeAll(async () => {
  kernel = await getManifoldModule()
})
function box(
  size: [number, number, number],
  position: [number, number, number] = [0, 0, 0],
): CadMesh {
  const cube = kernel.Manifold.cube(size, true)
  const solid = cube.translate(position)
  try {
    const m = solid.getMesh()
    return { positions: m.vertProperties, indices: m.triVerts }
  } finally {
    cube.delete()
    solid.delete()
  }
}
function obj(mesh: CadMesh) {
  const lines: string[] = []
  for (let i = 0; i < mesh.positions.length; i += 3)
    lines.push(
      `v ${mesh.positions[i]} ${mesh.positions[i + 1]} ${mesh.positions[i + 2]}`,
    )
  for (let i = 0; i < mesh.indices.length; i += 3)
    lines.push(
      `f ${mesh.indices[i]! + 1} ${mesh.indices[i + 1]! + 1} ${mesh.indices[i + 2]! + 1}`,
    )
  return `data:text/plain;base64,${Buffer.from(lines.join("\n")).toString("base64")}`
}
function cad(id: string, mesh?: CadMesh): CadComponent {
  return {
    type: "cad_component",
    cad_component_id: id,
    pcb_component_id: id,
    source_component_id: `source_${id}`,
    position: { x: 0, y: 0, z: 0 },
    model_origin_position: { x: 0, y: 0, z: 0 },
    model_object_fit: "contain_within_bounds",
    anchor_alignment: "center",
    ...(mesh ? { model_obj_url: obj(mesh) } : {}),
  }
}
function context(
  meshes: Record<string, CadMesh>,
  face: EnclosureApertureFace = "y_pos",
  shells = ["base"],
): AnyCircuitElement[] {
  return [
    ...Object.entries(meshes).map(([id, mesh]) => cad(id, mesh)),
    {
      type: "cad_enclosure",
      cad_enclosure_id: "case",
      source_component_id: "source_base",
      cad_component_ids: shells,
      is_in_assembly: true,
      apertures: [{ pcb_component_id: "part", face }],
    },
  ]
}
const enclosure = (json: AnyCircuitElement[]) =>
  json.find((e): e is CadEnclosure => e.type === "cad_enclosure")!
test("ordinary PCB JSON, nonassembly enclosures and empty apertures fetch no models", async () => {
  let requests = 0
  const server = Bun.serve({
    port: 0,
    fetch: () => {
      requests++
      return new Response("unexpected", { status: 500 })
    },
  })
  try {
    const part = { ...cad("part"), model_obj_url: `${server.url}unused.obj` }
    expect(await runAllAssemblyChecks([part])).toEqual([])
    const json: AnyCircuitElement[] = [
      part,
      {
        type: "cad_enclosure",
        cad_enclosure_id: "case",
        source_component_id: "source_base",
        cad_component_ids: ["base"],
        is_in_assembly: false,
        apertures: [{ pcb_component_id: "part", face: "y_pos" }],
      },
    ]
    expect(await runAllAssemblyChecks(json)).toEqual([])
    enclosure(json).is_in_assembly = true
    enclosure(json).apertures = []
    expect(await runAllAssemblyChecks(json)).toEqual([])
    expect(requests).toBe(0)
  } finally {
    server.stop(true)
  }
})
test("Circuit JSON alone measures the same projected area on all six faces and wall thicknesses", async () => {
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
      const shell: [number, number, number] = [10, 10, 10],
        part: [number, number, number] = [3, 1, 1]
      shell[axis] = thickness
      part[axis] = 4
      part[(axis + 1) % 3] = 3
      part[(axis + 2) % 3] = 1
      const result = await runAllAssemblyChecks(
        context({ base: box(shell), part: box(part) }, face),
      )
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
      expect(result[0]).not.toHaveProperty("face")
    }
  }
})
test("strict threshold excludes equality, slivers, disjoint and touching meshes", async () => {
  for (const width of [1.5, 2, 2.5]) {
    const json = context({ base: box([10, 2, 10]), part: box([width, 4, 1]) })
    expect(await checkEnclosureApertureIntersections(json)).toHaveLength(
      width > 2 ? 1 : 0,
    )
    expect(
      await checkEnclosureApertureIntersections(json, {
        intersectionAreaThresholdMm2: 3,
      }),
    ).toHaveLength(0)
  }
  for (const y of [3, 8])
    expect(
      await runAllAssemblyChecks(
        context({ base: box([10, 2, 10]), part: box([3, 4, 1], [0, y, 0]) }),
      ),
    ).toHaveLength(0)
})
test("real boolean apertures clear or obstruct a placed component", async () => {
  for (const x of [0, 5]) {
    const wall = kernel.Manifold.cube([12, 2, 12], true),
      tool = kernel.Manifold.cube([4, 4, 4], true).translate([x, 0, 0]),
      cut = wall.subtract(tool)
    try {
      const m = cut.getMesh()
      expect(
        await runAllAssemblyChecks(
          context({
            base: { positions: m.vertProperties, indices: m.triVerts },
            part: box([3, 4, 1]),
          }),
        ),
      ).toHaveLength(x === 0 ? 0 : 1)
    } finally {
      wall.delete()
      tool.delete()
      cut.delete()
    }
  }
})
test("base/lid union avoids double counting and reference arrays deduplicate shared owners", async () => {
  const json = context(
    {
      base: box([10, 1, 10], [0, -0.5, 0]),
      lid: box([10, 1, 10], [0, 0.5, 0]),
      part: box([3, 4, 1]),
    },
    "y_pos",
    ["base", "lid"],
  )
  for (const c of json)
    if (c.type === "cad_component" && c.cad_component_id !== "part") {
      c.source_component_id = "case_source"
      c.pcb_component_id = "case_pcb"
    }
  enclosure(json).apertures.push({ ...enclosure(json).apertures[0]! })
  const result = await runAllAssemblyChecks(json)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({
    intersection_area_mm2: 3,
    cad_component_ids: ["part", "base", "lid"],
    pcb_component_ids: ["part", "case_pcb"],
    source_component_ids: ["source_part", "case_source"],
  })
})
test("open and failed models are incomplete while valid parts still report collisions", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response("missing", { status: 404 }),
  })
  try {
    const json = context({
      base: box([10, 2, 10]),
      part: box([3, 4, 1]),
      invalid: { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] },
    })
    json.push({ ...cad("failed"), model_obj_url: `${server.url}missing.obj` })
    enclosure(json).apertures.push(
      { pcb_component_id: "invalid", face: "y_pos" },
      { pcb_component_id: "failed", face: "y_pos" },
    )
    const result = await runAllAssemblyChecks(json)
    expect(result.filter((e) => e.type === "cad_collision_error")).toHaveLength(
      1,
    )
    expect(
      result.filter((e) => e.type === "source_runtime_error"),
    ).toHaveLength(2)
  } finally {
    server.stop(true)
  }
})
test("missing shell geometry never yields misleading partial clearance", async () => {
  const json = context({ part: box([3, 4, 1]) })
  expect(await runAllAssemblyChecks(json)).toMatchObject([
    { type: "source_runtime_error", phase_name: "AssemblyDesignRuleChecks" },
  ])
})
test("standalone async checks await HTTP models and isolate unrelated enclosures", async () => {
  let release!: () => void, requested!: () => void
  const blocked = new Promise<void>((r) => (release = r)),
    started = new Promise<void>((r) => (requested = r))
  const body = Buffer.from(obj(box([3, 4, 1])).split(",")[1]!, "base64")
  const server = Bun.serve({
    port: 0,
    fetch: async () => {
      requested()
      await blocked
      return new Response(body)
    },
  })
  try {
    const json = context({
      base: box([10, 2, 10]),
      part: box([3, 4, 1]),
      otherbase: box([10, 2, 10], [100, 0, 0]),
      otherpart: box([3, 4, 1], [100, 10, 0]),
    })
    const part = json.find(
      (e): e is CadComponent =>
        e.type === "cad_component" && e.cad_component_id === "part",
    )!
    part.model_obj_url = `${server.url}part.obj`
    json.push({
      type: "cad_enclosure",
      cad_enclosure_id: "other",
      source_component_id: "othercase",
      cad_component_ids: ["otherbase"],
      is_in_assembly: true,
      apertures: [{ pcb_component_id: "otherpart", face: "y_pos" }],
    })
    let done = false
    const result = runAllAssemblyChecks(json).then((r) => {
      done = true
      return r
    })
    await started
    expect(done).toBe(false)
    release()
    expect(await result).toHaveLength(1)
  } finally {
    release()
    server.stop(true)
  }
})
test("platform cache persists posed meshes across passes and invalidates placement edits", async () => {
  const json = context({ base: box([10, 2, 10]), part: box([3, 4, 1]) })
  const stored = new Map<string, string>()
  let writes = 0,
    hits = 0
  const options = {
    platformConfig: {
      localCacheEngine: {
        getItem: async (key: string) => {
          if (stored.has(key)) hits++
          return stored.get(key) ?? null
        },
        setItem: async (key: string, value: string) => {
          writes++
          stored.set(key, value)
        },
      },
    },
  }
  expect(await runAllAssemblyChecks(json, options)).toHaveLength(1)
  expect(writes).toBe(2)
  expect(
    await runAllAssemblyChecks(JSON.parse(JSON.stringify(json)), options),
  ).toHaveLength(1)
  expect(hits).toBe(2)
  expect(writes).toBe(2)
  const part = json.find(
    (e): e is CadComponent =>
      e.type === "cad_component" && e.cad_component_id === "part",
  )!
  part.position = { x: 100, y: 0, z: 0 }
  expect(await runAllAssemblyChecks(json, options)).toHaveLength(0)
  expect(writes).toBe(3)
  for (const key of stored.keys()) stored.set(key, "{invalid")
  expect(await runAllAssemblyChecks(json, options)).toHaveLength(0)
  expect(writes).toBe(5)
})
test("unavailable platform cache falls back to model loading", async () => {
  const json = context({ base: box([10, 2, 10]), part: box([3, 4, 1]) })
  expect(
    await runAllAssemblyChecks(json, {
      platformConfig: {
        localCacheEngine: {
          getItem() {
            throw new Error("unavailable")
          },
          setItem() {
            throw new Error("unavailable")
          },
        },
      },
    }),
  ).toHaveLength(1)
})
