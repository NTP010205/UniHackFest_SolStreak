# Using the SolStreak ZIP

## A. What the ZIP contains

The ZIP contains the complete repository source: the independent `web_app` Next.js full-stack application, database schema/migrations and tests, scripts, documentation, and design-asset directories.

## B. What the ZIP does not contain

It must not contain `node_modules`, `.next`, `.env.local`, database credentials, RPC credentials, temporary design exports, or generated caches. Environment values are provided separately by the project owner.

## C. Extracting on Windows

Use File Explorer to extract the whole archive into a normal folder. Do not run npm commands inside the compressed archive.

## D. Recommended WSL location

For faster and more reliable Node.js filesystem access, copy the extracted source from Windows into the WSL home filesystem.

```bash
cp -r /mnt/c/Users/<WindowsUser>/Downloads/UniHackFest_SolStreak ~/
```

## E. Install and run

```bash
cd ~/UniHackFest_SolStreak/web_app
npm ci
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>. Ask the project owner for required environment values. Do not put credentials in documentation or commit `.env.local`.

## F. Open in VS Code

```bash
code ~/UniHackFest_SolStreak
```

With VS Code Remote - WSL installed, open the repository from WSL so extensions and npm run in Linux.

## G. Verify the source

Run from `~/UniHackFest_SolStreak/web_app`:

```bash
npm test
npx tsc --noEmit
npm run build
```

## H. Optional PostgreSQL integration tests

PostgreSQL integration suites are optional and require dedicated rehearsal environment variables. Normal `npm test` does not execute them. Do not run them unless the project owner has provided an isolated rehearsal database.

## I. Database safety

Do not use the application database to test migrations or integration harnesses. Frontend-only work does not require database migrations.

## J. Create a frontend branch

```bash
git switch -c frontend-redesign
```

Keep presentation changes separate and preserve the API and backend invariants documented under `docs/`.

## K. Project structure

```text
UniHackFest_SolStreak/
├── web_app/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/          # Backend API routes
│   │   │   └── dashboard/    # Frontend dashboard
│   │   ├── components/       # Frontend UI
│   │   ├── hooks/
│   │   └── lib/              # Domain/backend/shared logic
│   ├── db/
│   ├── scripts/
│   ├── package.json
│   └── application config files
├── design_assets/
│   ├── badges/
│   ├── logo/
│   └── wheel/
├── docs/
├── .gitignore
├── .gitattributes
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## L. Troubleshooting

- **npm command uses the wrong directory:** confirm `pwd` ends with `UniHackFest_SolStreak/web_app`.
- **Missing `.env.local`:** copy `.env.local.example`, then ask the owner for values.
- **Port 3000 is busy:** stop the existing process or run `npm run dev -- --port 3001`.
- **Dependencies are missing:** run `npm ci` inside `web_app`.
- **A `NEXT_PUBLIC_` value changed but UI did not:** restart the development server so Next.js can inline it again.
- **WSL access under `/mnt/c` is slow:** copy the repository into `~/` and reinstall dependencies there.
