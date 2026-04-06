# Slash Commands

Freed provides built-in slash commands for common operations. Commands are invoked by typing `/` followed by the command name.

## Available Commands

### Session Commands

| Command | Description |
|---------|-------------|
| `/quit` | Exit the session cleanly |
| `/exit` | Exit the session cleanly (alias for `/quit`) |
| `/clear` | Clear the current session context |
| `/help` | Show available commands |

### Development Commands

| Command | Description |
|---------|-------------|
| `/review` | Review the current git diff |
| `/bug` | Analyze a bug based on recent logs and changes |
| `/agents` | Switch agent (usage: `/agents <agent-id>`) |

### Tool Commands

| Command | Description |
|---------|-------------|
| `/tools` | List available tools for the current agent |
| `/memory` | Show current memory context |

### Skill Commands

| Command | Description |
|---------|-------------|
| `/skills` | List all available skills |
| `/skill <name>` | Get skill content by name |
| `/reload-skills` | Reload all skills from disk |

## Usage Examples

```bash
# Exit the session
/quit

# Clear context and start fresh
/clear

# Review changes
/review

# List all skills
/skills

# Get a specific skill
/skill my-skill

# Switch to a different agent
/agents reviewer
```

## Custom Commands

Additional commands can be registered through the skill system. See the [skills documentation](./skills.md) for more information.
