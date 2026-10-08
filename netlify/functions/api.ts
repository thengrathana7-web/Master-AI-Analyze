export const handler = async (event: any, context?: any) => {
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '');
  const method = event.httpMethod;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (path === '/status' || path === '') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'ONLINE',
        service: 'Step Index Master AI Serverless Gateway',
        timestamp: Date.now(),
        platform: 'Netlify Functions',
      }),
    };
  }

  if (path === '/telegram/test' && method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const token = body.botToken || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = body.chatId || process.env.TELEGRAM_CHAT_ID;

      if (!token || !chatId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing Telegram token or chat ID' }),
        };
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔥 *STEP INDEX MASTER AI* (Netlify)\n\n✅ *Telegram Alert Channel Test*\n⏱ *Timestamp:* ${new Date().toISOString()}`,
          parse_mode: 'Markdown',
        }),
      });

      const resData = await res.json();
      return {
        statusCode: resData.ok ? 200 : 400,
        headers,
        body: JSON.stringify(resData.ok ? { success: true } : { success: false, error: resData.description }),
      };
    } catch (e: any) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: e.message }),
      };
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: 'Endpoint not found' }),
  };
};
