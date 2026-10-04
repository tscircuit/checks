import { expect, test } from "bun:test"
import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import { checkCopperPourShorts } from "../../lib/check-copper-pour-shorts"
import { polygonContainsPoint } from "../../lib/util/polygon-contains-point"
import { createPourHoleCircuit } from "../fixtures/collinear-pour-hole"

test("a tiny straight-edge subdivision in an arc cutout cannot create a short", (): void => {
  const cases = [false, true].map((subdivide) => {
    const circuit = createPourHoleCircuit({ collinearVertices: true })
    const pour = circuit.find((element) => element.type === "pcb_copper_pour")!
    if (pour.type !== "pcb_copper_pour" || pour.shape !== "brep") {
      throw new Error("Expected the BRep pour fixture")
    }
    const vertices = pour.brep_shape.inner_rings[0].vertices
    vertices[1].bulge = 0.1
    if (!subdivide) vertices.splice(3, 1)
    const { elements } = convertCircuitJsonToFlattenJs(circuit, {
      elementTypes: ["pcb_copper_pour", "pcb_smtpad"],
      strict: true,
    })
    const copper = elements.find(
      (element) => element.sourceElement.type === "pcb_copper_pour",
    )!.shapes[0]
    const pad = elements.find(
      (element) => element.sourceElement.type === "pcb_smtpad",
    )!.shapes[0]
    expect(copper.intersect(pad)).toEqual([])
    return { circuit, copper, pad }
  })
  expect(cases[0].copper.box).toEqual(cases[1].copper.box)
  expect(cases[0].copper.area()).toBeCloseTo(cases[1].copper.area(), 12)
  for (const { circuit, copper, pad } of cases) {
    expect(checkCopperPourShorts(circuit)).toEqual([])
    const point = [...pad.faces][0].first.start
    expect(polygonContainsPoint(copper, point)).toBe(false)
    copper.reverse()
    expect(polygonContainsPoint(copper, point)).toBe(false)
  }

  const contact = createPourHoleCircuit({ collinearVertices: true, padX: 4 })
  const pour = contact.find((element) => element.type === "pcb_copper_pour")!
  if (pour.type !== "pcb_copper_pour" || pour.shape !== "brep") {
    throw new Error("Expected the BRep pour fixture")
  }
  pour.brep_shape.inner_rings[0].vertices[1].bulge = 0.1
  expect(checkCopperPourShorts(contact)).toHaveLength(1)
})
