import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const backendUrl = process.env.ANALYSIS_BACKEND_URL ?? "http://localhost:8000";
  try {
    const body = await request.json() as { experiments?: Array<{ id?: string }> };
    const response = await fetch(backendUrl + "/api/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: (body.experiments ?? []).map((item) => ({ experiment_id: item.id, analysis: {} })) }),
      cache: "no-store"
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Ranking backend unavailable. Start the Node.js backend on port 8000." }, { status: 503 });
  }
}
