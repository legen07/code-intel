name: Feature request
description: Suggest a new tool, capability, or improvement for code-intel
title: "[feat]: "
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: The problem
      description: What are you trying to do that code-intel does not let you do today?
      placeholder: "As an agent, I want to … so that …"
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: The smallest change that solves the problem. If it suggests a new tool, describe its parameters and result shape.
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: Other approaches and why they fall short.
  - type: dropdown
    id: scope
    attributes:
      label: Affected area
      options:
        - Agent tools
        - Symbol graph / blueprint
        - LSP layer
        - Web Client sidebar
        - Packaging / distribution
        - Documentation
        - Other
    validations:
      required: true
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
