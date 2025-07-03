# Installation Guide for GitClean CLI

## Step-by-Step Installation

### 1. Project Setup

First, make sure your project structure looks like this:

```
gitclean-cli/
├── src/
│   ├── index.ts
│   ├── prompt.ts
│   ├── git-integration.ts
│   ├── spellcheck.ts
│   └── banner.ts
├── package.json
├── tsconfig.json
├── setup.js
└── README.md
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Run Initial Setup

```bash
npm run setup
```

### 5. Test the CLI

```bash
# Test the CLI locally
node dist/index.js --help

# Or if you want to link it globally for testing
npm link
gitclean --help
```

### 6. Create a Git Repository for Testing

```bash
# Create a test repository
mkdir test-repo
cd test-repo
git init
echo "# Test" > README.md
git add README.md

# Install GitClean in the test repository
gitclean setup

# Test the commit process
echo "some changes" >> README.md
git add .
git commit  # This should trigger GitClean
```

## Publishing to NPM

### 1. Update package.json

Make sure your package.json has:

- Correct name (must be unique on NPM)
- Proper version
- Your details in author field
- Correct repository URL

### 2. Build for Production

```bash
npm run build
```

### 3. Test the Package

```bash
# Test locally first
npm pack
npm install -g ./gitclean-cli-1.0.0.tgz
```

### 4. Publish to NPM

```bash
# Login to NPM (first time only)
npm login

# Publish the package
npm publish
```

## Usage After Installation

### For End Users

```bash
# Install globally
npm install -g gitclean-cli

# Navigate to any git repository
cd your-git-repo

# Set up GitClean
gitclean setup

# Now use git commit as usual
git add .
git commit  # GitClean will intercept and guide you
```

## Troubleshooting

### Common Issues

1. **"Cannot find module" error**: Make sure you run `npm run build` first
2. **Permission errors**: Make sure the dist/index.js file is executable
3. **Git hook not working**: Make sure you run `gitclean setup` or `gitclean install` in your git repository

### Development Mode

For development, you can run:

```bash
# Watch mode for development
npm run dev

# Test changes immediately
node dist/index.js setup
```

### Debugging

Add this to your code for debugging:

```typescript
console.log('Debug info:', { __dirname, __filename, process.cwd() });
```

## File Structure After Build

```
gitclean-cli/
├── dist/           # Compiled JavaScript files
│   ├── index.js
│   ├── prompt.js
│   ├── git-integration.js
│   ├── spellcheck.js
│   └── banner.js
├── src/            # TypeScript source files
├── node_modules/   # Dependencies
└── package.json
```
