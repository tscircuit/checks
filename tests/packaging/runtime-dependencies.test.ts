import { expect, test } from "bun:test"
import packageJson from "../../package.json"

const directRuntimeDependencies = {
  "@tscircuit/circuit-json-util": "^0.0.107",
  "format-si-unit": "^0.0.12",
  "transformation-matrix": "^3.1.0",
} as const

test("direct runtime imports are declared as dependencies", () => {
  const dependencies = packageJson.dependencies as Record<string, string>
  const devDependencies = packageJson.devDependencies as Record<string, string>

  for (const [packageName, versionRange] of Object.entries(
    directRuntimeDependencies,
  )) {
    expect(dependencies[packageName]).toBe(versionRange)
    expect(devDependencies[packageName]).toBeUndefined()
  }
})
