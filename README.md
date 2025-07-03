# GitClean CLI 🚀

> A beautiful CLI tool for creating clean, conventional git commits with spell checking and automatic integration

[![npm version](https://badge.fury.io/js/gitclean-cli.svg)](https://badge.fury.io/js/gitclean-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- **🎯 One Command Workflow**: `gitclean` handles everything - add, commit, and push
- **📝 Interactive Prompts**: Beautiful, guided commit message creation
- **🔍 Smart Spell Checking**: Catches common typos in commit messages
- **🎨 Conventional Commits**: Follows conventional commit standards
- **🌟 Beautiful UI**: Clean, colorful interface with emojis and spinners
- **🔧 Git Hook Integration**: Optional automatic integration with git hooks
- **⚡ Lightning Fast**: Optimized for daily development workflow

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g gitclean-cli

# Or install locally in your project
npm install --save-dev gitclean-cli
```

### Basic Usage

```bash
# Run the complete workflow (add → commit → push)
gitclean

# That's it! 🎉
```

## 📋 Commands

### Primary Commands

```bash
# Interactive commit workflow (recommended)
gitclean

# Just create a commit (no push)
gitclean commit

# Check git status
gitclean status
```

### Setup Commands

```bash
# Install git hooks for automatic integration
gitclean setup

# Remove git hooks
gitclean uninstall
```

## 🎯 How It Works

When you run `gitclean`, here's what happens:

1. **📁 Stage Changes**: Automatically runs `git add .`
2. **💬 Interactive Prompt**: Guides you through creating a conventional commit message
3. **🔍 Spell Check**: Checks for common typos in your commit message
4. **📝 Preview**: Shows you exactly what your commit will look like
5. **✅ Commit**: Creates the commit with your message
6. **🚀 Push**: Automatically pushes to your current branch

## 🎨 Commit Types

GitClean supports these conventional commit types:

| Type     | Description            | Example                                     |
| -------- | ---------------------- | ------------------------------------------- |
| `ADD`    | Add new code or files  | `ADD: user authentication system`           |
| `FIX`    | A bug fix              | `FIX: resolve login validation issue`       |
| `UPDATE` | Updated existing code  | `UPDATE: improve database connection logic` |
| `DOCS`   | Documentation changes  | `DOCS: add API usage examples`              |
| `TEST`   | Adding tests           | `TEST: add unit tests for auth module`      |
| `REMOVE` | Removing code or files | `REMOVE: deprecated legacy components`      |

## 🔍 Spell Checking

GitClean includes intelligent spell checking that catches common programming typos:

- `functionallity` → `functionality`
- `recieve` → `receive`
- `occured` → `occurred`
- `seperate` → `separate`
- `implmentation` → `implementation`
- And many more...

## 🛠️ Advanced Usage

### Git Hook Integration

For automatic integration with your git workflow:

```bash
# Install hooks
gitclean setup

# Now every time you run `git commit`, GitClean will prompt you
git commit
```

### Custom Scopes

You can add scopes to your commits for better organization:

```
ADD(auth): user login functionality
FIX(api): resolve timeout issues
UPDATE(ui): improve button styling
```

### Breaking Changes

Mark breaking changes for semantic versioning:

```
ADD!: new API endpoint structure

BREAKING CHANGE: API endpoints now require authentication
```

## 📁 Project Structure

```
gitclean-cli/
├── src/
│   ├── index.ts           # Main CLI entry point
│   ├── prompt.ts          # Interactive prompts
│   ├── git-integration.ts # Git operations
│   ├── spellcheck.ts      # Spell checking logic
│   └── banner.ts          # CLI banner
├── package.json
├── tsconfig.json
├── setup.js              # Post-install setup
└── README.md
```

## 🔧 Configuration

GitClean works out of the box with sensible defaults. No configuration file needed!

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit using GitClean: `gitclean` 😉
6. Push to your fork: `git push origin feature/amazing-feature`
7. Create a Pull Request

## 📝 Examples

### Basic Commit

```bash
$ gitclean

   _____ _ _    _____ _
  / ____(_) |  / ____| |
 | |  __ _| |_| |    | | ___  __ _ _ __
 | | |_ | | __| |    | |/ _ \/ _` | '_ \
 | |__| | | |_| |____| |  __/ (_| | | | |
  \_____|_|\__|\_______|_|    \__,_|_| |_|

  Clean, conventional commits made easy

? Select the type of change you're committing: ADD - Add new code or files
? What is the scope of this change? (optional): auth
? Write a short, imperative tense description: user login functionality
? Provide a longer description of the change (optional):
? Are there any breaking changes? No
? Add issue references (e.g., "fixes #123", "closes #456"): fixes #42

📝 Generated Commit Message:

┌─────────────────────────────────────────────────────────────────────────────┐
│ ➕ ADD(auth): user login functionality                                       │
│ fixes #42                                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

? Ready to add, commit, and push? (This will run: git add . → git commit → git push) Yes

🚀 Starting GitClean workflow...

✔ Files added: .
✔ Commit created successfully!
✔ Pushed to main successfully!

✅ GitClean workflow completed successfully!
📦 Changes pushed to main
```

## 🐛 Troubleshooting

### Common Issues

**"Not in a git repository"**

```bash
# Make sure you're in a git repository
git init
```

**"No changes to commit"**

```bash
# Check what files have changed
gitclean status

# Or use git status
git status
```

**"Push failed"**

```bash
# Make sure you have a remote repository set up
git remote add origin <your-repo-url>

# Or check existing remotes
git remote -v
```

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by conventional commits specification
- Built with ❤️ for developers who love clean git history
- Thanks to all contributors who make this tool better

## 📞 Support

- 🐛 [Report bugs](https://github.com/thissudhir/gitCleanCommit/issues)
- 💡 [Request features](https://github.com/thissudhir/gitCleanCommit/issues)
- 📖 [Documentation](https://github.com/thissudhir/gitCleanCommit#readme)

---

**Made with ❤️ by [Abhishek](https://github.com/thissudhir)**

_Happy committing! 🚀_
