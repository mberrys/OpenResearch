import { test, expect } from 'claude-code/testing'
import { checkBash, isEnvPrefixed, orxCalls, runCommandEditTarget } from './guards'
import { treeRows } from './tree'

test('denies env-prefixed run commands', () => {
  expect(checkBash("orx project edit p1 --run-command 'LR=3e-4 python train.py'")).toBeDefined()
  expect(checkBash('orx exp create p1 --title x --run-command "env A=1 python t.py"')).toBeDefined()
})

test('denies env-prefixed orx invocations', () => {
  expect(checkBash('LR=3e-4 orx exp run e1')).toBeDefined()
})

test('allows ordinary orx and non-orx commands', () => {
  expect(checkBash("orx project edit p1 --run-command 'python train.py'")).toBeUndefined()
  expect(checkBash('orx exp run e1')).toBeUndefined()
  expect(checkBash('FOO=1 python train.py')).toBeUndefined()
  expect(checkBash('git status && orx runs p1')).toBeUndefined()
})

test('finds run-command edits', () => {
  const [call] = orxCalls("orx project edit p1 --run-command 'python t.py'")
  expect(runCommandEditTarget(call)).toBe('p1')
  expect(isEnvPrefixed('python t.py')).toBe(false)
})

test('tree nests children and shows orphans as roots', () => {
  const exp = (id: string, parentId: string | null) => ({ id, title: id, parentId, branch: id, archived: false })
  const rows = treeRows([exp('a', null), exp('b', 'a'), exp('c', 'gone')], [])
  expect(rows.map(r => [r.exp.id, r.depth])).toEqual([['a', 0], ['b', 1], ['c', 0]])
})
