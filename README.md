# GitClean CLI

> A beautiful CLI tool for creating clean, conventional git commits with real-time spell checking and seamless git workflow automation

[![npm version](https://badge.fury.io/js/gitcleancommit.svg)](https://badge.fury.io/js/gitcleancommit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

## Features

- **Complete Git Workflow**: Single command to stage, commit, and push changes
- **Interactive Commit Builder**: Guided prompts for creating well-structured commits
- **Real-time Spell Checking**: Live spell checking as you type with visual feedback
- **Configurable Commit Types**: Customize commit types via `.gitclean.config.json`
- **Conventional Commits**: Enforces conventional commit standards
- **Beautiful Terminal UI**: Colorful interface with boxes, spinners, and progress indicators
- **Git Hook Integration**: Seamless integration with git's prepare-commit-msg hook
- **Smart Defaults**: Works out of the box with zero configuration
- **Built-in Testing Tools**: Test spell checker and see how it works

## Quick Start

### Installation

```bash
# Install globally (recommended)
npm install -g gitcleancommit

# Or use with npx (no installation)
npx gitcleancommit

# Or install as a dev dependency
npm install --save-dev gitcleancommit
```

### Basic Usage

```bash
# Run the complete workflow (add → commit → push)
gitclean

# That's it! GitClean will handle everything else
```

## Commands

### `gitclean` (default)

The main command that runs the complete git workflow:

1. Shows the GitClean banner
2. Checks for uncommitted changes
3. Guides you through creating a conventional commit
4. Stages all changes (`git add .`)
5. Creates the commit
6. Pushes to the current branch

```bash
gitclean
```

### `gitclean commit`

Create a commit without the full workflow (no automatic staging or pushing):

```bash
gitclean commit

# Hook mode (used internally by git hooks)
gitclean commit --hook <commit-msg-file>
```

### `gitclean setup` / `gitclean install`

Install GitClean as a git hook in your repository:

```bash
gitclean setup
# or
gitclean install
```

This creates a `prepare-commit-msg` hook that automatically runs GitClean when you use `git commit`.

### `gitclean uninstall` / `gitclean remove`

Remove GitClean git hooks from your repository:

```bash
gitclean uninstall
# or
gitclean remove
```

### `gitclean status` / `gitclean s`

Display the current git status:

```bash
gitclean status
# or
gitclean s
```

### `gitclean spellcheck` / `gitclean spell`

Test the spell checker with custom text:

```bash
# Basic spell check
gitclean spellcheck "your text here"

# Verbose mode - shows dictionary stats
gitclean spellcheck "your text" --verbose
gitclean spellcheck "your text" -vr
```

### `gitclean test`

Run the built-in spell checker test suite with common development terms:

```bash
gitclean test
```

### `gitclean --version` / `gitclean -v`

Show the current version:

```bash
gitclean --version
# or
gitclean -v
```

### `gitclean config init`

Initialize a configuration file with default settings:

```bash
gitclean config init
```

This creates a `.gitclean.config.json` file in your current directory where you can customize:

- Commit types (add, remove, or modify)
- Commit type colors
- Spell checker settings

### `gitclean config show`

Display your current configuration:

```bash
gitclean config show
```

## Commit Types

GitClean supports six default conventional commit types, each with its own color:

| Type     | Color      | Description                      | Example                               |
| -------- | ---------- | -------------------------------- | ------------------------------------- |
| `ADD`    | Green      | Add new code, features, or files | `ADD: user authentication module`     |
| `FIX`    | Red        | Fix bugs or issues               | `FIX: resolve memory leak in parser`  |
| `UPDATE` | Yellow     | Update existing code or features | `UPDATE: improve error handling`      |
| `DOCS`   | Blue       | Documentation changes only       | `DOCS: add API usage examples`        |
| `TEST`   | Cyan       | Add or update tests              | `TEST: add unit tests for validators` |
| `REMOVE` | Bright Red | Remove code, files, or features  | `REMOVE: deprecated API endpoints`    |

### Customizing Commit Types

You can customize commit types to match your team's workflow:

1. **Initialize config file**:

   ```bash
   gitclean config init
   ```

2. **Edit `.gitclean.config.json`**:

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

3. **Available colors**: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`, `redBright`, `greenBright`, `yellowBright`, `blueBright`, `magentaBright`, `cyanBright`, `whiteBright`

4. **View your config**:

   ```bash
   gitclean config show
   ```

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
- And 150+ more technical terms!

### Common Typo Corrections

Automatically detects and corrects common programming typos:

- `fucntion` → `function`
- `recieve` → `receive`
- `occured` → `occurred`
- `seperate` → `separate`
- `componnet` → `component`
- `databse` → `database`
- And 100+ more patterns!

## Usage Examples

### Basic Commit Workflow

```bash
$ gitclean

  GitClean Banner (ASCII Art)
  Clean, conventional commits made easy

Found changes to commit
This will: git add . → git commit → git push

Real-time spell checking enabled for text inputs!

? Select the type of change you're committing: (Use arrow keys)
❯ ADD          - Add new code or files
  FIX          - A bug fix
  UPDATE       - Updated a file or code
  DOCS         - Documentation changes
  TEST         - Adding tests
  REMOVE       - Removing code or files
```

### Commit with Scope

Add a scope to categorize your commits:

```bash
? What is the scope of this change? (optional): auth
? Write a short, imperative tense description: implement JWT token validation

# Results in: ADD(auth): implement JWT token validation
```

### Breaking Changes

Mark commits that introduce breaking changes:

```bash
? Are there any breaking changes? Yes

# Adds "BREAKING CHANGE:" to the commit body
# Results in: ADD(auth)!: new authentication system
```

### Issue References

Link commits to issues:

```bash
? Add issue references: fixes #123, closes #456

# Adds issue references to the commit body
```

### Complete Example

```bash
$ gitclean

# After answering all prompts:

┌─ Final Commit Message ──────────────────────────────────┐
│ ADD(auth): implement JWT token validation               │
│                                                         │
│ Added secure token validation with refresh capability   │
│                                                         │
│ BREAKING CHANGE: implement JWT token validation         │
│                                                         │
│ fixes #123, closes #456                                 │
└─────────────────────────────────────────────────────────┘

? Ready to commit? Yes

Starting GitClean workflow...

✔ Files added: .
✔ Commit created successfully!
✔ Pushed to main successfully!

GitClean workflow completed successfully!
Changes pushed to main
```

## Testing the Spell Checker

### Interactive Testing

Test the spell checker with your own text:

```bash
$ gitclean spellcheck "Fix fucntion that handls user authetication"

Checking spelling...

┌─ Spell Check Results ───────────────────────────────────┐
│ Spelling issues found:                                  │
│                                                         │
│ Original: Fix fucntion that handls user authetication   │
│ Corrected: Fix function that handles user authentication│
│                                                         │
│ Issues found:                                           │
│ • fucntion → function                                  │
│ • handls → handles                                     │
│ • authetication → authentication                       │
└─────────────────────────────────────────────────────────┘
```

### Verbose Mode

See detailed spell checker statistics:

```bash
$ gitclean spellcheck --verbose

┌─ Spell Checker Status ──────────────────────────────────┐
│ Spell Checker Information                               │
│                                                         │
│ Initialized: Yes                                        │
│ Dictionary: Loaded                                      │
│ Technical words: 200+                                   │
│ Typo correction rules: 100+                             │
│                                                         │
│ This spell checker is optimized for:                    │
│ • Git commit messages                                   │
│ • Programming terminology                               │
│ • Common development terms                              │
│ • Technical abbreviations                               │
└─────────────────────────────────────────────────────────┘
```

### Run Test Suite

Run the built-in test suite:

```bash
$ gitclean test

┌─ Spell Checker Test Suite ──────────────────────────────┐
│ Running Spell Checker Tests                             │
│                                                         │
│ Testing with common development-related text...         │
└─────────────────────────────────────────────────────────┘

1. Testing: "Fix typo in fucntion name"
   Found 1 issue(s)
   Corrected: "Fix typo in function name"

2. Testing: "Add new componnet for user managment"
   Found 2 issue(s)
   Corrected: "Add new component for user management"

# ... more test cases ...

┌─ Test Results ──────────────────────────────────────────┐
│ Test completed!                                         │
│                                                         │
│ Dictionary status: Active                               │
│ Total technical terms: 200+                             │
│ Total typo rules: 100+                                  │
└─────────────────────────────────────────────────────────┘
```

## Git Hook Integration

### Automatic Setup

Install GitClean as a git hook to use it with standard git commands:

```bash
# Install the hook
gitclean setup

# Now use git commit as usual
git add .
git commit  # GitClean will automatically run!
```

### Manual Removal

Remove the git hook if needed:

```bash
gitclean uninstall
```

### How It Works

The git hook integration:

1. Creates a `prepare-commit-msg` hook in `.git/hooks/`
2. Runs GitClean automatically when you use `git commit`
3. Only activates for empty commit messages
4. Doesn't interfere with merge commits or rebases

## Configuration

GitClean works with zero configuration! However, you can customize it to match your workflow.

### Creating a Configuration File

To customize commit types and other settings, create a `.gitclean.config.json` file:

```bash
gitclean config init
```

This creates a configuration file in your project root. See the [Customizing Commit Types](#customizing-commit-types) section above for examples and available options.

### Configuration Options

The configuration file supports:

- **commitTypes**: Array of custom commit types (see [Customizing Commit Types](#customizing-commit-types))
  - `name`: Display name
  - `value`: Value used in commit message
  - `color`: Terminal color
  - `description`: Description shown in prompt

- **spellCheck**: Spell checker settings
  - `enabled`: Enable/disable spell checking (default: `true`)
  - `debounceMs`: Delay before spell check runs (default: `150`ms)

### Default Behaviors

- **File Staging**: By default runs `git add .` (all files)
- **Push Target**: Pushes to the current branch on `origin`
- **Spell Check**: Enabled by default for all text inputs
- **Commit Format**: Follows conventional commit standards

### Requirements

- **Node.js**: Version 18.0.0 or higher
- **Git**: Must be installed and configured
- **Terminal**: Supports color output and Unicode

## Advanced Features

### Escape Key Handling

Press `ESC` at any time during the prompts to safely cancel the operation:

```bash
┌─ Operation Cancelled ───────────────────────────────────┐
│ Operation cancelled by user (ESC pressed)               │
│                                                         │
│ Run the command again when you're ready to commit.      │
└─────────────────────────────────────────────────────────┘
```

### Smart Change Detection

GitClean automatically detects if you have changes to commit:

```bash
$ gitclean
No changes to commit
Make some changes and run `gitclean` again

Try these commands:
• gitclean spellcheck "your text" - Test spell checker
• gitclean test - Run spell checker tests
• gitclean setup - Install git hooks
• gitclean config init - Create config file
```

### Error Handling

GitClean provides clear error messages and recovery suggestions:

- **Not in a git repository**: Suggests running `git init`
- **No remote repository**: Suggests adding a remote
- **Push failures**: Shows the exact error from git

## Project Structure

```
gitcleancommit/
├── src/
│   ├── index.ts           # CLI entry point and command definitions
│   ├── prompt.ts          # Interactive prompt system with spell checking
│   ├── git-integration.ts # Git operations (add, commit, push)
│   ├── spellcheck.ts      # Spell checking engine and dictionary
│   ├── config.ts          # Configuration management
│   ├── banner.ts          # ASCII art banner display
│   └── types/
│       └── typo-js.d.ts   # TypeScript definitions for typo-js
├── dist/                  # Compiled JavaScript (generated)
├── .gitclean.config.json  # Optional: User configuration file (create with 'gitclean config init')
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
├── setup.js              # Post-install setup script
├── README.md             # This file
└── LICENSE               # MIT License
```

## Troubleshooting

### Common Issues and Solutions

#### "Not in a git repository"

```bash
# Initialize a git repository
git init
```

#### "No changes to commit"

```bash
# Check what has changed
gitclean status
# or
git status
```

#### "Push failed"

```bash
# Add a remote repository
git remote add origin https://github.com/username/repo.git

# Check current remotes
git remote -v
```

#### "Command not found: gitclean"

```bash
# Reinstall globally
npm install -g gitcleancommit

# Or use npx
npx gitcleancommit
```

#### Spell checker not working

```bash
# Check spell checker status
gitclean spellcheck --verbose

# Test with sample text
gitclean test
```

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

### Development Setup

```bash
# Clone the repository
git clone https://github.com/thissudhir/gitCleanCommit.git
cd gitCleanCommit

# Install dependencies
npm install

# Build the TypeScript files
npm run build

# Run in development mode
npm run dev

# Test the CLI locally
npm start
```

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

## What's Next?

- [x] Configurable commit types
- [x] Improved spell checker performance
- [ ] Custom spell check dictionaries
- [ ] Multi-language support
- [ ] Integration with issue trackers
- [ ] Commit message templates
- [ ] AI-powered commit message suggestions

---

**Made with love by [Abhishek](https://github.com/thissudhir)**

_Happy committing! May your git history always be clean and meaningful._
