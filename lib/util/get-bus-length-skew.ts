/** Routed planar length skew, in mm. Omitted reference retains range skew. */
export function getBusLengthSkew({
  lengths,
  reference,
}: {
  lengths: number[]
  reference?: "range" | "mean"
}): number {
  if (!lengths.length) return 0
  if (reference !== "mean") return Math.max(...lengths) - Math.min(...lengths)
  const mean = lengths.reduce((sum, length) => sum + length, 0) / lengths.length
  return Math.max(...lengths.map((length) => Math.abs(length - mean)))
}
