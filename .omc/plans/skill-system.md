# Skill System — Plan

## Requirements Summary

Implement a Claude Code-compatible local skill system for Freed:
- Skills are `.md` files with YAML frontmatter (`SKILL.md` format)
- Stored in filesystem folders users can copy/paste into
- Three scopes: **system-wise** (`~/.freed/skills/`), **user-wise** (`~/.claude/skills/`), **project-wise** (`<project>/.claude/skills/`)
- Skills auto-detect based on project context — automatically available to all agents working in a project
- Follows Claude Code / industry standard skill format

---

## Skill Format (Claude Code Standard)

Each skill is a directory containing `SKILL.md`:

```
skill-name/
└── SKILL.md
```

**Frontmatter:**
```yaml
---
name: skill-name
description: When to use this skill
---
```

**Body:** Plain markdown with usage guidance, patterns, examples.

> **Note:** The `version` field is parsed but ignored. No version-compatibility policy is defined; skills are always loaded at their current content. A future version-compatibility mechanism may be added if needed.

---

## Scope & Loading

| Scope | Path | Notes |
|-------|------|-------|
| System | `~/.freed/skills/` | Machine-wide, all projects |
| User | `~/.claude/skills/` | User-wide, all projects |
| Project | `<project>/.claude/skills/` | Project-specific |

Loading order (later = higher priority): system → user → project.

Each scope is scanned independently. Duplicates (same skill name) resolved by priority (project wins).

---

## Acceptance Criteria

| # | Criterion | Measurable Definition |
|---|-----------|----------------------|
| 1 | `~/.freed/skills/<name>/SKILL.md` is loaded at runtime | After CLI startup, `GET /skills` (or `/skills` slash command) returns the skill by name; skill content is included in agent context object |
| 2 | `~/.claude/skills/<name>/SKILL.md` is loaded at runtime | Same as AC-1 |
| 3 | `<project>/.claude/skills/<name>/SKILL.md` is loaded when agent works in that project | Skills at `<project>/.claude/skills/` appear in `getForProject(projectPath)` output within 1 second of agent starting work in that project directory |
| 4 | Project scope wins over user scope wins over system scope | `skillRegistry.getForProject(proj)` returns exactly one `Skill` per unique `name`; when duplicate names exist across scopes, the returned `Skill.scope === 'project'` |
| 5 | Skills are passed as contextual guidance, not callable tools | Agent startup logs include `"N skills loaded for project"`; skills appear in agent context under a `skills` key (string array), NOT in the tools list |
| 6 | Auto-detect: project skills loaded on agent start | When an agent begins work in a directory containing `.claude/skills/`, `getForProject()` is called automatically before the first task is dispatched, with no explicit opt-in by the user |
| 7 | `/skills` slash command lists all loaded skills | Invoking `/skills` in the CLI returns a table of `name` + `description` for every skill in `skillRegistry.listNames()` |
| 8 | `/skill <name>` shows skill detail | Invoking `/skill demo` returns the full `content` of the skill whose `name === 'demo'`, or an error if not found |
| 9 | Invalid skill directories skipped with warning log | Creating a directory under any skills root without a `SKILL.md` file produces a log line at WARN level containing `"skipping skill"`; the CLI does not crash |
| 10 | `/reload-skills` re-reads all registered skill directories | After a skill file is modified on disk and `/reload-skills` is invoked, subsequent `/skill <name>` returns the updated content |
| 11 | Collision logged at INFO when project skill shadows user/system skill | When a project skill and a user skill share the same `name`, the registry logs exactly one INFO-level message containing the shadowed name and the overriding path |

---

## Implementation Steps

### 1. New package: `@freed/skills`

**Package location:** `packages/skills/`

**Files:**
- `src/index.ts` — public exports
- `src/skill.ts` — `Skill` interface (name, description, content, scope, rootPath)
- `src/skill-loader.ts` — filesystem scanner + parser
- `src/skill-registry.ts` — in-memory skill store with scope priority

**Skill interface:**
```ts
interface Skill {
  name: string;          // from frontmatter
  description: string;   // from frontmatter
  content: string;       // body content (markdown)
  scope: 'system' | 'user' | 'project';
  rootPath: string;      // directory containing SKILL.md
}
```

### 2. Skill Loader (`skill-loader.ts`)

Uses `fast-glob` to scan directories. Each skill directory must contain `SKILL.md`.

