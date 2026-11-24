import { expect, test } from "bun:test"
import { NetManager } from "../lib/net-manager"

test("merges every network touched by a connection group", () => {
  const manager = new NetManager()

  manager.setConnected(["net-a", "net-b"])
  manager.setConnected(["net-c", "net-d"])
  manager.setConnected(["net-e", "net-f"])
  manager.setConnected(["net-a", "net-c", "net-e"])

  expect(manager.isConnected(["net-a", "net-f"])).toBe(true)
  expect(manager.isConnected(["net-b", "net-d"])).toBe(true)

  manager.setConnected(["net-f", "net-g"])
  expect(manager.isConnected(["net-b", "net-g"])).toBe(true)
  expect(manager.isConnected(["net-a", "outside"])).toBe(false)
})
