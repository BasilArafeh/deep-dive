/**
 * Server-side SSE proxy for report chat.
 * Streams token chunks from the backend without buffering.
 */

import { NextResponse } from "next/server";

/**
 * Proxy POST /api/chat → backend /api/chat with X-API-Key.
 */
export async function POST(request: Request): Promise<Response> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "config", message: "API configuration is incomplete." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "network", message: "Unable to reach the chat service." },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await upstream.json();
      return NextResponse.json(payload, { status: upstream.status });
    }
    const text = await upstream.text();
    return NextResponse.json(
      { error: "upstream", message: text || "Chat request failed." },
      { status: upstream.status },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
