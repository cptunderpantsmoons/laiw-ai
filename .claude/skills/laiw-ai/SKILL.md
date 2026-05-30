```markdown
# laiw-ai Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns used in the `laiw-ai` TypeScript codebase. You'll learn about file naming, import/export conventions, and how to structure and write tests. While no automated workflows were detected, this guide provides best practices and suggested commands to streamline your development process.

## Coding Conventions

### File Naming
- **Pattern:** PascalCase  
  Example:  
  ```
  MyComponent.ts
  UserService.ts
  ```

### Import Style
- **Pattern:** Relative imports  
  Example:  
  ```typescript
  import MyComponent from './MyComponent';
  import { helperFunction } from '../utils/Helper';
  ```

### Export Style
- **Pattern:** Default exports  
  Example:  
  ```typescript
  // MyComponent.ts
  const MyComponent = () => { /* ... */ };
  export default MyComponent;
  ```

### Commit Patterns
- **Type:** Freeform (no enforced structure)
- **Average length:** 73 characters

## Workflows

_No automated or CI workflows detected in this repository. Below are suggested manual workflows for common tasks._

### Running Tests
**Trigger:** When you want to verify your code changes.
**Command:** `/run-tests`

1. Identify test files matching the `*.test.*` pattern.
2. Use your preferred test runner (e.g., `ts-node`, `jest`, or `mocha`) to execute the tests.
   ```bash
   npx jest
   # or
   npx ts-node MyComponent.test.ts
   ```

### Adding a New Module
**Trigger:** When you need to add a new feature or component.
**Command:** `/add-module`

1. Create a new file using PascalCase (e.g., `NewFeature.ts`).
2. Use relative imports to include dependencies.
3. Export the main class or function as the default export.
   ```typescript
   // NewFeature.ts
   const NewFeature = () => { /* ... */ };
   export default NewFeature;
   ```
4. Add corresponding tests in a `NewFeature.test.ts` file.

### Writing a Test
**Trigger:** When you add or update functionality.
**Command:** `/write-test`

1. Create a test file named `YourModule.test.ts`.
2. Write tests using your preferred testing framework.
   ```typescript
   // MyComponent.test.ts
   import MyComponent from './MyComponent';

   test('should do something', () => {
     expect(MyComponent()).toBe(/* expected value */);
   });
   ```
3. Run tests to verify correctness.

## Testing Patterns

- **Test File Pattern:** `*.test.*` (e.g., `MyComponent.test.ts`)
- **Framework:** Not explicitly defined; choose your preferred TypeScript-compatible test runner.
- **Example:**
  ```typescript
  // Example.test.ts
  import Example from './Example';

  test('Example returns true', () => {
    expect(Example()).toBe(true);
  });
  ```

## Commands

| Command       | Purpose                                      |
|---------------|----------------------------------------------|
| /run-tests    | Run all test files in the repository         |
| /add-module   | Scaffold a new module with conventions       |
| /write-test   | Create a test file for a new or updated file |
```
