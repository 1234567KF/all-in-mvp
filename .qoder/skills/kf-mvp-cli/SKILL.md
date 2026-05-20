---
name: kf-mvp-cli
description: >-
  Load when user asks to build CLI tools, command-line interfaces, or scripts.
  Triggers: CLI工具, 命令行, 脚本, CLI开发, command line, scripts,
  shell脚本, bash. Also load when creating developer tools or automation.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: pro
graph:
  dependencies:
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP CLI Tools — 命令行工具技能

> **Core Belief**: Good tools make developers faster. CLI tools should do one thing well, be composable, and follow Unix philosophy. Small tools that work together beat large monolithic tools.

**Division of Labor**: This Skill focuses on **CLI development patterns** using Tool Wrapper pattern. Provides CLI design principles, argument parsing, and best practices.

---

# Core Philosophy

1. **Single responsibility** — One tool, one purpose
2. **Compose with pipes** — Small tools, big results
3. **Clear output** — stdout for data, stderr for errors
4. **Fail fast** — Check inputs early, fail with clear message

---

# CLI Framework (Commander.js)

```typescript
// cli/index.ts
import { Command } from 'commander';
import { dbPush, dbSeed, dbMigrate } from './commands/db';
import { generateKey, encrypt, decrypt } from './commands/crypto';

const program = new Command();

program
  .name('mvp-cli')
  .description('MVP CLI tools')
  .version('1.0.0');

// Database commands
program
  .command('db <action>')
  .description('Database operations')
  .option('-e, --env <env>', 'Environment', 'development')
  .action(async (action, options) => {
    switch (action) {
      case 'push':
        await dbPush(options.env);
        break;
      case 'seed':
        await dbSeed();
        break;
      case 'migrate':
        await dbMigrate();
        break;
      default:
        console.error(`Unknown action: ${action}`);
        process.exit(1);
    }
  });

// Crypto commands
program
  .command('crypto <action>')
  .description('Cryptographic operations')
  .requiredOption('-k, --key <key>', 'Encryption key')
  .requiredOption('-i, --input <file>', 'Input file')
  .action(async (action, options) => {
    switch (action) {
      case 'encrypt':
        await encrypt(options.key, options.input);
        break;
      case 'decrypt':
        await decrypt(options.key, options.input);
        break;
    }
  });

program.parse();
```

---

# CLI Output Patterns

## Success Output
```typescript
console.log('✓ Database pushed successfully');
console.log('✓ Created 5 users');
```

## Error Output
```typescript
console.error('✗ Error: Database connection failed');
console.error('  Details: Cannot connect to postgres://localhost:5432');
console.error('  Hint: Make sure PostgreSQL is running');
process.exit(1);
```

## Data Output (for piping)
```typescript
// Machine-readable output
console.log(JSON.stringify({ users: result }));
```

## Table Output
```typescript
// Human-readable table
console.table([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);
```

---

# Argument Parsing Patterns

## Positional Arguments
```typescript
// cli/template.ts
program
  .command('generate <type> <name>')
  .description('Generate template')
  .action((type, name) => {
    // type: 'component' | 'module' | 'test'
    // name: 'UserCard' | 'auth' | 'user.test'
  });
```

## Options
```typescript
// Long and short options
program
  .option('-n, --name <name>', 'User name')
  .option('-e, --email <email>', 'User email')
  .option('-f, --force', 'Overwrite existing files', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('--config <path>', 'Config file path');
```

## Flags
```typescript
// Boolean flags
program
  .option('--dry-run', 'Preview changes without applying')
  .option('--no-color', 'Disable color output');
```

---

# Script Examples

## Database Migration Script

```typescript
// scripts/db.ts
import { db } from '../src/db';
import { migrate } from '../drizzle';

export async function dbPush(env: string) {
  console.log(`Pushing schema to ${env}...`);
  
  try {
    await migrate.push({
      schema: './src/schema.ts',
      driver: 'better-sqlite',
      cwd: process.cwd(),
    });
    console.log('✓ Schema pushed successfully');
  } catch (error) {
    console.error('✗ Schema push failed:', error);
    process.exit(1);
  }
}
```

## Data Seeding Script

```typescript
// scripts/seed.ts
import { db } from '../src/db';
import { users, products } from '../src/schema';

export async function seed() {
  console.log('Seeding database...');
  
  // Create users
  const userList = [
    { email: 'admin@example.com', name: 'Admin', role: 'admin' },
    { email: 'user@example.com', name: 'User', role: 'user' },
  ];
  
  for (const user of userList) {
    await db.insert(users).values(user);
  }
  
  console.log(`✓ Created ${userList.length} users`);
}
```

---

# Shell Scripts (Bash/Shell)

```bash
#!/bin/bash
# scripts/setup.sh

set -e  # Exit on error

echo "🚀 Setting up development environment..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js required" >&2; exit 1; }

# Install dependencies
npm install

# Setup database
npm run db:push
npm run db:seed

echo "✅ Setup complete!"
```

---

# Interactive Prompts

```typescript
// Using inquirer
import inquirer from 'inquirer';

const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'name',
    message: 'What is your name?',
    validate: (value) => value.length > 0,
  },
  {
    type: 'confirm',
    name: 'continue',
    message: 'Do you want to continue?',
    default: true,
  },
  {
    type: 'list',
    name: 'color',
    message: 'Pick a color',
    choices: ['Red', 'Green', 'Blue'],
  },
]);
```

---

# Constraints

**MUST DO:**
- Provide clear help text
- Exit with proper codes (0 success, 1 error)
- Use stderr for errors
- Support --help and --version

**MUST NOT DO:**
- Use vague error messages
- Print to stdout when piping
- Skip input validation
- Make slow commands without progress indicator

---

# Gotchas

- **Exit codes** — 0 = success, non-zero = error
- **Stdout vs stderr** — Data goes to stdout, errors to stderr
- **Colors** — Respect NO_COLOR env var
- **Progress** — Long operations should show progress
- **TTY detection** — Colors only when terminal supports it