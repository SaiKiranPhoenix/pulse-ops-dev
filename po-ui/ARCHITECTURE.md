# po-ui Frontend Structure

`po-ui` is the PulseOps observability dashboard micro-frontend. It uses Vite, React, React Router, Tailwind CSS, and ShadCN UI components.

## Folder Rules

- `src/pages`: route-level components only.
- `src/pages/auth`: login and register pages.
- `src/pages/dashboard`: overview, logs, metrics, traces, alerts/incidents, and vault pages.
- `src/routes`: React Router tree and protected route wrapper.
- `src/components/ui`: ShadCN-generated UI primitives only.
- `src/components/charts`: Recharts/Chart.js wrappers.
- `src/components/layout`: sidebar, header, and app shell.
- `src/features`: feature-first code by domain.
- `src/features/*/components`: feature-specific UI composition.
- `src/features/*/hooks`: feature-specific hooks.
- `src/features/*/api.ts`: feature API calls.
- `src/hooks`: shared hooks.
- `src/lib/api-client.ts`: Axios client with JWT attachment.
- `src/lib/socket-client.ts`: Socket.IO client setup.
- `src/store`: Zustand/Redux slices.
- `src/types`: shared frontend types.
- `src/utils`: generic frontend helpers.
- `src/styles/globals.css`: Tailwind and ShadCN global styles.
- `src/App.tsx`: root component mounting `AppRoutes`.
- `src/main.tsx`: Vite React entry point.

## UI Rules

- Use ShadCN components for buttons, inputs, dialogs, dropdowns, tables, tabs, toasts, and forms.
- Do not hand-build generic UI primitives that ShadCN provides.
- Use lucide-react icons.
- Keep the dashboard operational, dense, and scannable.
- Never display secret values outside explicit reveal/fetch flows.
- Clear revealed secret values when modals close.
