# CourtPlay — Testing & Evaluation Action Plan for Claude Code

Use this document as a step-by-step guide to set up testing loops in Claude Code. Each section is a discrete action you can complete in order. Since you've finished Phases 1a (scaffold) and 1b (auth/onboarding), the testing setup targets what's already built and sets the foundation for every future phase.

---

## Action 1: Install your test toolchain

Run this in your project root:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
```

**What each package does:**

- `vitest` — Fast, Vite-native test runner (zero extra config since you're already on Vite)
- `@testing-library/react` — Render components and query the DOM the way users interact with it
- `@testing-library/jest-dom` — Custom matchers like `toBeInTheDocument()` and `toHaveTextContent()`
- `@testing-library/user-event` — Simulates real user interactions (clicks, typing, tab) more accurately than `fireEvent`
- `jsdom` — Browser environment for Node so components can render in tests
- `msw` — Mock Service Worker to intercept Supabase API calls without hitting a real database

---

## Action 2: Configure Vitest

Create `vitest.config.ts` in the project root:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/components/ui/**'], // skip Untitled UI vendored components
    },
  },
});
```

Then create the setup file at `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Action 3: Create Supabase mocks with MSW

Create `src/test/mocks/handlers.ts`. This is where you define mock API responses so tests never hit a real Supabase instance:

```ts
import { http, HttpResponse } from 'msw';

const SUPABASE_URL = 'http://localhost:54321'; // or your VITE_SUPABASE_URL

export const handlers = [
  // Mock auth session check
  http.get(`${SUPABASE_URL}/auth/v1/session`, () => {
    return HttpResponse.json({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
    });
  }),

  // Mock users table read
  http.get(`${SUPABASE_URL}/rest/v1/users`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    return HttpResponse.json([
      {
        id: id || 'test-user-id',
        email: 'test@example.com',
        first_name: 'Test',
        last_name_initial: 'U',
        skill_level: '4.0',
        is_admin: false,
        is_suspended: false,
        deleted_at: null,
      },
    ]);
  }),

  // Mock courts table
  http.get(`${SUPABASE_URL}/rest/v1/courts`, () => {
    return HttpResponse.json([
      { id: 'court-1', name: 'Longshore Club', area: 'Westport', active: true },
      { id: 'court-2', name: 'Staples High School', area: 'Westport', active: true },
    ]);
  }),
];
```

Create `src/test/mocks/server.ts`:

```ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

Update `src/test/setup.ts` to start and stop the mock server:

```ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

---

## Action 4: Create a test render helper

Create `src/test/render.tsx` to wrap every component in the providers it needs (router, auth context, etc.):

```tsx
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ReactElement } from 'react';

