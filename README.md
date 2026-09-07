# FileDrop

A private, temporary file-sharing application for transferring files between devices quickly using share links and QR codes.

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- npm

## Setup

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

### 2. Install dependencies

```bash
npm install
``` 

### 3. Run database migrations

```bash
npm run migrate
```

### 4. Start development servers

```bash
npm run dev
```

This starts both the frontend (http://localhost:5173) and backend (http://localhost:5000).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend |
| `npm run dev:api` | Start backend only |
| `npm run dev:web` | Start frontend only |
| `npm run migrate` | Run database migrations |
| `npm run migrate:rollback` | Rollback last migration |
| `npm run build` | Build both apps |
| `npm run lint` | Lint both apps |
| `npm run typecheck` | Type-check both apps |

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express + TypeScript
- **Database:** PostgreSQL
- **Monorepo:** npm workspaces

## Project Structure

```
filedrop/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Express backend
├── packages/
│   └── shared/       # Shared types/constants
├── storage/          # File storage
├── database/         # Migrations
├── tests/            # Tests
└── docker-compose.yml
```
