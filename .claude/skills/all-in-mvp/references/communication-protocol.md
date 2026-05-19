# Agent Communication Protocol

## Core Principle
All agents communicate through file system — no direct messaging between work agents.

## File State Convention

| State | Marker | Meaning |
|-------|--------|---------|
| Ready | Module dir doesn't exist | Available for next allocation round |
| Assigned | Module dir exists, no DONE marker | Agent is working, don't reassign |
| Completed | DONE marker file in module dir | Dependency requirements satisfied |
| Blocked | BLOCKED marker with reason file | Agent encountered blocker, needs intervention |

## Output Structure
```
project/
├── PRD.md                           # Stage 1
├── spec.md                          # Stage 2.1 (Architecture)
├── schema.sql                       # Stage 2.1 (Database Schema)
├── api-contract.yaml                # Stage 2.1 (API Contract)
├── task.md                          # Stage 2.2 (Task breakdown)
├── modules/
│   ├── user.md                      # Stage 2.2 (Module definitions)
│   ├── product.md
│   └── ...
├── mocks/
│   └── <module>/                    # Stage 2.4 (Mock services)
├── integration-tests/
│   ├── modules/<module>.test.ts     # Stage 2.5 (Module tests)
│   └── scenarios/<scenario>.test.ts # Stage 2.6 (E2E scenarios)
├── src/
│   ├── modules/<module>/            # Stage 3 (Backend implementation)
│   ├── views/                       # Stage 3 (Frontend pages)
│   └── components/                  # Stage 3 (Shared components)
└── <DONE|BLOCKED>                   # Status markers
```

## Coordinator Scanning
- Coordinator scans directory after each agent completion event
- Scans for: new DONE markers, BLOCKED markers, unallocated module dirs
- Outputs allocation log after each round
