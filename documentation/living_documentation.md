# RIMA PoC – Living Documentation

This document serves as the index for the RIMA PoC web client documentation. Each section is maintained in its own folder alongside related diagrams and assets.

---

## Sections

| Task | Topic                      | Link                                                                              |
| ---- | -------------------------- | --------------------------------------------------------------------------------- |
| 604  | Base Web Client Components | [application-startup.md](./604-base_web_client_components/application-startup.md) |
| 644  | Web Client Content Catalog | [content-catalog.md](./644-webclient_content_catalog/content-catalog.md)          |
| 579  | Table of Contents (ToC)    | [table-of-contents.md](./579-table_of_contents/table-of-contents.md)              |
| 580  | Object Info (Popup)        | [object-info.md](./580-objekt_info/object-info.md)                                |
| 583  | Feature Editing            | [editing.md](./583-editing/editing.md)                                            |

## Application Flow Diagram

![RIMA PoC Startup and ToC](./604-base_web_client_components/rima-application-flow.png)

## Tests

Run the following checks locally before pushing. Each command can be copied directly into the terminal.

| Check      | Command                | Description                                                                 |
| ---------- | ---------------------- | --------------------------------------------------------------------------- |
| Format     | `npm run format:check` | Verifies that all source files are formatted according to Prettier rules.   |
| Linter     | `npm run lint`         | Runs ESLint across the project and reports any rule violations.             |
| Type check | `npm run type:check`   | Compiles TypeScript without emitting output to catch type errors.           |
| Tests      | `npm run test-ci`      | Executes the full unit test suite in CI mode (no watch, with coverage).     |
| Build      | `npm run build`        | Produces a production build and fails on any compilation or bundling error. |
