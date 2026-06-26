# Security Policy

## Supported versions

Mise en Scene is an early working spike. Only the latest commit on the `main` branch receives security fixes. Pin to a specific commit if you need a known-good version.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems. Email **me@solomonneas.dev** with: <!-- content-guard: allow pii/email -->

- A short description of the issue.
- Steps to reproduce (or a minimal proof of concept).
- The version or commit you tested against.
- Whether you would like to be credited in the release notes.

You should get an acknowledgment within 72 hours. If you do not, please follow up - the mail may have been filtered.

## In scope

- Cross-site scripting or HTML/SVG injection in a rendered scene or in the standalone HTML export, where untrusted source material can execute script in a viewer's browser.
- Source material that escapes the scene model and reaches the page chrome or export wrapper unescaped.
- Build or dependency issues in the published bundle that ship exploitable code to a browser.

## Out of scope

- Issues that require an attacker to already control the machine running the dev server or the browser opening an export.
- Bugs in third-party dependencies (React, Vite, TypeScript) - report those to their respective projects, though a heads-up here is welcome.
- The accuracy or completeness of an extracted scene. Mise en Scene's heuristics are best-effort and a wrong diagram is a feature bug, not a security issue.
- Content a user pasted and exported themselves. Treat an exported HTML file as carrying whatever was in the source you fed it.

## A note on exports

A standalone HTML export is self-contained and renders the scene you built. It is only as trustworthy as the source material it was generated from. Do not open an export from an untrusted source any more readily than you would open any other untrusted HTML file.

## Disclosure

We aim to ship a fix within 14 days of confirming a valid report. A coordinated disclosure timeline can be negotiated for issues that need longer.
