# Subagents

Specialized AI agents for project development.

- Project standards: `.kiro/steering/AGENTS.md`
- Orchestration rules: `.kiro/steering/main-agent-orchestration.md`

## Agents

| Agent | File | Purpose |
|-------|------|---------|
| backend | `backend.md` | CDK infrastructure, Lambda development, testing |
| frontend | `frontend.md` | Next.js frontend development and testing |
| deployment | `deployment.md` | Deployment verification, debugging, AWS resource querying |
| security | `security.md` | Security auditing and compliance (read-only) |
| documentation | `documentation.md` | Documentation updates, AI-DLC to closure docs synthesis |

## Key Rules (All Agents)

- No summary/checklist/deployment markdown files — only real code and existing docs
- Minimal decision comments — one line, only for non-obvious decisions
- Scope discipline — implement only what's asked, nothing more

## Workflow Patterns

### Project Initialization (New Projects via AI-DLC)
1. **Main agent** → Drives AI-DLC Inception phase (requirements, design, planning) using the AI-DLC Power
2. **backend** → Implement backend units from AI-DLC code generation plan
3. **frontend** → Implement frontend units from AI-DLC code generation plan
4. **security** → Security audit against project standards
5. **deployment** → Deploy and verify
6. **documentation** → Synthesize `aidlc-docs/` into closure docs in `docs/`

### Full-Stack Feature
1. **backend** → CDK stack + Lambda + tests → ends at `cdk synth`
2. **deployment** → `cdk deploy`, verify resources, debug stack errors
3. **frontend** → React components + API integration + tests
4. **security** → Scan for IAM/secrets/encryption issues
5. **documentation** → Update existing docs

### Deployment & Debugging
1. **deployment** → Deploy, check CloudFormation events
2. **deployment** → On failure: CloudWatch logs, root cause
3. **backend** → Fix code issues
4. **deployment** → Re-deploy and verify

### Security Audit
1. **security** → cdk-nag + ASH scans, report findings
2. **backend** → Apply remediations
3. **security** → Re-scan to verify
