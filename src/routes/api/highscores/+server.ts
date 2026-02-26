import { json } from '@sveltejs/kit';
import { db, initDb } from '$lib/server/db';

let initialized = false;
let dictionary: Set<string> = new Set();

async function ensureInit() {
  if (!initialized) {
    await initDb();

    const frenchRaw = await import('an-array-of-french-words/index.json');
    const words = frenchRaw.default as string[];
    const normalized = words
      .map(w => w.normalize('NFD').replace(/[^a-zA-Z]/g, '').toUpperCase())
      .filter(w => w.length >= 4 && w.length <= 15);

    for (const word of new Set(normalized)) {
      dictionary.add(word);
    }

    console.log(`Dictionnaire chargé avec ${dictionary.size} mots.`);

    initialized = true;
  }
}

interface GameState {
  createdAt: number;
  foundWords: string[];
  score: number;
  lastTime: number;
  streak: number;
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
    const { action, gameId, name } = body;

    if (action === 'start') {
      const id = generateId();
      activeGames.set(id, { createdAt: Date.now(), foundWords: [], score: 0, lastTime: 0, streak: 0 });

      return json({ gameId: id });
    }

    if (action === 'submitWord') {
      if (!gameId || !activeGames.has(gameId)) {
        return json({ error: 'Partie invalide.' }, { status: 400 });
      }

      const { word } = body;
      if (!word || typeof word !== 'string') {
        return json({ error: 'Mot invalide.' }, { status: 400 });
      }

      const game = activeGames.get(gameId)!;
      const normalizedWord = word.normalize('NFD').replace(/[^a-zA-Z]/g, '').toUpperCase();

      if (game.foundWords.includes(normalizedWord)) {
        return json({ error: `${word} déjà trouvé.`, foundWords: game.foundWords, score: game.score });
      }

      if (!dictionary.has(normalizedWord)) {
        return json({ error: `${word} n'est pas dans le dictionnaire.`, foundWords: game.foundWords, score: game.score });
      }

      game.foundWords.push(normalizedWord);

      const wordLength = normalizedWord.length;
      const now = Date.now();
      
      if (now - game.lastTime < 10000 && game.lastTime > 0) {
        game.streak = Math.min(game.streak + 1, 10);
      } else {
        game.streak = 1;
      }
      game.lastTime = now;
      
      const baseScore = wordLength * wordLength;
      const bonus = game.streak >= 2 ? game.streak * 15 : 0;
      game.score += baseScore + bonus;

      return json({ success: true, foundWords: game.foundWords, score: game.score, streak: game.streak });
    }

    if (action === 'submitScore') {
      if (!gameId || !activeGames.has(gameId)) {
        return json({ error: 'Partie invalide.' }, { status: 400 });
      }

      const game = activeGames.get(gameId)!;
      //const gameDuration = Date.now() - game.createdAt;
      //const MIN_GAME_DURATION = 5 * 60 * 1000;

      // if (gameDuration < MIN_GAME_DURATION) {
      //   return json({ error: 'Partie trop courte ! Petit tricheur :P' }, { status: 400 });
      // }

      activeGames.delete(gameId);

      const MAX_NAME_LENGTH = 3;
      const cleanedName = name?.toString().toUpperCase().slice(0, MAX_NAME_LENGTH) || '';

      if (cleanedName.length !== MAX_NAME_LENGTH || !/^[A-Z]{3}$/.test(cleanedName)) {
        return json({ error: 'Format de nom invalide.' }, { status: 400 });
      }

      await db.execute({
        sql: 'INSERT INTO high_scores (name, score) VALUES (?, ?)',
        args: [cleanedName, game.score]
      });

      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('API error:', error);
    return json({ error: 'Server error' }, { status: 500 });
  }
}
