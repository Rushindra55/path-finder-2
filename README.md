# GitHub Profile Finder

A React app built with Vite and Node.js. Search public GitHub profiles to view profile details, repository statistics, recent activity, language usage, and contribution history.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

Open PowerShell or Command Prompt in the project folder. Do not open `index.html`
directly or use the VS Code Live Server extension; React and its dependencies are
served by Vite.

```sh
npm install
npm start
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The app
uses the public GitHub API and does not require an API key.

## Production build

```sh
npm run build
npm run preview
```

The production files are generated in `dist/`.
