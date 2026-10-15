import type { OrxExperiment, OrxRun } from '../types'

export type TreeRow = {
  exp: OrxExperiment
  depth: number
  status: string
  glyph: string
}

const GLYPHS: Record<string, string> = {
  running: '●',
  starting: '◌',
  done: '✓',
  failed: '✗',
  cancelled: '⊘',
}

/** Status of an experiment's newest run (runs arrive newest first). */
export function latestStatus(expId: string, runs: OrxRun[]): string {
  return runs.find(r => r.experimentId === expId)?.status ?? 'no runs'
}

export function glyphFor(status: string): string {
  return GLYPHS[status] ?? '○'
}

/** Depth-first rows, children under parents, roots first. */
export function treeRows(experiments: OrxExperiment[], runs: OrxRun[]): TreeRow[] {
  const ids = new Set(experiments.map(e => e.id))
  const children = new Map<string | null, OrxExperiment[]>()
  for (const e of experiments) {
    // An orphan (parent archived/hidden) is shown as a root.
    const key = e.parentId !== null && ids.has(e.parentId) ? e.parentId : null
    children.set(key, [...(children.get(key) ?? []), e])
  }
  const rows: TreeRow[] = []
  const seen = new Set<string>()
  const walk = (key: string | null, depth: number) => {
    for (const exp of children.get(key) ?? []) {
      if (seen.has(exp.id)) continue
      seen.add(exp.id)
      const status = latestStatus(exp.id, runs)
      rows.push({ exp, depth, status, glyph: glyphFor(status) })
      walk(exp.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

export function activeRuns(runs: OrxRun[]): OrxRun[] {
  return runs.filter(r => r.status === 'running' || r.status === 'starting')
}
