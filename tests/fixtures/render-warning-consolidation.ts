/** Snapshot the actual check messages before and after consolidation. */
export function renderWarningConsolidation(
  title: string,
  before: { message?: string }[],
  after: { message?: string }[],
) {
  const escape = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  const wrap = (text: string) => {
    const lines: string[] = []
    let line = ""
    for (const word of text.split(/\s+/)) {
      if (line && line.length + word.length + 1 > 61) {
        lines.push(line)
        line = ""
      }
      line += (line ? " " : "") + word
    }
    if (line) lines.push(line)
    return lines
  }
  const rows = (warnings: { message?: string }[]) =>
    warnings.flatMap((w, i) => [...wrap(`${i + 1}. ${w.message ?? ""}`), ""])
  const left = rows(before),
    right = rows(after)
  const height = 150 + Math.max(left.length, right.length) * 18
  const column = (x: number, label: string, lines: string[]) =>
    `<text x="${x}" y="90" font-size="18" font-weight="bold" fill="#a66a00">${escape(label)}</text>` +
    lines
      .map(
        (line, i) =>
          `<text x="${x}" y="${125 + i * 18}" font-size="13" fill="#243247">${escape(line)}</text>`,
      )
      .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}" viewBox="0 0 1100 ${height}"><rect width="1100" height="${height}" fill="#f5f7fb"/><g font-family="monospace"><text x="28" y="40" font-size="22" font-weight="bold" fill="#16263d">${escape(title)}</text><path d="M550 65V${height - 25}" stroke="#cbd5e1"/>${column(28, `Before: ${before.length} warning ${before.length === 1 ? "entry" : "entries"}`, left)}${column(575, `After: ${after.length} warning ${after.length === 1 ? "entry" : "entries"}`, right)}</g></svg>`
}
