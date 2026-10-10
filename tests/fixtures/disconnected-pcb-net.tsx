// Disconnected layout from https://github.com/tscircuit/core/pull/4495
export function DisconnectedPcbNet() {
  return (
    <board width={20} height={10} schematicDisabled routeRemaining={false}>
      {(
        [
          ["A", -6],
          ["B", -2],
          ["C", 2],
          ["D", 6],
        ] as const
      ).map(([name, pcbX]) => (
        <chip
          key={name}
          name={name}
          pcbX={pcbX}
          footprint={
            <footprint>
              <smtpad portHints={["1"]} width={1} height={1} shape="rect" />
            </footprint>
          }
        />
      ))}
      <net name="GND" connectsTo={["A.1", "B.1", "C.1", "D.1"]} />
      <trace from="A.1" to="B.1" pcbPath={[]} thickness={0.3} />
      <trace from="C.1" to="D.1" pcbPath={[]} thickness={0.3} />
    </board>
  )
}
