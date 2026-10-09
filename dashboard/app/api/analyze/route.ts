import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const backendUrl = process.env.ANALYSIS_BACKEND_URL ?? "http://localhost:8000";
  const body = await request.text();
  try {
    const response = await fetch(backendUrl + "/api/analyze-frames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Analysis backend unavailable. Start the Node.js backend on port 8000." }, { status: 503 });
  }
}
