export default {
  async fetch(request) {
    try {
      const rssUrl = 'https://www.notus.org/index.rss';
      const response = await fetch(rssUrl);
      const xml = await response.text();
      
      const items = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      
      while ((match = itemRegex.exec(xml)) !== null && items.length < 12) {
        const itemXml = match[1];
        
        const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
        const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
        
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Untitled';
        const summary = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').slice(0, 180) : '';
        const link = linkMatch ? linkMatch[1] : '#';
        
        items.push({
          source: 'NOTUS',
          title,
          summary,
          link
        });
      }
      
      return new Response(JSON.stringify({ items }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
