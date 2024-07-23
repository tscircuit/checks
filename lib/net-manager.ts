export class NetManager {
  private networks: Set<Set<string>> = new Set()

  setConnected(nodes: string[]): void {
    if (nodes.length < 2) return

    let targetNetwork: Set<string> | null = null

    // Check if any of the nodes are already in a network
    for (const network of this.networks) {
      for (const node of nodes) {
        if (network.has(node)) {
          if (targetNetwork === null) {
            targetNetwork = network
          } else if (targetNetwork !== network) {
            // Merge networks
            for (const mergeNode of network) {
              targetNetwork.add(mergeNode)
            }
            this.networks.delete(network)
          }
          break
        }
      }
      if (targetNetwork !== null && targetNetwork !== network) break
    }

    // If no existing network found, create a new one
    if (targetNetwork === null) {
      targetNetwork = new Set(nodes)
      this.networks.add(targetNetwork)
    } else {
      // Add all nodes to the target network
      for (const node of nodes) {
        targetNetwork.add(node)
      }
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
