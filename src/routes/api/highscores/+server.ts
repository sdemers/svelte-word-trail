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
  grid: string[][];
}

const GRID_SIZE = 15;

const activeGames = new Map<string, GameState>();

function generateId(): string {
  return crypto.randomUUID();
}

function wordInGrid(grid: string[][], word: string): boolean {
  const directions: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[row][col] !== word[0]) continue;
      
      for (const [dr, dc] of directions) {
        let r = row;
        let c = col;
        let match = true;
        
        for (let i = 1; i < word.length; i++) {
          r += dr;
          c += dc;
          if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE || grid[r][c] !== word[i]) {
            match = false;
            break;
          }
        }
        
        if (match) return true;
      }
    }
  }
  
  return false;
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
    const { action, gameId, name, grid } = body;

    if (action === 'start') {
      if (!Array.isArray(grid) || grid.length !== GRID_SIZE || !Array.isArray(grid[0]) || grid[0].length !== GRID_SIZE) {
        return json({ error: 'Invalid grid' }, { status: 400 });
      }
      
      const id = generateId();
      activeGames.set(id, { createdAt: Date.now(), foundWords: [], score: 0, lastTime: 0, streak: 0, grid });

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

      if (!wordInGrid(game.grid, normalizedWord)) {
        return json({ error: `${word} n'est pas sur la grille.`, foundWords: game.foundWords, score: game.score });
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
