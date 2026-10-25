import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { runAllPlacementChecks as runBeforeFix } from "checks-before-via-pad-placement"
import type { AnyCircuitElement } from "circuit-json"
import { runAllPlacementChecks } from "../lib/run-all-checks"
import { introduceRcCarViaFault } from "../tests/fixtures/rc-car-via-pad-corner/introduce-fault"

// Opt-in evidence generation: bunx may download the pinned external CLI.
// The normal test suite uses local checkers and never launches this process.
const root = resolve(import.meta.dir, "..")
const output = resolve(root, "dist/rc-car-via-pad-evidence")
await mkdir(output, { recursive: true })
const original: AnyCircuitElement[] = JSON.parse(
  await readFile(
    resolve(root, "tests/fixtures/rc-car-via-pad-corner/original.circuit.json"),
    "utf8",
  ),
)
const faulty = introduceRcCarViaFault(original)
const placement = {
  originalBefore: await runBeforeFix(structuredClone(original)),
  originalAfter: await runAllPlacementChecks(structuredClone(original)),
  faultyBefore: await runBeforeFix(structuredClone(faulty)),
  faultyAfter: await runAllPlacementChecks(structuredClone(faulty)),
}
if (
  placement.originalBefore.length !== 0 ||
  placement.originalAfter.length !== 0 ||
  placement.faultyBefore.length !== 0 ||
  placement.faultyAfter.length !== 1
) {
  throw new Error("RC-car placement evidence no longer matches the regression")
}

const gerber: Array<{
  variant: string
  command: string[]
  exitCode: number
  shortCount: number
}> = []
for (const [variant, circuit] of [
  ["original", original],
  ["intentional-fault", faulty],
] as const) {
  const filename = `${variant}.circuit.json`
  await writeFile(resolve(output, filename), JSON.stringify(circuit, null, 2))
  const args = [
    "x",
    "--bun",
    "--package",
    "tscircuit@0.0.3016",
    "tsci",
    "check",
    "shorts",
    filename,
    "--mode",
    "gerber",
    "--layer",
    "all",
    "--pixels-per-mm",
    "40",
  ]
  const child = Bun.spawn([process.execPath, ...args], {
    cwd: output,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const shortCount = stdout.includes("No shorts detected")
    ? 0
    : Number(stdout.match(/Detected (\d+) short/)?.[1] ?? Number.NaN)
  // Normalize only machine-specific paths in the saved transcript.
  const transcript = `${stdout}${stderr}\nEXIT_CODE=${exitCode}\n`
    .replaceAll(root, "<repo>")
    .replaceAll(root.replaceAll("\\", "/"), "<repo>")
  await writeFile(resolve(output, `${variant}-gerber.log`), transcript)
  const expected = variant === "original" ? 0 : 1
  if (exitCode !== expected || shortCount !== expected) {
    throw new Error(`Unexpected ${variant} Gerber result; inspect ${output}`)
  }
  gerber.push({ variant, command: ["bun", ...args], exitCode, shortCount })
}

const report = {
  intentionallyIntroducedFault: true,
  description:
    "One added GND via and bottom spur; every original component and route is preserved. The original board is clean.",
  baselineChecker: "@tscircuit/checks@0.0.264",
  fixedChecker: "local PR source",
  cli: "tscircuit@0.0.3016",
  originalCanonicalSha256: createHash("sha256")
    .update(JSON.stringify(original))
    .digest("hex"),
  placement,
  gerber,
}
await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
