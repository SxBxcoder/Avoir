/**
 * Proxy for Shadow Clone SSE stream
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Call Python backend running on port 8000
    const response = await fetch('http://localhost:8000/api/shadow-clone/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend Error: ${response.status}`);
    }

    // Return the SSE stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Shadow Clone Proxy Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Stream failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
