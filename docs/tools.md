# Tools

Freed provides built-in tools for file operations, search, web access, and more.

## Available Tools

### File Operations

#### `read_file` — Read File
Read the contents of a file.

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Absolute or relative path to the file |
| `offset` | number | Lines to skip before reading (default: 0) |
| `limit` | number | Maximum lines to read |
| `-n` | boolean | Show line numbers in output |

**Example:**
```json
{ "path": "src/index.ts", "offset": 0, "limit": 50, "-n": true }
```

---

#### `write_file` — Write File
Write content to a file, creating it if it does not exist.

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Absolute or relative path to write |
| `content` | string | Content to write |

**Example:**
```json
{ "path": "output.txt", "content": "Hello, world!" }
```

---

#### `file_edit` — Edit File
Edit a file by replacing a specific string with new content.

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_path` | string | Path to the file to edit |
| `old_string` | string | Exact string to find and replace |
| `new_string` | string | Replacement string |
| `replace_all` | boolean | Replace all occurrences (default: false) |

**Example:**
```json
{ "file_path": "src/index.ts", "old_string": "foo", "new_string": "bar" }
```

---

#### `list_dir` — List Directory
List files and subdirectories in a directory.

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Directory path |

**Example:**
```json
{ "path": "src" }
```

---

### Search

#### `grep` — Search File Contents
Search file contents using regex.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pattern` | string | Regular expression pattern |
| `path` | string | File or directory to search (default: current directory) |
| `output_mode` | string | `"files_with_matches"` (default), `"content"`, `"count"` |
| `-n` | boolean | Show line numbers (requires `output_mode: "content"`) |
| `-i` | boolean | Case insensitive search |
| `-C` | number | Lines of context before and after match |
| `head_limit` | number | Limit number of results |

**Example:**
```json
{ "pattern": "TODO", "path": "src", "output_mode": "content", "-n": true }
```

---

#### `glob` — Find Files
Find files matching a glob pattern.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pattern` | string | Glob pattern (e.g., `"**/*.ts"`) |
| `path` | string | Directory to search in (default: current directory) |

**Example:**
```json
{ "pattern": "**/*.test.ts", "path": "src" }
```

---

### Shell

#### `shell` — Execute Shell Command
Execute a shell command.

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | string | Shell command to execute |
| `timeout` | number | Timeout in milliseconds (default: 30000) |

**Example:**
```json
{ "command": "ls -la", "timeout": 10000 }
```

---

### Git

#### `git_status` — Git Status
Show the working tree status.

**Example:**
```json
{}
```

---

#### `git_diff` — Git Diff
Show changes between commits, working tree, etc.

| Parameter | Type | Description |
|-----------|------|-------------|
| `ref` | string | Optional Git ref to diff against |

**Example:**
```json
{ "ref": "HEAD~1" }
```

---

#### `git_log` — Git Log
Show commit logs.

| Parameter | Type | Description |
|-----------|------|-------------|
| `maxCount` | number | Maximum number of commits to show |

**Example:**
```json
{ "maxCount": 10 }
```

---

### Web

#### `web_fetch` — Fetch URL
Fetch content from a URL.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | URL to fetch |
| `prompt` | string | Optional prompt describing what to extract |

**Example:**
```json
{ "url": "https://example.com", "prompt": "Extract the main heading" }
```

---

### User Interaction

#### `ask_user_question` — Ask User
Ask the user a question and return the selected option(s).

| Parameter | Type | Description |
|-----------|------|-------------|
| `questions` | array | Array of question objects |

**Question object:**

| Field | Type | Description |
|-------|------|-------------|
| `question` | string | The question text |
| `header` | string | Short label (max 12 characters) |
| `options` | array | Available options |
| `multiSelect` | boolean | Allow multiple selections (default: false) |

**Example:**
```json
{
  "questions": [{
    "question": "Which approach should we take?",
    "header": "Approach",
    "options": [
      { "label": "Option A", "description": "Fast but risky" },
      { "label": "Option B", "description": "Slower but safer" }
    ],
    "multiSelect": false
  }]
}
```

---

## Risk Levels

| Level | Description |
|-------|-------------|
| `safe` | No modifications, read-only operations |
| `ask` | Requires confirmation before execution |
| `high` | Potentially destructive or security-sensitive |

## Tool Response Format

All tools return a consistent response format:

```typescript
{
  success: boolean;
  output: string;  // Result data on success
  error?: string;  // Error message on failure
}
```
