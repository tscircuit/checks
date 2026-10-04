import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const projectDir = process.cwd()
const tempDir = await mkdtemp(join(tmpdir(), "checks-consumer-"))

async function run(cmd: string[], cwd: string) {
  const child = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" })
  if ((await child.exited) !== 0) {
    throw new Error(`Consumer smoke command failed: ${cmd[0]} ${cmd[1]}`)
  }
}

try {
  await run(
    ["npm", "pack", "--ignore-scripts", "--pack-destination", tempDir],
    projectDir,
  )
  const archive = (await readdir(tempDir)).find((name) => name.endsWith(".tgz"))
  if (!archive) throw new Error("No packed checks archive found")
  await writeFile(
    join(tempDir, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@tscircuit/checks": `file:${join(tempDir, archive)}`,
        "@tscircuit/core": "0.0.2079",
        tscircuit: "0.0.2744",
        "circuit-json-to-pnp-csv": "0.0.18",
      },
    }),
  )
  await writeFile(
    join(tempDir, "smoke.ts"),
    `import { checkPcbTraceSelfShorts } from "@tscircuit/checks"
import { Circuit } from "@tscircuit/core"
if (checkPcbTraceSelfShorts([]).length !== 0) throw new Error("Unexpected empty-circuit errors")
if (typeof Circuit !== "function") throw new Error("Core failed to load")
console.log("Packed checks and core loaded with the legacy PnP dependency present")
`,
  )
  await run([process.execPath, "install", "--ignore-scripts"], tempDir)
  await run([process.execPath, "run", "smoke.ts"], tempDir)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