**Scan logic:**
```ts
async function loadSkillsFromDir(dir: string, scope: Scope): Promise<Skill[]>
```

1. `fastGlob` → find all `**/SKILL.md` under `dir`
2. For each `SKILL.md`:
   - Read raw content
   - Parse YAML frontmatter with `gray-matter` (already a dep of `@freed/storage`)
   - Validate required frontmatter fields: `name`, `description`
   - Return `Skill` object with body content

### 3. Skill Registry (`skill-registry.ts`)

In-memory store with scope-priority merging.

```ts
class SkillRegistry {
  private byScope: Map<string, Skill[]> = new Map();

  register(scope: Scope, skills: Skill[]): void;
  reload(): void;                              // re-scan all registered root paths
  getAll(): Skill[];                           // all scopes, project priority
  getForProject(projectPath: string): Skill[];                          // system + user + project skills
  getForProject(projectPath: string, allowedSkills: string[]): Skill[]; // same, filtered to allowed list
  getByName(name: string): Skill | undefined; // first-match by priority
  listNames(): string[];                        // all registered skill names
}
```

**Priority for `getAll()` / `getForProject()`:** project → user → system (deduped by `name`).

**Collision logging:** When a project-scope skill shadows a user- or system-scope skill with the same `name`, the registry logs at INFO level: `"Skill '{name}' shadowed by project skill at {rootPath}"`. This provides visibility into which skills are overridden without blocking the override behavior.

**Reload contract:** `reload()` re-reads all root directories previously registered via `register()`. It does NOT auto-detect new *skill directories* added mid-session — a restart is required for newly added skill directories (but file changes within existing directories are captured by reload). The reload method is exposed via the slash command `/reload-skills`.

### 4. Integrate into `@freed/runtime`

**In `AgentRuntime` or `Orchestrator`:**

On agent startup (before task execution):
```ts
const projectPath = determineProjectRoot(cwd);
const skills = skillRegistry.getForProject(projectPath);
const skillContext = skills.map(s => s.content).join('\n\n---\n\n');
// → passed as context/system prompt to the agent
```

**New dependency:** `packages/runtime → packages/skills`

### 5. Slash Commands

In `packages/runtime/src/slash-commands.ts`, extend `createBuiltinCommands()`:

- `/skills` — list all loaded skills (name + description)
- `/skill <name>` — show full `SKILL.md` content for named skill
- `/reload-skills` — call `skillRegistry.reload()` and log the result

### 6. CLI Integration

**In `apps/cli/src/app.ts`:**

At startup (before agent runtime init):
```ts
await skillRegistry.register('system', loadSkillsFromDir('~/.freed/skills', 'system'));
await skillRegistry.register('user',   loadSkillsFromDir('~/.claude/skills', 'user'));
// Project skills loaded lazily when first project task runs
```

Project skills loaded lazily on first agent task per project, cached in `SkillRegistry`.

### 7. Tests

Unit, integration, E2E, and observability tests are detailed in the **Expanded Test Plan** section above. Summary:

**Unit tests (`packages/skills/src/__tests__/`):**
- `skill-loader.test.ts` — parsing valid/invalid SKILL.md, missing fields, size cap, empty dir
- `skill-registry.test.ts` — priority merging, dedup by name, `getForProject` overloads, `reload()`, shadowing log

**Integration tests (`packages/runtime/src/__tests__/`):**
- Skill context injection, slash commands, reload lifecycle, priority enforcement

**E2E tests (`apps/cli/`):**
- Multi-scope loading, shadowing visibility, size cap enforcement, invalid directory handling

---

## File Changes

| File | Change |
|------|--------|
| `packages/skills/src/index.ts` | **New** — package exports |
| `packages/skills/src/skill.ts` | **New** — `Skill` interface |
| `packages/skills/src/skill-loader.ts` | **New** — filesystem scanner + parser |
| `packages/skills/src/skill-registry.ts` | **New** — in-memory registry |
| `packages/skills/package.json` | **New** |
| `packages/skills/tsconfig.json` | **New** |
| `packages/skills/src/__tests__/skill-loader.test.ts` | **New** |
| `packages/skills/src/__tests__/skill-registry.test.ts` | **New** |
| `packages/runtime/src/agent-runtime.ts` | **Modify** — inject skill context on startup |
| `packages/runtime/src/slash-commands.ts` | **Modify** — add `/skills`, `/skill <name>`, and `/reload-skills` commands |
| `packages/runtime/package.json` | **Modify** — add `@freed/skills` dep |
| `apps/cli/src/app.ts` | **Modify** — load skills at startup |

