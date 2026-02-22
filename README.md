# Word Trail (Trace de mots)

A French word-finding game built with SvelteKit, Tailwind CSS, and DaisyUI.

## How to Play

- Find French words (3-8 letters) on a 15x15 letter grid
- Words must be in a straight line (horizontal, vertical, or diagonal)
- Longer words = more points (length²)
- Find words quickly to build combos and earn bonus points!
- 5 minutes to find as many words as possible

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

The high score system requires a Turso database. Get one free at https://app.turso.tech.

### Run Development Server

```bash
npm run dev
```

Open http://localhost:5173

### Build

```bash
npm run build
```

## Features

- 15x15 letter grid with random French words
- Combo system (find words within 10 seconds to build streaks)
- Visual timer with color changes
- Word highlighting on the grid
- Online high scores (Turso database)
- Debug mode for testing (toggle in UI)

## Tech Stack

- SvelteKit
- Svelte 5 (with runes)
- Tailwind CSS + DaisyUI
- Turso (LibSQL) for online high scores
