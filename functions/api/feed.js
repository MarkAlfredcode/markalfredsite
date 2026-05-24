export async function onRequest(context) {
  try {
    const response = await fetch('https://www.notus.org/index.rss');
    const xml = await response.text();
    
    // Parse RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = [];
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
      
      // Strip HTML tags from description
      const summary = descMatch 
        ? descMatch[1].replace(/<[^>]*>/g, '').trim()
        : '';
      
      const title = titleMatch
        ? titleMatch[1].replace(/<[^>]*>/g, '').trim()
        : '';
      
      items.push({
        source: 'NOTUS',
        title: title,
        summary: summary,
        link: linkMatch ? linkMatch[1].trim() : ''
      });
    }
    
    // Return up to 12 items
    return new Response(JSON.stringify(items.slice(0, 12)), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minute cache
      }
    });
  } catch (error) {
    console.error('Feed fetch error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