// Add your own providers here (auth context, etc.) as you build them
function AllProviders({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { screen, waitFor, within } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
```

---

## Action 5: Write your first tests (Phase 1 code)

These validate what you've already built. Create test files next to the source files they test.

**Test the auth hook — `src/hooks/useAuth.test.ts`:**

```ts
import { describe, it, expect } from 'vitest';
// Test that your auth hook exports the expected interface
// Test that unauthenticated state redirects to /signin
// Test that authenticated state without a profile redirects to /onboarding
```

**Test the encryption utility — `src/lib/crypto.test.ts`:**

```ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('crypto', () => {
  it('encrypts and decrypts a phone number round-trip', () => {
    const phone = '203-555-1234';
    const encrypted = encrypt(phone);
    expect(encrypted).not.toBe(phone);
    expect(decrypt(encrypted)).toBe(phone);
  });

  it('encrypts and decrypts a Venmo handle round-trip', () => {
    const venmo = '@jane-doe';
    const encrypted = encrypt(venmo);
    expect(encrypted).not.toBe(venmo);
    expect(decrypt(encrypted)).toBe(venmo);
  });

  it('produces different ciphertext for different inputs', () => {
    expect(encrypt('aaa')).not.toBe(encrypt('bbb'));
  });
});
```

**Test protected route behavior — `src/components/layout/ProtectedRoute.test.tsx`:**

```tsx
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../test/render';
// Test that unauthenticated users see redirect
// Test that authenticated users see children
// Test that admin routes reject non-admin users
```

---

## Action 6: Set up the Claude Code testing loop

This is the core workflow you'll repeat for every phase going forward. Add this to your `CLAUDE.md` file (or create one) in the project root so Claude Code follows it automatically:

```markdown
# CLAUDE.md

## Testing requirements

Every new component, hook, or utility MUST have a co-located test file.
File naming convention: `ComponentName.test.tsx` or `utilName.test.ts`.

## Test-first workflow

When building any new feature:
1. Write the test file first with failing tests that describe expected behavior.
2. Implement the minimum code to make tests pass.
3. Refactor for clarity without breaking tests.
4. Run `npm test` and confirm all green before moving on.

## Code quality rules

- No `any` types. Use explicit TypeScript types for all props, state, and function signatures.
- No inline styles. Use Tailwind classes or CSS variable tokens from `tokens.css`.
- No hardcoded hex colors. Reference design tokens only.
- Keep components under 150 lines. Extract sub-components or hooks when exceeding this.
- Custom hooks must return typed objects, not tuples longer than 3 elements.
- All Supabase queries go through hooks in `/src/hooks/`, never called directly from components.
- Encrypt phone and Venmo before any database write. Never log or expose raw values.

## Test categories

### Unit tests (run on every change)
- Utility functions: crypto, Venmo deep link builder, date/time formatters
- Custom hooks: useAuth, usePosts, useClaims, useFollows
- Pure components: badges, pills, spot counters

### Integration tests (run before each commit)
- Auth flow: signup → onboarding → feed redirect
- Post creation: form submission → database insert → feed appearance
- Claim flow: claim → approve/reject → state update
- Route guards: protected routes, admin routes

### Manual smoke tests (run at phase completion)
- PWA install on iOS Safari
- Push notification receipt
- Venmo deep link opens correctly
- 390px viewport — no horizontal scroll

## When tests fail

Do not skip or delete failing tests. Fix the implementation to match the
expected behavior. If the test expectation is wrong, explain why before
changing it.
```

---

## Action 7: Add a pre-commit quality gate

Install lint and format tools if not already present:

```bash
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks
npm install -D prettier
npm install -D husky lint-staged
npx husky init
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "vitest related --run"
    ]
  }
}
```

Update `.husky/pre-commit`:

```bash
npx lint-staged
```

This means every commit automatically lints, formats, and runs only the tests related to the files you changed.

---

## Action 8: Create test templates for upcoming phases

Create `src/test/templates/` with starter test patterns you can copy for each phase:

**`src/test/templates/component.test.template.tsx`:**

```tsx
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../../test/render';
// import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders without crashing', () => {
    // renderWithProviders(<ComponentName />);
    // expect(screen.getByRole('...')).toBeInTheDocument();
  });

  it('displays the correct initial state', () => {
    // Test default props / empty state
  });

  it('handles user interaction', async () => {
    // const user = userEvent.setup();
    // renderWithProviders(<ComponentName />);
    // await user.click(screen.getByRole('button', { name: /submit/i }));
    // expect(...).toBe(...);
  });

  it('shows error state on failure', () => {
    // Override MSW handler to return error
    // Verify error message renders
  });
});
```

**`src/test/templates/hook.test.template.ts`:**

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
// import { useHookName } from './useHookName';

describe('useHookName', () => {
  it('returns initial state', () => {
    // const { result } = renderHook(() => useHookName());
    // expect(result.current.data).toBeNull();
    // expect(result.current.loading).toBe(true);
  });

  it('fetches data successfully', async () => {
    // const { result } = renderHook(() => useHookName());
    // await waitFor(() => expect(result.current.loading).toBe(false));
    // expect(result.current.data).toEqual(...);
  });

  it('handles errors gracefully', async () => {
    // Override MSW handler to return 500
    // Verify error state
  });
});
```

---

## Action 9: Establish your evaluation checklist

Use this checklist in Claude Code after completing each phase. Paste it as a prompt:

```
Review the code I just wrote for Phase [X]. Evaluate against these criteria:

STRUCTURE
- [ ] Files are under 150 lines
- [ ] No business logic in components — extracted to hooks or utils
- [ ] All types are explicit (no `any`)
- [ ] Supabase calls go through hooks, not directly in components

SIMPLICITY
- [ ] No premature abstractions — code does what's needed, nothing more
- [ ] State management is local unless shared across routes
- [ ] No duplicated logic across components

BEST PRACTICES
- [ ] All design tokens used (no hardcoded colors)
- [ ] RLS relied on for security, not frontend checks
- [ ] Encrypted fields never logged or exposed
- [ ] Soft deletes used, never hard deletes
- [ ] Error and loading states handled in every async flow

TESTING
- [ ] Every new file has a co-located test
- [ ] Tests cover happy path, error path, and edge cases
- [ ] MSW handlers updated for any new Supabase endpoints
- [ ] `npm test` passes with zero failures

Flag anything that fails and suggest specific fixes.
```

---

## Action 10: Run your first full test cycle

Execute this sequence now to validate the setup:

```bash
# 1. Verify tests run
npm test

# 2. Check coverage baseline
npm run test:coverage

# 3. Check TypeScript strictness
npx tsc --noEmit

# 4. Lint check
npx eslint src/ --ext .ts,.tsx

# 5. Build check (catches import errors tests miss)
npm run build
```

If any step fails, fix it before starting Phase 2. This becomes your "green baseline" — no phase is complete until all five commands pass clean.

---

## Ongoing workflow summary

For every phase going forward, the loop is:

1. **Read** the phase spec from the build prompt
2. **Write tests first** that describe acceptance criteria as assertions
3. **Build** the feature until tests pass
4. **Ask Claude Code** to evaluate against the checklist (Action 9)
5. **Run the five-command check** (Action 10)
6. **Manual smoke test** on mobile viewport
7. **Commit** — husky runs lint + related tests automatically

This keeps your codebase simple, well-structured, and verifiable at every step.
