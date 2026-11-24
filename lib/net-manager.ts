export class NetManager {
  private networks: Set<Set<string>> = new Set()

  setConnected(nodes: string[]): void {
    if (nodes.length < 2) return

    const overlappingNetworks = [...this.networks].filter((network) =>
      nodes.some((node) => network.has(node)),
    )

    if (overlappingNetworks.length === 0) {
      this.networks.add(new Set(nodes))
      return
    }

    const targetNetwork = overlappingNetworks[0]!
    for (const network of overlappingNetworks.slice(1)) {
      for (const mergeNode of network) {
        targetNetwork.add(mergeNode)
      }
      this.networks.delete(network)
    }
    for (const node of nodes) {
      targetNetwork.add(node)
    }
  }

  isConnected(nodes: string[]): boolean {
    if (nodes.length < 2) return true

    for (const network of this.networks) {
      if (nodes.every((node) => network.has(node))) {
        return true
      }
    }

    return false
  }
}
