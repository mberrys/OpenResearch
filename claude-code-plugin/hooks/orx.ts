import type { OrxExperiment, OrxProject, OrxRun, OrxSnapshot } from '../types'

export type RunProcess = (
  argv: readonly string[],
  init?: { timeoutMs?: number },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>

export const emptySnapshot: OrxSnapshot = {
  projects: [],
  projectId: null,
  projectName: '',
  runCommand: null,
  experiments: [],
  runs: [],
  error: null,
  refreshedAt: 0,
  logs: null,
}

async function json<T>(run: RunProcess, argv: string[]): Promise<T> {
  let res
  try {
    res = await run(['orx', ...argv], { timeoutMs: 15000 })
  } catch (err) {
    throw new Error(`orx not found on PATH or failed to start (${String(err)}). Install it, then run /orx again.`)
  }
  if (res.exitCode !== 0) {
    throw new Error(res.stderr.trim() || `orx ${argv.join(' ')} exited ${res.exitCode}`)
  }
  return JSON.parse(res.stdout) as T
}

/** Load projects, then the selected project's tree and runs. */
export async function load(
  run: RunProcess,
  prev: OrxSnapshot,
  now: number,
  projectId?: string | null,
): Promise<OrxSnapshot> {
  try {
    const projects = await json<OrxProject[]>(run, ['projects', '--json'])
    const wanted = projectId ?? prev.projectId
    const id = projects.find(p => p.id === wanted)?.id ?? projects[0]?.id ?? null
    if (id === null) {
      return { ...emptySnapshot, projects, refreshedAt: now }
    }
    const [view, runs] = await Promise.all([
      json<{ name: string; runCommand: string | null; experiments: OrxExperiment[] }>(run, [
        'project', 'view', id, '--json',
      ]),
      json<OrxRun[]>(run, ['runs', id, '--json']),
    ])
    return {
      projects,
      projectId: id,
      projectName: view.name,
      runCommand: view.runCommand,
      experiments: view.experiments,
      runs,
      error: null,
      refreshedAt: now,
      logs: id === prev.projectId ? prev.logs : null,
    }
  } catch (err) {
    return { ...prev, error: err instanceof Error ? err.message : String(err), refreshedAt: now }
  }
}

export async function tailLogs(run: RunProcess, runId: string, lines = 40): Promise<string> {
  const res = await run(['orx', 'logs', runId], { timeoutMs: 15000 })
  const text = res.exitCode === 0 ? res.stdout : res.stderr
  return text.split('\n').slice(-lines).join('\n')
}
