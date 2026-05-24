export default {
  async fetch(request) {
    try {
      const response = await fetch('https://www.notus.org/index.rss');
      const xml = await response.text();
      
      // Parse RSS items
      const items = [];
      const itemMatches = xml.matchAll(/<item>(.*?)<\/item>/gs);
      
      for (const match of itemMatches) {
        const itemXml = match[1];
        
        const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
        const descMatch = itemXml.match(/<description>(.*?)<\/description>/);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        
        items.push({
          source: 'NOTUS',
          title: titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Untitled',
          summary: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').substring(0, 150) : '',
          link: linkMatch ? linkMatch[1] : '#'
        });
        
        if (items.length >= 12) break;
      }
      
      return new Response(JSON.stringify({ items }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch feed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