---

## Dependencies

- `fast-glob` — filesystem scanning (`packages/skills`)
- `gray-matter` — YAML frontmatter parsing (already used by `@freed/storage`, already available)

No new runtime deps needed.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| User has no skills installed | Silently skip loading, log debug message |
| Corrupt SKILL.md | `gray-matter` throws → catch, log warning, skip skill |
| Very large skill files | Load lazily (on demand), not eagerly; any `SKILL.md` > 1 MB is skipped with a WARN log |
| Skill name collisions | Project > user > system priority, logged at INFO |
| Skill content is malicious | Skills are **context only**, not executed as code; approval engine not involved |
| Mid-session skill file changes not reflected | `reload()` method + `/reload-skills` slash command; new directories require restart |

---

## Alternatives Considered

### A. `fs.watch` for live invalidation vs. manual `reload()`

| | `fs.watch` | Manual `reload()` |
|--|--|--|
| **Pros** | Detects file changes without user action; always-current | Simple implementation; no native dependency; user controls when reload happens |
| **Cons** | Cross-platform `fs.watch` behavior varies (macOS fsevents vs. Linux inotify vs. Windows); watch handles must be kept alive; more complex lifecycle management | User must explicitly run `/reload-skills`; new directories missed |
| **Decision** | Rejected — complexity outweighs benefit. Manual `reload()` is explicit and debuggable. |
| **Revisit trigger** | If user feedback strongly requests live reload, add `fs.watch` as an opt-in feature. |

### B. Version-compatibility policy for skills

| | Define version policy now | Leave version unused (YAGNI) |
|--|--|--|
| **Pros** | Future-proof; enables graceful migration | Simpler; no dead code |
| **Cons** | No current consumer of version info; adds maintenance burden | If version semantics are needed later, interface changes |
| **Decision** | Leave `version` field parsed but unused. Document that no compatibility policy exists. Interface change deferred until a real consumer appears. |

### C. Per-agent skill filtering at registration time vs. at delivery time

| | Filter at registration (`allowedSkills` at `getForProject`) | Filter at delivery (agent startup checks) |
|--|--|--|
| **Pros** | Decoupled; registry stays dumb; future extensibility | Existing callers don't change; more flexible per-agent |
| **Cons** | Slightly more complex registry API | Filtering logic duplicated at each caller |
| **Decision** | `getForProject(projectPath, allowedSkills?)` overload on the registry. Both approaches supported; existing callers (no `allowedSkills` arg) get all skills. |

---

## Pre-Mortem: 3 Failure Scenarios

### Scenario 1: Skill files are deployed but agents ignore them
**Probability:** Medium — a missing `register()` call or wrong path would cause silent failure.
**Detection:** `/skills` returns empty when user has skills installed; agent logs show `"0 skills loaded for project"`.
**Mitigation:** AC-6 requires auto-load on agent start; AC-7 requires `/skills` to list all registered skills. Add a startup sanity check: if `~/.claude/skills/` exists and `listNames()` returns 0, log ERROR with instructions.
**Recovery:** Run `/reload-skills`; if still empty, verify skill directory structure matches `skill-name/SKILL.md`.

### Scenario 2: Memory growth from unbounded skill loading
**Probability:** Low-Medium — no size cap was specified, and users could copy large skill collections.
**Detection:** Process RSS grows over time across sessions; `gray-matter` parsing slows CLI startup.
**Mitigation:** Hard size cap: skip any `SKILL.md` file larger than 1 MB with a WARN log. Lazy-load skill content (metadata only in registry; body read on first access).
**Recovery:** Restart CLI; remove or trim large skill files.

### Scenario 3: Skill shadowing causes confusion in multi-agent workflows
**Probability:** Low — only occurs when project and user skills share the same name.
**Detection:** User expects their custom skill to apply, but project skill takes precedence silently.
**Mitigation:** AC-11 logs at INFO when shadowing occurs. Documentation clarifies priority order.
**Recovery:** Rename the project skill, or remove the user skill from `~/.claude/skills/` if project skill is unwanted.

---

