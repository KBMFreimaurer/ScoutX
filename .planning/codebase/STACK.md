# Technology Stack

**Analysis Date:** 2026-04-02

## Languages

**Primary:**
- JavaScript (ES2022+) - Frontend application code
- JavaScript (Node.js) - Adapter service backend

**Secondary:**
- JSX - React component markup in `.jsx` files

## Runtime

**Environment:**
- Node.js 22 (Alpine) - Both development and production
- Browser (ES2022+ compatible) - Frontend execution

**Package Manager:**
- npm - Version managed via package-lock.json
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- React 19.0.0 - UI framework for building components
- React Router 6.30.1 - Client-side routing and navigation
- React DOM 19.0.0 - React DOM rendering

**Build/Dev:**
- Vite 6.0.0 - Frontend build tool and dev server
- Vitest 2.1.8 - Unit testing framework (ESM-native, jsdom environment)
- Vite React Plugin (@vitejs/plugin-react 4.3.4) - Fast refresh and JSX handling

**Testing:**
- @testing-library/react 16.1.0 - React component testing utilities
- @testing-library/jest-dom 6.6.3 - Custom matchers for DOM assertions
- jsdom 25.0.1 - Lightweight DOM implementation for tests

**Linting/Formatting:**
- ESLint 9.22.0 - Code linting and style enforcement
- eslint-plugin-react 7.37.5 - React-specific linting rules
- eslint-plugin-react-hooks 5.2.0 - React Hooks linting rules
- eslint-plugin-react-refresh 0.4.18 - React Refresh linting
- @eslint/js 9.22.0 - ESLint core JavaScript rules
- Prettier 3.4.2 - Code formatter (double quotes, trailing commas, 120 char width)

**Utilities:**
- globals 15.14.0 - Provides global environment constants for ESLint

## Key Dependencies

**Critical:**
- react 19.0.0 - Core UI rendering and state management
- react-router-dom 6.30.1 - Navigation and multi-page support
- react-dom 19.0.0 - DOM rendering target for React

**Infrastructure:**
- vite 6.0.0 - Native ES modules build and HMR development server
- vitest 2.1.8 - Fast unit testing with jsdom environment

## Configuration

**Environment:**
- Environment variables used for:
  - Ollama API endpoint: `OLLAMA_HOST` (default: `http://localhost:11434/`)
  - Adapter service configuration: `ADAPTER_HOST`, `ADAPTER_PORT`, `ADAPTER_TOKEN`
  - CORS configuration: `CORS_ORIGIN`

**Build:**
- `vite.config.js` - Vite configuration with React plugin and test setup
- `eslint.config.js` - ESLint configuration with React and React Hooks plugins
- `.prettierrc` - Prettier formatting rules (semi: true, singleQuote: false, trailingComma: all, printWidth: 120)
- `tsconfig.json` - Not used (project is JavaScript, not TypeScript)

## Platform Requirements

**Development:**
- Node.js 22+ (Alpine Linux container)
- npm package manager
- Optional: Ollama for local LLM (defaults to http://localhost:11434/)

**Production:**
- Node.js 22 (Alpine) for build stage
- Nginx Alpine container for serving built static assets
- Optional: Ollama service for AI integration
- Optional: Adapter service (Node.js 22 Alpine) for live game data

---

*Stack analysis: 2026-04-02*
