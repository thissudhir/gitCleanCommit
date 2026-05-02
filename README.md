# GitClean

![Image](https://github-production-user-asset-6210df.s3.amazonaws.com/78488663/529356867-85c1dbf3-2d32-475c-bb1b-db30971d50c8.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20260502%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260502T175024Z&X-Amz-Expires=300&X-Amz-Signature=aece5f432a4e5682db19cb7dfdec954d2ecf5f998f76558eff7cd6a9e6594bed&X-Amz-SignedHeaders=host&response-content-type=image%2Fpng)

> A beautiful CLI tool for creating clean, conventional git commits with real-time spell checking, AI-powered message generation, and seamless git workflow automation

[![npm version](https://badge.fury.io/js/gitcleancommit.svg)](https://badge.fury.io/js/gitcleancommit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

## Demo

![Image](https://github-production-user-asset-6210df.s3.amazonaws.com/78488663/529343274-84fcd915-cdb4-40b2-b54d-17f99e831511.gif?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20260502%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260502T175206Z&X-Amz-Expires=300&X-Amz-Signature=f4a9d800069f6bd14a610c458227ab1f6ff4ac80d8996b047b45403477f91dff&X-Amz-SignedHeaders=host&response-content-type=image%2Fgif)

## Quick Start

### Installation

```bash
# Install globally (recommended)
npm install -g gitcleancommit

# Or use with npx (no installation)
npx gitcleancommit
```

### Basic Usage

```bash
# Create a commit (streamlined 3-step workflow)
gitclean

# Initialize global configuration (applies to all projects)
gitclean config init --global

# Initialize project-specific configuration (overrides global)
gitclean config init

# View current configuration
gitclean config show
```

That's it! GitClean will guide you through creating a clean, conventional commit.

---

## Features

- **Streamlined Workflow**: Default 3-step commit process (type, scope, message)
- **AI-Powered Generation**: Generate commit messages with Gemini, Claude, GPT, Groq, Ollama, or any OpenAI-compatible model
- **Complete Git Workflow**: Single command to stage, commit, and push changes
- **Configurable Prompts**: Enable/disable fields via config (body, breaking changes, issues)
- **Real-time Spell Checking**: Live spell checking as you type with visual feedback
- **Configurable Commit Types**: Customize commit types via `.gitclean.config.json`
- **Conventional Commits**: Enforces conventional commit standards
- **Beautiful Terminal UI**: Colorful interface with boxes, spinners, and progress indicators
- **Git Hook Integration**: Seamless integration with git's prepare-commit-msg hook
- **Smart Defaults**: Works out of the box with zero configuration

---

## Default Workflow

By default, GitClean shows only **3 essential prompts** for a fast workflow:

1. **Commit type** - Select from ADD, FIX, UPDATE, DOCS, TEST, REMOVE
2. **Scope** (optional) - e.g., "auth", "api", "ui"
3. **Commit message** - Short description of your changes

### Example

```bash
$ gitclean

? Select the type of change you're committing: ADD
? What is the scope of this change? (optional): auth
? Write a short, commit message: implement JWT token validation

✔ Files added: .
✔ Commit created successfully!
✔ Pushed to main successfully!
```

Result: `ADD(auth): implement JWT token validation`

---

## Configuration

### Global vs Project-Specific Config

GitClean supports two levels of configuration:

1. **Global Config** (`~/.gitclean.config.json`) - Applies to all projects
2. **Project Config** (`.gitclean.config.json`) - Overrides global settings for specific projects

```bash
# Create global config (recommended for personal defaults)
gitclean config init --global

# Create project-specific config (overrides global)
gitclean config init
```

**Config Hierarchy**: Project → Global → Defaults

> When the project config uses a different AI provider than the global config, provider-specific fields (`apiKey`, `model`, `baseURL`) from the global config are **not** inherited — they belong to a different provider and would cause errors.

### Enable Additional Prompts

Want more fields? Create a config file:

```bash
gitclean config init --global  # or without --global for project-only
```

Then edit the config file:

```bash
# Edit global config
nano ~/.gitclean.config.json

# Or edit project-specific config
nano .gitclean.config.json
```

Example configuration:

```json
{
  "prompts": {
    "scope": true,
    "body": true, // Enable detailed description
    "breaking": true, // Enable breaking changes prompt
    "issues": true // Enable issue references (fixes #123)
  }
}
```

### Customize Commit Types

```json
{
  "commitTypes": [
    {
      "name": "FEATURE",
      "value": "FEATURE",
      "color": "magenta",
      "description": "Add a new feature"
    },
    {
      "name": "HOTFIX",
      "value": "HOTFIX",
      "color": "redBright",
      "description": "Critical production fix"
    }
  ]
}
```

**Available colors**: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`, `redBright`, `greenBright`, `yellowBright`, `blueBright`, `magentaBright`, `cyanBright`, `whiteBright`

---

## Commands

### `gitclean` (default)

The main command that runs the complete git workflow:

```bash
gitclean
```

1. Shows the GitClean banner
2. Checks for uncommitted changes
3. Guides you through creating a conventional commit
4. Stages all changes (`git add .`)
5. Creates the commit
6. Pushes to the current branch

### `gitclean config init`

Initialize a configuration file with default settings:

```bash
# Create global config (applies to all projects)
gitclean config init --global

# Create project-specific config (current directory only)
gitclean config init
```

**Options:**

- `-g, --global`: Create config in home directory (`~/.gitclean.config.json`)
- Without flag: Create config in current directory (`.gitclean.config.json`)

### `gitclean ai`

Let AI read your diff and generate a conventional commit message. Supports every major provider — cloud or local.

```bash
gitclean ai
```

**Workflow:**

1. AI reads your staged changes and generates a commit message
2. The message is shown in a box
3. You choose what to do next

```text
? What would you like to do?
❯ ✔  Commit with this message
  ✎  Edit the message
  ↺  Regenerate
  ✖  Cancel
```

- **Commit** — stages all changes, commits, and pushes
- **Edit** — tweak the message inline, then commit
- **Regenerate** — ask the AI for a new message
- **Cancel** — exit without committing

---

## AI Setup

### Supported Providers

| Provider      | Models                                                                       | Needs API Key                                                  |
| ------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Gemini**    | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`                     | Yes — [aistudio.google.com](https://aistudio.google.com)       |
| **OpenAI**    | `gpt-4o-mini`, `gpt-4o`, `o1-mini`                                           | Yes — [platform.openai.com](https://platform.openai.com)       |
| **Anthropic** | `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`, `claude-opus-4-5` | Yes — [console.anthropic.com](https://console.anthropic.com)   |
| **Groq**      | `llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`      | Yes (free tier) — [console.groq.com](https://console.groq.com) |
| **Ollama**    | `llama3.2`, `codellama`, `mistral`, `qwen2.5-coder`, any local model         | No                                                             |
| **DeepSeek**  | `deepseek-chat`, `deepseek-reasoner`                                         | Yes — [platform.deepseek.com](https://platform.deepseek.com)   |
| **Custom**    | Any model                                                                    | Depends on provider                                            |

> **Open-source / local models**: Ollama, LM Studio, Jan, vLLM, and any other server that exposes an OpenAI-compatible `/v1` endpoint all work via `provider: "custom"` or `provider: "ollama"`.

---

### Option 1 — Interactive setup (recommended)

Run the guided setup — it asks you to pick a provider, model, and where to store your key:

```bash
# Save to project config (.gitclean.config.json)
gitclean config ai

# Save to global config (~/.gitclean.config.json — shared across all projects)
gitclean config ai --global
```

You'll be prompted to:

1. Pick a provider (Gemini, OpenAI, Anthropic, Groq, Ollama, DeepSeek, Custom)
2. Enter or confirm the model name
3. Choose how to store your API key — in the config file or as an env var

> If you choose to save the API key in the config file, add `.gitclean.config.json` to your `.gitignore` — or use `--global` to keep it in your home directory and out of the repo entirely.

---

### Option 2 — Manual config file

Run `gitclean config init` and add an `ai` block:

#### Gemini (default)

```json
{
  "ai": {
    "provider": "gemini",
    "model": "gemini-1.5-flash",
    "apiKey": "your_key_here"
  }
}
```

#### OpenAI / GPT

```json
{
  "ai": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "apiKey": "your_key_here"
  }
}
```

#### Anthropic / Claude

```json
{
  "ai": {
    "provider": "anthropic",
    "model": "claude-3-5-haiku-20241022",
    "apiKey": "your_key_here"
  }
}
```

#### Groq (fast + free tier)

```json
{
  "ai": {
    "provider": "groq",
    "model": "llama-3.1-8b-instant",
    "apiKey": "your_key_here"
  }
}
```

#### Ollama (local, no API key needed)

Make sure Ollama is running first: `ollama serve`

```json
{
  "ai": {
    "provider": "ollama",
    "model": "llama3.2"
  }
}
```

#### DeepSeek

```json
{
  "ai": {
    "provider": "deepseek",
    "model": "deepseek-chat",
    "apiKey": "your_key_here"
  }
}
```

#### Custom / Self-hosted (LM Studio, vLLM, Jan, Together AI, etc.)

```json
{
  "ai": {
    "provider": "custom",
    "baseURL": "http://localhost:1234/v1",
    "model": "your-model-name",
    "apiKey": "not-needed"
  }
}
```

---

### Option 3 — Environment variables (one-off / CI)

```bash
# Set provider + key inline
GROQ_API_KEY=your_key GITCLEAN_AI_PROVIDER=groq gitclean ai

# Override model too
GROQ_API_KEY=your_key GITCLEAN_AI_PROVIDER=groq GITCLEAN_AI_MODEL=llama-3.3-70b-versatile gitclean ai
```

Supported env vars:

| Variable               | Used for                         |
| ---------------------- | -------------------------------- |
| `GEMINI_API_KEY`       | Gemini                           |
| `OPENAI_API_KEY`       | OpenAI                           |
| `ANTHROPIC_API_KEY`    | Anthropic / Claude               |
| `GROQ_API_KEY`         | Groq                             |
| `DEEPSEEK_API_KEY`     | DeepSeek                         |
| `AI_API_KEY`           | Any custom provider              |
| `GITCLEAN_AI_PROVIDER` | Override the configured provider |
| `GITCLEAN_AI_MODEL`    | Override the configured model    |

---

### `gitclean config ai`

Interactively configure your AI provider, model, and API key:

```bash
# Project config (current directory)
gitclean config ai

# Global config (applies to all projects)
gitclean config ai --global
```

Walks you through selecting a provider, model, and where to store your API key. At the end it shows the env var name to set if you prefer not to store the key in the file.

### `gitclean config show`

Display your current configuration:

```bash
gitclean config show
```

### `gitclean setup` / `gitclean install`

Install GitClean as a git hook:

```bash
gitclean setup
```

This creates a `prepare-commit-msg` hook that automatically runs GitClean when you use `git commit`.

### `gitclean uninstall` / `gitclean remove`

Remove GitClean git hooks:

```bash
gitclean uninstall
```

### `gitclean status` / `gitclean s`

Display the current git status:

```bash
gitclean status
```

### `gitclean spellcheck` / `gitclean spell`

Test the spell checker with custom text:

```bash
# Basic spell check
gitclean spellcheck "your text here"

# Verbose mode - shows dictionary stats
gitclean spellcheck "your text" --verbose
```

### `gitclean test`

Run the built-in spell checker test suite:

```bash
gitclean test
```

### `gitclean --version` / `gitclean -v`

Show the current version:

```bash
gitclean --version
```

---

## Commit Types

GitClean supports six default conventional commit types:

| Type     | Color      | Description                      | Example                               |
| -------- | ---------- | -------------------------------- | ------------------------------------- |
| `ADD`    | Green      | Add new code, features, or files | `ADD: user authentication module`     |
| `FIX`    | Red        | Fix bugs or issues               | `FIX: resolve memory leak in parser`  |
| `UPDATE` | Yellow     | Update existing code or features | `UPDATE: improve error handling`      |
| `DOCS`   | Blue       | Documentation changes only       | `DOCS: add API usage examples`        |
| `TEST`   | Cyan       | Add or update tests              | `TEST: add unit tests for validators` |
| `REMOVE` | Bright Red | Remove code, files, or features  | `REMOVE: deprecated API endpoints`    |

---

## Real-time Spell Checking

GitClean features an advanced spell checker specifically optimized for development:

### Spell Check Features

- **Live Feedback**: See misspellings highlighted in red as you type
- **Smart Dictionary**: Recognizes 200+ technical terms and programming keywords
- **Common Typo Detection**: Automatically catches and suggests fixes for common developer typos
- **Visual Indicators**: Misspelled words are underlined in red during input

### Technical Dictionary

The spell checker recognizes common development terms including:

- Programming languages: `javascript`, `typescript`, `python`, `java`, etc.
- Frameworks: `react`, `vue`, `angular`, `nodejs`, `webpack`, etc.
- Git terms: `commit`, `merge`, `rebase`, `checkout`, etc.
- DevOps: `docker`, `kubernetes`, `ci/cd`, `aws`, `azure`, etc.
- Web terms: `api`, `http`, `cors`, `jwt`, `oauth`, etc.

---

## Advanced Configuration

### Streamlined Workflow (Default)

```json
{
  "prompts": {
    "scope": true,
    "body": false,
    "breaking": false,
    "issues": false
  }
}
```

**Result**: Only 3 prompts (type, scope, message)

### Full Workflow

```json
{
  "prompts": {
    "scope": true,
    "body": true,
    "breaking": true,
    "issues": true
  }
}
```

**Result**: All 6 prompts shown

### Ultra-Minimal

```json
{
  "prompts": {
    "scope": false,
    "body": false,
    "breaking": false,
    "issues": false
  }
}
```

**Result**: Only 2 prompts (type, message) - fastest workflow!

### Configuration Options

The configuration file supports:

- **commitTypes**: Array of custom commit types
  - `name`: Display name
  - `value`: Value used in commit message
  - `color`: Terminal color
  - `description`: Description shown in prompt

- **spellCheck**: Spell checker settings
  - `enabled`: Enable/disable spell checking (default: `true`)
  - `debounceMs`: Delay before spell check runs (default: `150`ms)

- **prompts**: Control which prompts are shown during commit creation
  - `scope`: Show scope prompt (default: `true`)
  - `body`: Show body/description prompt (default: `false`)
  - `breaking`: Show breaking changes prompt (default: `false`)
  - `issues`: Show issue references prompt (default: `false`)

- **ai**: AI-powered commit message settings
  - `provider`: AI provider — `"gemini"`, `"openai"`, `"anthropic"`, `"groq"`, `"ollama"`, `"deepseek"`, or `"custom"`
  - `model`: Model name for the selected provider (e.g., `"gemini-1.5-flash"`, `"gpt-4o-mini"`, `"llama-3.1-8b-instant"`)
  - `apiKey`: Your API key — omit this field and use a provider-specific env var instead if you don't want the key in the file
  - `baseURL`: Custom endpoint URL — required for `"custom"` provider (LM Studio, vLLM, Jan, etc.)

  > `model`, `apiKey`, and `baseURL` are provider-specific. When you switch `provider`, these fields do not carry over from a previous provider's config — either in the same file or a global config.

---

## Requirements

- **Node.js**: Version 18.0.0 or higher
- **Git**: Must be installed and configured
- **Terminal**: Supports color output and Unicode

---

## Troubleshooting

### "Not in a git repository"

```bash
git init
```

### "No changes to commit"

```bash
gitclean status
# or
git status
```

### "Push failed"

```bash
# Add a remote repository
git remote add origin https://github.com/username/repo.git

# Check current remotes
git remote -v
```

### "Command not found: gitclean"

```bash
# Reinstall globally
npm install -g gitcleancommit

# Or use npx
npx gitcleancommit
```

### "Missing API key for groq" (or any provider)

API keys are resolved in this order:

1. `apiKey` field in your config file (`.gitclean.config.json` or `~/.gitclean.config.json`)
2. Provider-specific environment variable (`GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.)

If you switched providers via `gitclean config ai`, the old provider's key is automatically cleared from the config — make sure the new provider's env var is set if you chose "env var" during setup.

Quick fix for any provider:

```bash
# Reconfigure interactively — picks the right env var name for you
gitclean config ai
```

### AI generates a badly formatted message

Use the **Edit** option in the action menu to fix the message inline, or **Regenerate** to ask the AI for another attempt.

---

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Clone your fork: `git clone https://github.com/thissudhir/gitCleanCommit.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes
6. Build the project: `npm run build`
7. Test your changes: `npm start`
8. Commit using GitClean: `npm start`
9. Push to your fork: `git push origin feature/amazing-feature`
10. Create a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Conventional Commits](https://www.conventionalcommits.org/) specification
- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI parsing
- Uses [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/) for interactive prompts
- Spell checking powered by [Typo.js](https://github.com/cfinke/Typo.js)
- Beautiful terminal output with [Chalk](https://github.com/chalk/chalk) and [Boxen](https://github.com/sindresorhus/boxen)

## Support

- [Report bugs](https://github.com/thissudhir/gitCleanCommit/issues)
- [Request features](https://github.com/thissudhir/gitCleanCommit/issues)
- [Documentation](https://github.com/thissudhir/gitCleanCommit#readme)
- [Star on GitHub](https://github.com/thissudhir/gitCleanCommit)

---

**Made with ❤️ by [Abhishek](https://github.com/thissudhir)**

_Happy committing! May your git history always be clean and meaningful._
