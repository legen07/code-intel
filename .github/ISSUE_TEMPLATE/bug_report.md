name: Bug report
description: Something in code-intel is broken or behaves incorrectly
title: "[bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to file a bug report! Please fill in the
        sections below so it can be reproduced and fixed quickly.
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: A clear description of the bug, including what you expected instead.
      placeholder: "I ran X, and expected Y, but got Z."
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Steps to reproduce
      description: Minimal, self-contained steps. Include the tool name and arguments when the bug is agent-facing.
      placeholder: |
        1. Install the plugin: `dsh plugin --profile web add code-intel`
        2. Call `find_symbol` with `...`
        3. ...
      value: |
        1.
        2.
        3.
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: code-intel version
      description: Output of `node -p "require('code-intel/package.json').version"` or the version shown in your plugin list.
      placeholder: "0.2.0"
    validations:
      required: true
  - type: input
    id: dsh-version
    attributes:
      label: DeepSeek Harness version
      placeholder: "0.2.2-rc.1"
    validations:
      required: true
  - type: input
    id: runtime
    attributes:
      label: Runtime
      description: Node version, OS, and profile (e.g. `Node 22.11, macOS 15, web profile`).
      placeholder: "Node 22, Ubuntu 24.04, web profile"
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Relevant log output
      description: Paste any error output or logs. No screenshots of text, please.
      render: shell
  - type: dropdown
    id: willingness
    attributes:
      label: Are you willing to submit a pull request?
      options:
        - "Yes"
        - "No"
        - "Maybe — need guidance"
    validations:
      required: false
