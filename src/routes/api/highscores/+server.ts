import { json } from '@sveltejs/kit';
import { db, initDb } from '$lib/server/db';

let initialized = false;
let dictionary: Set<string> = new Set();

async function ensureInit() {
  if (!initialized) {
    await initDb();

    const result = await db.execute({
      sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='words'",
      args: []
    });

    if (result.rows.length === 0) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS words (
          word TEXT PRIMARY KEY
        )
      `);

      const frenchRaw = await import('an-array-of-french-words/index.json');
      const words = frenchRaw.default as string[];
      const normalized = words
        .map(w => w.normalize('NFD').replace(/[^a-zA-Z]/g, '').toUpperCase())
        .filter(w => w.length >= 3 && w.length <= 8);

      for (const word of new Set(normalized)) {
        await db.execute({
          sql: 'INSERT OR IGNORE INTO words (word) VALUES (?)',
          args: [word]
        });
      }
    }

    const dictResult = await db.execute({
      sql: 'SELECT word FROM words',
      args: []
    });
    for (const row of dictResult.rows) {
      dictionary.add(String(row.word));
    }

    initialized = true;
  }
}

interface GameState {
  createdAt: number;
}

const activeGames = new Map<string, GameState>();
const GAME_TTL = 10 * 60 * 1000;

function generateId(): string {
  return crypto.randomUUID();
}

export async function GET() {
  try {
    await ensureInit();

    const result = await db.execute({
      sql: 'SELECT name, score FROM high_scores ORDER BY score DESC LIMIT 10',
      args: []
    });

    const scores = result.rows.map(row => ({
      name: row.name,
      score: row.score
    }));

    return json(scores);
  } catch (error) {
    console.error('Failed to fetch high scores:', error);
    return json([]);
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    await ensureInit();

    const body = await request.json();
    const { action, gameId, name, foundWords, score } = body;

    console.log('Received POST:', { action, gameId, name, foundWords, score });

    if (action === 'start') {
      const id = generateId();
      activeGames.set(id, { createdAt: Date.now() });

      return json({ gameId: id });
    }

    if (action === 'submitScore') {
      if (!gameId || !activeGames.has(gameId)) {
        console.log('Invalid gameId:', gameId);
        return json({ error: 'Invalid game' }, { status: 400 });
      }

      const game = activeGames.get(gameId)!;
      const gameDuration = Date.now() - game.createdAt;
      const MIN_GAME_DURATION = 5 * 60 * 1000;

      if (gameDuration < MIN_GAME_DURATION) {
        console.log(`Game too short: ${gameDuration}ms (gameId: ${gameId})`);
        return json({ error: 'Game too short' }, { status: 400 });
      }

      if (!Array.isArray(foundWords) || foundWords.length === 0 || typeof score !== 'number') {
        console.log('Invalid data:', { foundWords, score });
        return json({ error: 'Invalid data' }, { status: 400 });
      }

      for (const word of foundWords) {
        if (!dictionary.has(word)) {
          console.log('Invalid word:', word);
          return json({ error: `Invalid word: ${word}` }, { status: 400 });
        }
      }

      activeGames.delete(gameId);

      const MAX_NAME_LENGTH = 3;
      const cleanedName = name?.toString().toUpperCase().slice(0, MAX_NAME_LENGTH) || '';

      if (cleanedName.length !== MAX_NAME_LENGTH || !/^[A-Z]{3}$/.test(cleanedName)) {
        console.log('Invalid name format:', cleanedName);
        return json({ error: 'Invalid name format' }, { status: 400 });
      }

      await db.execute({
        sql: 'INSERT INTO high_scores (name, score) VALUES (?, ?)',
        args: [cleanedName, score]
      });

      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('API error:', error);
    return json({ error: 'Server error' }, { status: 500 });
  }
}
