import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { OrxSnapshot } from '../types'
import { checkBash, orxCalls, runCommandEditTarget } from './guards'
import { emptySnapshot, load, tailLogs } from './orx'
import { activeRuns, treeRows } from './tree'

const PANE = 'orx'
const DASHBOARD = 'http://127.0.0.1:4791'
const snapshot = atom({ plugin: 'orx', key: 'snapshot' } as const, emptySnapshot)

async function refresh($: EngineInterface, projectId?: string | null) {
  const prev: OrxSnapshot = await read($, snapshot)
  const next = await load(
    (argv, init) => $.process.run(argv, init),
    prev,
    await $.clock.now(),
    projectId,
  )
  await update($, snapshot, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'orx',
      description: 'Show OpenResearch projects, experiment tree and runs in a pane',
    })
    $.clock.every(5000, () => void refresh($))

    return next(e)
  })

  on('command.run', { command: 'orx' }, async $ => {
    await $.ui.open({ id: PANE, title: 'OpenResearch' })
    await refresh($)

    return { text: 'OpenResearch pane opened.' }
  })

  // Rules 2 and 3: block env-prefixed orx calls and env-prefixed run commands;
  // rule 2: never change the run command of a project that already has runs.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const reason = checkBash(e.command)
    if (reason) {
      return { deny: `${$.plugin.name}: ${reason}` }
    }
    for (const call of orxCalls(e.command)) {
      const project = runCommandEditTarget(call)
      if (project === null) continue
      try {
        const res = await $.process.run(['orx', 'runs', project, '--json'], { timeoutMs: 15000 })
        if (res.exitCode === 0 && (JSON.parse(res.stdout) as unknown[]).length > 0) {
          return {
            deny: `${$.plugin.name}: project ${project} already has runs, so its run command is a fixed contract. Branch a child and change committed code instead.`,
          }
        }
      } catch {
        // orx unavailable: let the call through and let orx itself report.
      }
    }

    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: its guard failed.` }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, snapshot)
    const rows = treeRows(s.experiments, s.runs)
    const active = activeRuns(s.runs)
    const room = Math.max(5, (e.viewport?.rows ?? 30) - 12)
    const ask = (text: string) => () => void $.prompt.submit({ text })

    return (
      <Box flexDirection="column">
        <Box>
          <Button key="refresh" label="Refresh" onPress={() => refresh($)} />
          <Text> </Text>
          <Button
            key="next-project"
            label="Next project"
            onPress={() => {
              const i = s.projects.findIndex(p => p.id === s.projectId)
              const nxt = s.projects[(i + 1) % Math.max(1, s.projects.length)]
              return refresh($, nxt?.id ?? null)
            }}
          />
          <Text> </Text>
          <Button
            key="dashboard"
            label="Copy dashboard URL"
            onPress={press => $.ui.copy({ text: DASHBOARD, surface: press.surface })}
          />
        </Box>
        {s.error && <Text color="red">{s.error}</Text>}
        {s.projectId === null && !s.error && (
          <Text dimColor>No local projects. Run `orx up` in a repository.</Text>
        )}
        {s.projectId !== null && (
          <Box flexDirection="column">
            <Text bold>{s.projectName}</Text>
            <Text dimColor>run command: {s.runCommand ?? '(not set)'}</Text>
            <Text dimColor>{active.length} active run(s) · full view at {DASHBOARD}</Text>
            {rows.length === 0 && <Text dimColor>No experiments yet.</Text>}
            {rows.slice(0, room).map(row => (
              <Box key={row.exp.id}>
                <Text>
                  {'  '.repeat(row.depth)}
                  {row.glyph} {row.exp.title} <Text dimColor>[{row.status}] {row.exp.id}</Text>{' '}
                </Text>
                <Button
                  key={`child-${row.exp.id}`}
                  label="Child"
                  onPress={ask(
                    `Using orx, branch a child of experiment ${row.exp.id} (${row.exp.title}). Ask me which hypothesis to test, then follow the orx-experiment-tree rules.`,
                  )}
                />
                <Text> </Text>
                <Button
                  key={`logs-${row.exp.id}`}
                  label="Logs"
                  onPress={async () => {
                    const r = s.runs.find(x => x.experimentId === row.exp.id)
                    if (!r) return
                    const text = await tailLogs((a, i) => $.process.run(a, i), r.id)
                    await update($, snapshot, cur => ({ ...cur, logs: { runId: r.id, text } }))
                  }}
                />
              </Box>
            ))}
            {rows.length > room && <Text dimColor>… {rows.length - room} more</Text>}
            {s.logs && (
              <Box flexDirection="column">
                <Text bold>Logs {s.logs.runId}</Text>
                <Text dimColor>{s.logs.text}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
