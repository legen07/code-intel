# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a suspected security
vulnerability.

Instead, report it privately:

1. Open the repository on GitHub:
   [github.com/legen07/code-intel](https://github.com/legen07/code-intel)
2. Go to the **Security** tab → **Report a vulnerability**, and follow the
   GitHub Security Advisory flow.

Or, if you prefer, email the maintainer at
[60802742+legen07@users.noreply.github.com](mailto:60802742+legen07@users.noreply.github.com).

Please include:

- A description of the issue and its potential impact
- Affected versions (the `code-intel` package version and the DSH version)
- Steps to reproduce, or a proof of concept
- Any mitigations you have identified

You should receive an acknowledgment within a few days. We will coordinate a
fix and disclosure timeline with you and credit your report unless you prefer
to remain anonymous.

## Scope

This policy covers the `code-intel` plugin source tree in this repository.

Out of scope:

- Vulnerabilities in the DeepSeek Harness core or its `@deepseek-ai/*` peer
  packages — report those to the upstream
  [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) project.
- Vulnerabilities in third-party dependencies (`typescript`,
  `typescript-language-server`, `zod`, React) — report those upstream; we will
  pick up the fix through dependency updates.

Note that `typescript-language-server` is spawned as a **subprocess** against
the session's project, and agents operate on that project through the read-only
v1 tool set. Suspected escapes from that read-only contract (see the design
notes in [README.md](README.md)) are in scope and important to us.

## Supported versions

`code-intel` is in initial development (`0.x`). Security fixes are applied to
the latest `main` and released as patch versions; there are no separate
maintenance lines.

| Version | Supported |
| ------- | --------- |
| 0.2.x   | ✅        |
| < 0.2.0 | ❌        |
