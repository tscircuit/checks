import type { AnyCircuitElement } from "circuit-json"

type TiDeviceData = {
  parts: Record<
    string,
    { name: string; packageIDWrapper: { packageID: string }[] }
  >
  packages: Record<
    string,
    { packagePin: { ball: string; devicePinID: string }[] }
  >
  muxes: { devicePinID: string; muxSetting: { peripheralPinID: string }[] }[]
  peripheralPins: Record<string, { name: string }>
}

export type TiPinmuxIssue = {
  code:
    | "unknown_part"
    | "missing_pin_data"
    | "unknown_package_pin"
    | "invalid_pin_function"
    | "duplicate_package_pin"
    | "duplicate_function"
  source_port_id?: string
  message: string
}

/** Checks explicitly selected chip pin functions against TI SysConfig device data. */
export function checkTiSysConfigPinmux(
  circuit: AnyCircuitElement[],
  sourceComponentId: string,
  partName: string,
  deviceData: TiDeviceData,
): TiPinmuxIssue[] {
  const part = Object.values(deviceData.parts).find(
    (part) => part.name === partName,
  )
  if (!part)
    return [{ code: "unknown_part", message: `Unknown TI part ${partName}` }]

  const packagePins = part.packageIDWrapper.flatMap(
    ({ packageID }) => deviceData.packages[packageID]?.packagePin ?? [],
  )
  const pinByBall = new Map(packagePins.map((pin) => [pin.ball, pin]))
  const muxByDevicePin = new Map(
    deviceData.muxes.map((mux) => [mux.devicePinID, mux]),
  )
  const issues: TiPinmuxIssue[] = []
  const usedBalls = new Map<string, string>()
  const usedFunctions = new Map<string, string>()
  const connectedPortIds = new Set(
    circuit.flatMap((element) =>
      element.type === "source_trace" ? element.connected_source_port_ids : [],
    ),
  )

  for (const element of circuit) {
    if (
      element.type !== "source_port" ||
      element.source_component_id !== sourceComponentId
    )
      continue
    const port = element as typeof element & {
      package_pin?: string
      active_function?: string
    }
    const {
      package_pin: ball,
      active_function: functionName,
      source_port_id: id,
    } = port
    if (!ball && !functionName && !connectedPortIds.has(id)) continue
    if (!ball || !functionName) {
      issues.push({
        code: "missing_pin_data",
        source_port_id: id,
        message: `${port.name}: packagePin and activeFunction are needed to check this connection`,
      })
      continue
    }
    const pin = pinByBall.get(ball)
    if (!pin) {
      issues.push({
        code: "unknown_package_pin",
        source_port_id: id,
        message: `${ball} is not a pin on ${partName}`,
      })
      continue
    }
    const priorBallPort = usedBalls.get(ball)
    if (priorBallPort)
      issues.push({
        code: "duplicate_package_pin",
        source_port_id: id,
        message: `${ball} is already assigned to ${priorBallPort}`,
      })
    usedBalls.set(ball, id)

    const allowedFunctions = (
      muxByDevicePin.get(pin.devicePinID)?.muxSetting ?? []
    )
      .map(
        ({ peripheralPinID }) =>
          deviceData.peripheralPins[peripheralPinID]?.name,
      )
      .filter((name): name is string => Boolean(name))
    if (!allowedFunctions.includes(functionName)) {
      issues.push({
        code: "invalid_pin_function",
        source_port_id: id,
        message: `${functionName} is not available on ${partName} ball ${ball}; allowed: ${allowedFunctions.join(", ") || "none"}`,
      })
      continue
    }
    const priorFunctionPort = usedFunctions.get(functionName)
    if (priorFunctionPort)
      issues.push({
        code: "duplicate_function",
        source_port_id: id,
        message: `${functionName} is already assigned to ${priorFunctionPort}`,
      })
    usedFunctions.set(functionName, id)
  }

  return issues
}
