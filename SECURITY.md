# Security

AgentVille reads your coding-agent session transcripts and can ask your OS to open things, so a
hole in it matters even though it only runs on your own machine. Thank you for looking.

## Reporting a vulnerability

Please report it privately through
[GitHub's private vulnerability reporting](https://github.com/CarolineChiari/AgentVille/security/advisories/new),
not in a public issue. Include what an attacker controls, what they get, and the steps or a
proof of concept that shows it.

AgentVille is maintained by one person in their own time, so fixes are best effort. You'll get
an answer on the advisory, and credit in it once a fix is released, if you'd like that.

## Supported versions

Only the [latest release](https://github.com/CarolineChiari/AgentVille/releases/latest) gets
fixes. Every commit to `main` is released, so a fix ships as the next version.

## What AgentVille promises

Anything that breaks one of these is in scope:

- **It only listens on your own machine.** The server binds `127.0.0.1`, refuses requests
  whose `Host` isn't local (DNS rebinding), and refuses state-changing requests without a
  local `Origin` (cross-site requests from a web page you visit).
- **It never writes to an agent's files.** Everything it writes goes in its own `data/`
  directory (under the app's user data directory in the desktop app).
- **The only network access is GitHub, through your own `gh` CLI**, for the PR gardens and
  issue boards, and turning both off in Settings stops it.
- **Nothing it reads is ever run.** Session transcripts, issue and PR titles, labels and
  prompts are shown as text; commands are started with an argument list and no shell; and
  opening a thread goes through a URL your OS resolves.

## Out of scope

- Anything that already needs to run code as you on your machine, or to write to your home
  directory.
- The unsigned-build warnings on first launch (Gatekeeper on macOS, SmartScreen on Windows):
  the builds aren't signed with a developer certificate yet, and the README says so.
- Vulnerabilities in Claude Code, VS Code, the Claude app or other tools AgentVille opens.
