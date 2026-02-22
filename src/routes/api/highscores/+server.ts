import { json } from '@sveltejs/kit';
import { db, initDb } from '$lib/server/db';

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
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
    
    const { name, score } = await request.json();
    
    if (!name || typeof score !== 'number') {
      return json({ error: 'Invalid data' }, { status: 400 });
    }
    
    await db.execute({
      sql: 'INSERT INTO high_scores (name, score) VALUES (?, ?)',
      args: [name.toUpperCase(), score]
    });
    
    return json({ success: true });
  } catch (error) {
    console.error('Failed to save high score:', error);
    return json({ error: 'Failed to save' }, { status: 500 });
  }
}
