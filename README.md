# GitClean CLI

> A beautiful CLI tool for creating clean, conventional git commits with real-time spell checking and seamless git workflow automation

[![npm version](https://badge.fury.io/js/gitcleancommit.svg)](https://badge.fury.io/js/gitcleancommit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

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
    "body": true,        // Enable detailed description
    "breaking": true,    // Enable breaking changes prompt
    "issues": true       // Enable issue references (fixes #123)
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

### Features

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

---

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/gitCleanCommit.git`
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
