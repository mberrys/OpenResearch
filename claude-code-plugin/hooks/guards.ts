// Pure checks for the orx cardinal rules (see SKILL.md). No engine imports, so
// they are unit-testable.

/** Split a shell command into words, honouring single and double quotes. */
export function tokenize(segment: string): string[] {
  const words: string[] = []
  let cur = ''
  let quote: string | null = null
  let has = false
  for (const ch of segment) {
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      has = true
    } else if (/\s/.test(ch)) {
      if (has || cur) words.push(cur)
      cur = ''
      has = false
    } else {
      cur += ch
    }
  }
  if (has || cur) words.push(cur)
  return words
}

/** Split on unquoted `;`, `&&`, `||`, `|` and newlines. */
export function segments(command: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null
      cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
    } else if (ch === ';' || ch === '|' || ch === '&' || ch === '\n') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.filter(s => s.trim() !== '')
}

const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/

/** True when a run command starts with an env assignment or `env`. */
export function isEnvPrefixed(runCommand: string): boolean {
  const first = tokenize(runCommand.trim())[0] ?? ''
  return ENV_ASSIGN.test(first) || first === 'env'
}

export type OrxCall = {
  /** Words after `orx`, e.g. ['exp', 'run', 'x']. */
  args: string[]
  /** Env assignments written before `orx` in the segment. */
  envPrefix: string[]
}

/** Find `orx ...` invocations in a Bash command. */
export function orxCalls(command: string): OrxCall[] {
  const calls: OrxCall[] = []
  for (const seg of segments(command)) {
    const words = tokenize(seg)
    let i = 0
    const envPrefix: string[] = []
    while (i < words.length && (ENV_ASSIGN.test(words[i]) || words[i] === 'env')) {
      if (ENV_ASSIGN.test(words[i])) envPrefix.push(words[i])
      i++
    }
    if (words[i] === 'orx') {
      calls.push({ args: words.slice(i + 1), envPrefix })
    }
  }
  return calls
}

/** Value of `--flag value` or `--flag=value`, or undefined. */
export function flagValue(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) return args[i + 1] ?? ''
    if (args[i].startsWith(flag + '=')) return args[i].slice(flag.length + 1)
  }
  return undefined
}

/** The project id of `orx project edit <id> --run-command ...`, if that is the call. */
export function runCommandEditTarget(call: OrxCall): string | null {
  const [a, b, id] = call.args
  if (a !== 'project' || b !== 'edit' || !id || id.startsWith('-')) return null
  const value = flagValue(call.args, '--run-command')
  return value && value.trim() !== '' ? id : null
}

/**
 * Synchronous denials: rules 2 and 3 (the run command and environment are a
 * fixed contract; never vary behaviour through env vars). Returns a reason.
 */
export function checkBash(command: string): string | undefined {
  for (const call of orxCalls(command)) {
    const sub = call.args.filter(a => !a.startsWith('-')).slice(0, 2).join(' ')
    const runs = sub === 'exp run' || sub === 'exp create'
    if (call.envPrefix.length > 0 && (runs || sub === 'project edit')) {
      return `orx rule: do not vary behaviour through environment variables (${call.envPrefix.join(' ')}). Commit the change as code/config on a child node's branch instead.`
    }
    const rc = flagValue(call.args, '--run-command')
    if (rc !== undefined && isEnvPrefixed(rc)) {
      return `orx rule: the run command must be identical on every node; env-prefixed commands (${rc.slice(0, 40)}) are not allowed. Put the setting in committed code/config.`
    }
  }
  return undefined
}
