# Project RIMA PoC WebClient

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.7.

> ## Table of Contents
>
> - [About This Project](#about-this-project)
> - [Development](#development)
> - [Deployment](#deployment)
> - [External Resources](#external-resources)
> - [Contributors](#contributors)

## About This Project

This is a **Proof of Concept (PoC)** project focused on solving specific problems and exploring solutions rather than producing production-ready code. As such, the testing strategy is intentionally streamlined:

- **Limited Unit Testing**: Unit tests are written only for services and other constructs containing significant business logic
- **Component Tests**: Most component tests are excluded to keep development focused on problem-solving

This approach allows rapid iteration and experimentation while maintaining test coverage for critical business logic.

## Development

> - [Project Structure](#project-structure)
> - [Development server](#development-server)
> - [Conventions](#conventions)
> - [Error Handling](#error-handling)
> - [State Management](#state-management)

### Project Structure

This project follows the [Angular Style Guide](https://angular.dev/style-guide#organize-your-project-by-feature-areas) and organizes code by **feature areas** rather than by code type.

- **Feature-based organization**: Group related components, services, and other files by the feature they implement
- **Avoid type-based directories**: Do not create directories like `components/`, `directives/`, or `services/`
- **Shared code**: Place code used across multiple features in the `shared/` directory
- **Co-located component files**: Keep component files (TS, HTML, CSS) and their unit tests together in the same directory

### Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

#### Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

#### Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

#### Running unit tests

Unit tests should be written for services and other logic-heavy classes. Components are intentionally excluded to maintain focus on business logic testing.

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

To run tests once without watch mode and with coverage (used in CI), run:

```bash
npm run test-ci
```

#### i18n: Translation keys

To extract all translation keys from the source code, run:

```bash
npm run i18n:extract
```

And if you want to check if all keys are used and none missing, run:

```bash
npm run i18n:find
```

#### Formatting and linting

To format the code, you can use the following commands:

```bash
npm run format
```

And if you want to check for formatting issues, run:

```bash
npm run format:check
```

To check the linting of the code, you can use the following command:

```bash
npm run lint
```

as well as

```bash
npm run type:check
```

#### Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

### Conventions

#### Angular and TypeScript Conventions

This project follows Angular and TypeScript best practices:

- **Dependency Injection**: Use `inject()` function instead of constructor parameter injection
- **Signals**: Use signals for local state management and `computed()` for derived state
- **Type Safety**: Enable strict type checking and avoid `any` type

For complete guidelines, refer to:

- [Angular Style Guide](https://angular.dev/style-guide)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)

ESLint is enabled in the pre-commit hook to enforce most conventions. In rare cases where you need to disable a linter rule, always add a comment explaining why:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- The interface definition requires `any` as an argument.
public handleError(error: any): void {
```

#### Branch Names and Commit Messages

Whenever possible, a GitHub issue should be referenced in both branch name and commit message:

- **Branches**: `[feature|hotfix]/[xxx]-[name-of-branch]`, where `xxx` refers to a GitHub issue number and `name-of-branch` is a short summary of the feature/hotfix
- **Commits**: `Your commit message #[xxx]`, where `xxx` refers to a GitHub issue number.

Git hooks check for both branch name and commit message format, but will only output warnings.

##### Git Commit Message Guidelines

Write meaningful commit messages (see [this blog post](https://cbea.ms/git-commit/) for details)

**Example**:

```
Prevent infinite loop in geometry reload

distinctUntilChanged compared event objects by reference, not values.
Each dispatch created a new object, so duplicates weren't filtered.
This caused infinite loops when deactivating polygon drawing. Now
extracts the geometry value first for proper value comparison. Add
tests to verify duplicate filtering works correctly.
```

#### Internationalization (i18n) with Transloco

Translation keys must follow **kebab-case** (dashes) with a hierarchical structure:

- **Pattern**: `component.property` or `component.element.property`
- **Use kebab-case**: All lowercase with dashes separating words
- **Be descriptive**: The key should indicate what it translates

**Examples:**

```json
{
  "map.zoom-in.aria-label": "Zoom in",
  "language-switcher.aria-label": "Switch to {{language}}",
  "form.stepper.next": "Next",
  "form.station.search.placeholder": "Search station"
}
```

**Avoid:**

- ❌ camelCase: `languageSwitcher.switchTo`
- ❌ Overly generic keys: `button.label`
- ❌ Unnecessary nesting: `language-switcher.button.switch-to.aria-label`

#### Configuration Files

Configuration files combine the interface definition and static config in one file:

```typescript
interface LanguageConfig {
  availableLanguages: Language[];
  defaultLanguage: Language;
}

export const languageConfig = {
  availableLanguages: ['de', 'fr', 'it'],
  defaultLanguage: 'de',
} as const satisfies LanguageConfig;
```

This pattern ensures type safety while keeping related code together. Always use `as const satisfies [ConfigInterface]` to maintain both immutability and type checking.

### Error Handling

The global error handler catches all errors and delegates them to type-specific handlers. In development mode, errors are logged to the console.

The application defines custom errors extending the native `Error` object for easier handling and runtime checks. All custom errors extend from `RimaError` (abstract base class) with:

- an optional `originalError` property of `unknown` type to forward the original error
- an optional `translationArguments` for error message arguments used in the translation value of the error message

All errors should extend from the following abstract classes, extending `RimaError`. They have different behaviour in the error handler:

- `**FatalError**`: Prevents the current screen from being used by redirecting to a fatal error page
- `**RecoverableError**` and `**SilentError**`: Do nothing except log to console in dev mode. Use for errors that should not be communicated to the user

Uncaught errors that don't extend these classes are treated as `FatalError` since their criticality cannot be reliably determined.

#### Example:

```typescript
// layer-error.ts
export class LayerLoadError extends RecoverableError {
  public override message = marker('layer.load.error');
  public override translationArguments: Record<'layerName', string>;

  constructor(layerName: string, originalError?: unknown) {
    super(originalError);
    this.translationArguments = { layerName };
  }
}
```

This will create a recoverable error with the message `layer.load.error` and the translation argument `layerName`.
The corresponding translation key in the `de.json` file looks like this:

```json
{ "layer.load.error": "Der Layers '{{layerName}}' konnte nicht geladen werden." }
```

The error handler will log this error to the console in the following format:

```text
LayerLoadError: layer.load.error
    at ...
    (...)
"Der Layers 'Axes_NSKS_de' konnte nicht geladen werden."
```

### State Management

All application state is managed with [NgRx Signals](https://ngrx.io/guide/signals) (`@ngrx/signals`) combined with
the `withImmutableState` feature from `@angular-architects/ngrx-toolkit`.

For more information on how to use NgRx Signals, refer to the official documentation: https://ngrx.io/guide/signals

#### File Types

| File          | Purpose                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `*.store.ts`  | The store itself contains the state, initial state, methods, computed signals, reducers and effects |
| `*.state.ts`  | State interface                                                                                     |
| `*.events.ts` | Event definitions created with `eventGroup()`                                                       |

#### Store Structure

Every store follows this composition order inside `signalStore()`:

```typescript
// example.state.ts
export interface ExampleState {
  field: string | undefined;
}
```

```typescript
// example.store.ts
export const initialState = {
  field: undefined,
} as const satisfies ExampleState;

export const ExampleStore = signalStore(
  { providedIn: 'root' },
  // creation of the state with initial values
  withImmutableState<ExampleState>(() => initialState),
  // reducer with events
  withReducer(
    on(exampleEvents.setUpperCaseField, ({ payload: value }) => ({ field: value.toUpperCase() })),
    on(exampleEvents.resetField, () => ({ field: undefined })),
  ),
  // computed signals derived from state
  withComputed((store) => ({
    derivedValue: computed((): string => `derived: ${store.field() ?? ''}`),
  })),
  // methods to update the state
  withMethods((store) => ({
    setField: (field: string): void => patchState(store, { field }),
  })),
);
```

Not every feature block is required; therefore, use only what the store needs.

#### Events

Events are plain, typed messages that describe something that happened in the application (e.g. "the user set a field"). Any part of the app can dispatch an event; stores and effects react to them independently. This decouples the code that triggers a change from the code that handles it.

Define them with `eventGroup()` and dispatch via `Dispatcher`, react via `withReducer(on(...))` in the store or via `events.on(...)` in a service/component:

```typescript
// example.events.ts
export const exampleEvents = eventGroup({
  source: 'Example',
  events: {
    setUpperCaseField: type<string>(),
    resetField: type<void>(),
  },
});

// dispatching
inject(Dispatcher).dispatch(exampleEvents.setUpperCaseField('test'));

// reacting in a store
withReducer(
  on(exampleEvents.setUpperCaseField, ({ payload: value }) => ({ field: value.toUpperCase() })),
),

// reacting in an effects service
inject(Events)
  .on(exampleEvents.somethingHappened)
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(({ payload }) => { ... });
```

#### Using a Store in a Component

Inject the store with `inject()` and consume signals directly in the template:

```typescript
@Component({
  template: `
    <div>
      <p>{{ exampleStore.field() }}</p>
      <button (click)="runTest()">Test</button>
    </div>
  `,
})
export class ExampleComponent {
  protected readonly exampleStore = inject(ExampleStore);

  protected runTest(): void {
    this.exampleStore.setField('new value');
  }
}
```

## Deployment

### Trigger

The deployment process is done using Github actions. There are two kinds of deployments:

- **Automatic deployment**  
  where the deployment is triggered by a push to the `main` branch. This will deploy the application to the dev environment.
- **Manual deployment**  
  where the deployment is triggered manually. One can decide to deploy to the any available environment.

### Environments

The application has currently one environment:

- **Dev**  
  This is the development environment. It is used for testing and development purposes and is hosted on Github Pages.  
  URL: [https://fedro-admin.github.io/project-rima-poc-web-client/](https://fedro-admin.github.io/project-rima-poc-web-client/)

## External Resources

### Official Documentation

- **Angular Style Guide**: [https://angular.dev/style-guide](https://angular.dev/style-guide)
- **Google TypeScript Style Guide**: [https://google.github.io/styleguide/tsguide.html](https://google.github.io/styleguide/tsguide.html)

### ArcGIS Maps SDK for JavaScript

- **Main Documentation**: [https://developers.arcgis.com/javascript/latest/](https://developers.arcgis.com/javascript/latest/)
- **Map Components Reference**: [https://developers.arcgis.com/javascript/latest/references/map-components/](https://developers.arcgis.com/javascript/latest/references/map-components/)

### NgRx Signals

- **Official Documentation**: https://ngrx.io/guide/signals
- **NgRx Toolkit with Immutable State**: https://ngrx-toolkit.angulararchitects.io/docs/with-immutable-state

## Contributors

The project was developed for the **[Bundesamt für Strassen ASTRA](https://www.astra.admin.ch)**.

It has been initially developed by [EBP Schweiz AG](https://ebp.ch) as an open-source project.

### Individual contributors

The following people have contributed to this project:
