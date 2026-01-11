# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + TypeScript app. Key areas: `src/pages/` for routes, `src/components/` for UI and dashboard pieces, `src/hooks/` for reusable logic, `src/lib/` for helpers, `src/types/` for shared types.
- `public/` holds static assets (icons, robots.txt, favicon).
- `supabase/` stores Supabase config used by integrations in `src/integrations/supabase/`.
- `dist/` is build output from Vite. Treat as generated.

## Build, Test, and Development Commands
- `npm run dev`: start the Vite dev server with hot reload.
- `npm run build`: production build into `dist/`.
- `npm run build:dev`: build using the development mode config.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint across the codebase.

## Coding Style & Naming Conventions
- Language: TypeScript + React (TSX). Prefer functional components and hooks.
- Indentation: 2 spaces (match existing TS/TSX files).
- Naming: `PascalCase` for components/types, `camelCase` for functions/variables, `kebab-case` for asset files.
- Styling: Tailwind CSS classes in components; base styles live in `src/index.css` and `src/App.css`.
- Linting: ESLint config in `eslint.config.js`; keep `dist/` excluded.

## Testing Guidelines
- No test runner is configured in `package.json`. If you add tests, document the framework and add a script (e.g., `npm test`).
- Suggested conventions: co-locate tests under `src/` with `.test.ts(x)` names.

## Commit & Pull Request Guidelines
- Commit messages use short, imperative subjects with initial caps (e.g., `Fix leverage opportunity spread sign`, `Add logos to all markets`).
- PRs should include a concise description, link related issues, and add screenshots for UI changes. Note any manual testing you performed.

## Configuration & Secrets
- Use `.env` for local secrets and keep it out of version control.
- When changing Supabase configuration, keep `supabase/config.toml` and `src/integrations/supabase/` in sync.
