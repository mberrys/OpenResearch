export type OrxProject = { id: string; name: string }

export type OrxExperiment = {
  id: string
  title: string
  parentId: string | null
  branch: string
  archived: boolean
}

export type OrxRun = {
  id: string
  experimentId: string
  status: string
  durationSecs: number
  updated: string
  failure: string | null
}

export type OrxSnapshot = {
  projects: OrxProject[]
  projectId: string | null
  projectName: string
  runCommand: string | null
  experiments: OrxExperiment[]
  runs: OrxRun[]
  error: string | null
  refreshedAt: number
  logs: { runId: string; text: string } | null
}

declare module 'claude-code' {
  interface PluginState {
    orx: { snapshot: OrxSnapshot }
  }
}
