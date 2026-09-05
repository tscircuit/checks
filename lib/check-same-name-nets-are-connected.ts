import type {
  AnyCircuitElement,
  SourceConfusingNetNameWarning,
  SourceNet,
} from "circuit-json"

/** Warn once per name when its source nets belong to multiple electrical islands. */
export function checkSameNameNetsAreConnected(
  circuitJson: AnyCircuitElement[],
): SourceConfusingNetNameWarning[] {
  const parents = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parents.has(root) && parents.get(root) !== root) {
      root = parents.get(root)!
    }
    while (parents.has(id) && parents.get(id) !== root) {
      const next = parents.get(id)!
      parents.set(id, root)
      id = next
    }
    return root
  }
  const connect = (ids: string[]) => {
    if (ids.length < 2) return
    const root = find(ids[0]!)
    for (const id of ids.slice(1)) parents.set(find(id), root)
  }
  const netsByName = new Map<string, SourceNet[]>()
  for (const element of circuitJson) {
    if (element.type === "source_net" && element.name.trim()) {
      const nets = netsByName.get(element.name) ?? []
      nets.push(element)
      netsByName.set(element.name, nets)
    }
    if (element.type === "source_trace") {
      connect([
        ...element.connected_source_net_ids.map((id) => `net:${id}`),
        ...element.connected_source_port_ids.map((id) => `port:${id}`),
      ])
    }
    if (element.type === "source_component_internal_connection") {
      connect(element.source_port_ids.map((id) => `port:${id}`))
    }
    if (element.type === "source_component") {
      for (const ids of element.internally_connected_source_port_ids ?? []) {
        connect(ids.map((id) => `port:${id}`))
      }
    }
  }

  const warnings: SourceConfusingNetNameWarning[] = []
  for (const [name, nets] of netsByName) {
    const islands = new Set(nets.map((net) => find(`net:${net.source_net_id}`)))
    if (islands.size < 2) continue
    const ids = nets.map((net) => net.source_net_id).sort()
    warnings.push({
      type: "source_confusing_net_name_warning",
      source_confusing_net_name_warning_id: `source_confusing_net_name_warning_${ids[0]}`,
      warning_type: "source_confusing_net_name_warning",
      message: `Nets named "${name}" are not all connected (${islands.size} separate electrical networks). Connect them or use distinct names to avoid confusion.`,
      source_net_ids: ids,
      net_name: name,
      ...(nets.every((net) => net.subcircuit_id === nets[0]!.subcircuit_id)
        ? { subcircuit_id: nets[0]!.subcircuit_id }
        : {}),
    })
  }
  return warnings
}
