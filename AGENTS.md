# Repository Guidelines

## Project Structure

This repository contains a Vite and React application with TypeScript. The main UI is in `App.tsx` and `components/`; shared types are in `types.ts`, and AI provider and story-generation logic is in `services/`. Vercel serverless endpoints live in `api/` (`generate.js` and `verify.js`). Keep one file per endpoint path: Vercel treats `generate.js` and `generate.ts` as conflicting routes. Static assets and policy pages are in `public/`; automated tests are in `tests/`.

## Development and Build Commands

- `npm install` installs dependencies from the lockfile.
- `npm run dev` starts the Vite development server on port 3000, including local `/api` middleware.
- `npm test` runs the Node test suite in `tests/*.test.mjs`.
- `npx tsc --noEmit` checks TypeScript without generating output.
- `npm run build` creates the production frontend bundle in `dist/`.
- `npm run preview` serves the built frontend locally.

## Code Style

Use two spaces for indentation, semicolons in TypeScript and JavaScript, and single quotes in server code. Keep React components in PascalCase filenames (for example, `StoryDisplay.tsx`), service modules in camelCase, and tests named `*.test.mjs`. Reuse the existing TypeScript types and keep provider credentials on the server; never place `GROQ_API_KEY` or other secrets in client code or commit them.

## Testing Guidelines

Add or update Node tests for API handling, staged generation, and story-quality behavior. Run `npm test`, `npx tsc --noEmit`, and `npm run build` before proposing deployment. For changes to AI routes, check validation and error responses without exposing provider keys or raw sensitive diagnostics.

## Commits and Pull Requests

Use concise, imperative commit subjects, such as `Fix API route validation`. Pull requests should describe user-visible changes, list verification commands and results, and include screenshots for meaningful UI changes. Confirm the Vercel Preview is ready before merging or promoting to production.