## Expanded Test Plan

### Unit Tests (`packages/skills/src/__tests__/`)

**`skill-loader.test.ts`**
- `loadSkillsFromDir` on valid `skill-name/SKILL.md` → returns array with 1 `Skill` matching frontmatter + body
- `loadSkillsFromDir` on directory with no `SKILL.md` → returns `[]`
- `loadSkillsFromDir` on `SKILL.md` with missing `name` frontmatter → throws `Error` with message containing `"name"`
- `loadSkillsFromDir` on `SKILL.md` with missing `description` frontmatter → throws `Error`
- `loadSkillsFromDir` on corrupt YAML (gray-matter parse failure) → throws
- `loadSkillsFromDir` on nested directory structure → finds skills at any depth
- `SKILL.md` larger than 1 MB → skipped with WARN log, not included in returned array
- Empty directory → returns `[]`

**`skill-registry.test.ts`**
- `register(scope, skills)` then `listNames()` → returns all skill names
- `register` multiple scopes, `getAll()` → deduplicated by `name`, project wins over user/system
- `getByName` with collision across scopes → returns project-scope skill
- `getForProject(projectPath)` → returns system + user + project skills
- `getForProject(projectPath, ['skill-a', 'skill-b'])` → returns only skills in allowed list (project version if duplicate)
- `reload()` after `register()` → re-scans and updates in-memory store
- Shadowing: project skill shadows user skill of same name → registry logs INFO containing shadowed name (mock `console.info`)
- `getForProject` with no project skills registered → returns system + user skills without error

### Integration Tests (`packages/runtime/src/__tests__/`)

- **Skill context injection:** When `AgentRuntime` starts in a project with `.claude/skills/`, the agent context object contains a non-empty `skills` key with string content
- **Slash commands:** `/skills` returns a list matching `skillRegistry.listNames()`; `/skill unknown-skill` returns a 404-like error response
- **Reload lifecycle:** Modify a `SKILL.md` on disk → call `/reload-skills` → `/skill <name>` returns updated content
- **Priority enforcement:** Register same skill name in user and project scopes → `skillRegistry.getByName(name).scope === 'project'`

### E2E Tests (`apps/cli/`)

- Fresh `~/.freed/skills/demo/SKILL.md` + `~/.claude/skills/other/SKILL.md` → run CLI → `/skills` shows both `demo` and `other`
- Project with `.claude/skills/project-skill/SKILL.md` where name conflicts with user skill → agent logs show INFO shadowing message
- Large skill file (>1 MB) under skills directory → CLI startup logs WARN about skip; does not crash
- Invalid skill directory (no `SKILL.md`) → CLI startup logs WARN about skip; does not crash
- Unknown skill requested via `/skill` → returns clear error message, not a crash
- Skills loaded for a project with no `~/.claude/skills/` → CLI starts without error; `/skills` lists system + user skills

### Observability

- **Startup logging:** On CLI startup, log at INFO: `"Loaded N skills (system: X, user: Y, project: Z)"` or `"No skills found"` if all roots empty
- **Reload logging:** On `/reload-skills`, log at INFO: `"Reloading skills from N roots"` then `"Reloaded M skills"`
- **Shadowing logging:** On `getForProject()` or `getAll()`, when a project skill shadows a user/system skill, log exactly once at INFO: `"Skill '{name}' shadowed by project skill at {rootPath}"`
- **Error logging:** On parse failure or missing frontmatter, log at WARN: `"Skipping skill at {path}: {reason}"`
- **Size cap logging:** On a `SKILL.md` exceeding 1 MB, log at WARN: `"Skipping skill '{name}': file size {bytes} exceeds 1 MB limit"`
- **Metrics to emit (if observability pipeline present):** `skills.loaded.total` (counter), `skills.loaded.by_scope` (gauge per scope), `skills.errors.total` (counter by error type), `skills.shadow.count` (counter)

---

## Verification Steps

1. Create `~/.freed/skills/demo/SKILL.md` and `~/projects/myproj/.claude/skills/myskill/SKILL.md`
2. Run Freed CLI in `~/projects/myproj`
3. Confirm `/skills` lists both skills
4. Confirm `/skill demo` shows correct content
5. Confirm project skill takes priority over user skill with same name
6. Run in a project with no `.claude/skills/` — should work without error
7. Run `vitest` — all tests pass
