const KEY = 'scores';
const MAX_STORED = 100;
const MAX_RETURNED = 20;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request, env) {
    const kv = env.WARCHEST_LEADERBOARD;
    if (!kv) return json({ error: 'leaderboard not configured' }, 500);

    if (request.method === 'GET') {
      const raw = await kv.get(KEY);
      const scores = raw ? JSON.parse(raw) : [];
      return json({ scores: scores.slice(0, MAX_RETURNED) });
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: 'invalid JSON' }, 400);
      }

      let name = (body && body.name != null ? String(body.name) : '').trim().slice(0, 20);
      name = name.replace(/[^\w \-'.]/g, '');
      if (!name) name = 'Anonymous';

      const streak = parseInt(body && body.streak, 10);
      if (!Number.isFinite(streak) || streak < 0 || streak > 500) {
        return json({ error: 'invalid streak' }, 400);
      }

      const raw = await kv.get(KEY);
      let scores = raw ? JSON.parse(raw) : [];
      scores.push({ name, streak, date: new Date().toISOString().slice(0, 10) });
      scores.sort(function (a, b) { return b.streak - a.streak; });
      scores = scores.slice(0, MAX_STORED);
      await kv.put(KEY, JSON.stringify(scores));

      return json({ scores: scores.slice(0, MAX_RETURNED) });
    }

    return json({ error: 'method not allowed' }, 405);
  }
};
