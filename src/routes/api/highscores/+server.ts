import { json } from '@sveltejs/kit';
import { db, initDb } from '$lib/server/db';

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
}

const MAX_NAME_LENGTH = 3;
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 3;
const GRID_SIZE = 15;

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function wordInGrid(grid: string[][], word: string): boolean {
  const directions = [
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
    
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    if (!rateLimitMap.get(ip) || Date.now() - (rateLimitMap.get(ip)?.windowStart || 0) > RATE_LIMIT_WINDOW) {
      rateLimitMap.set(ip, { count: 0, windowStart: Date.now() });
    }
    const rateRecord = rateLimitMap.get(ip)!;
    
    if (rateRecord.count >= MAX_SUBMISSIONS_PER_WINDOW) {
      return json({ error: 'Too many requests' }, { status: 429 });
    }
    rateRecord.count++;
    
    const body = await request.json();
    const { name, score, grid, words } = body;
    
    if (!name || typeof score !== 'number') {
      return json({ error: 'Invalid data' }, { status: 400 });
    }
    
    const cleanedName = name.toUpperCase().slice(0, MAX_NAME_LENGTH);
    if (cleanedName.length !== MAX_NAME_LENGTH || !/^[A-Z]{3}$/.test(cleanedName)) {
      return json({ error: 'Invalid name format' }, { status: 400 });
    }
    
    if (!Array.isArray(grid) || grid.length !== GRID_SIZE || !Array.isArray(grid[0]) || grid[0].length !== GRID_SIZE) {
      return json({ error: 'Invalid grid' }, { status: 400 });
    }
    
    if (!Array.isArray(words) || words.length === 0) {
      return json({ error: 'No words submitted' }, { status: 400 });
    }
    
    for (const word of words) {
      if (!wordInGrid(grid, word)) {
        return json({ error: `Word not in grid: ${word}` }, { status: 400 });
      }
    }
    
    await db.execute({
      sql: 'INSERT INTO high_scores (name, score) VALUES (?, ?)',
      args: [cleanedName, score]
    });
    
    return json({ success: true });
  } catch (error) {
    console.error('Failed to save high score:', error);
    return json({ error: 'Failed to save' }, { status: 500 });
  }
}
