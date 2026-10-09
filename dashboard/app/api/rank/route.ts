import { NextResponse } from "next/server";

type RankItem = {
  id?: string;
  initialOxygenPct?: number | null;
  finalOxygenPct?: number | null;
  initialCoPpm?: number | null;
  finalCoPpm?: number | null;
};

function score(item: RankItem) {
  const oxygen = item.initialOxygenPct == null || item.finalOxygenPct == null ? null : Math.abs(item.finalOxygenPct - item.initialOxygenPct) * 20;
  const co = item.initialCoPpm == null || item.finalCoPpm == null ? null : Math.max(0, item.finalCoPpm - item.initialCoPpm) / 2;
  const values = [oxygen, co].filter((value): value is number => value != null);
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export async function POST(request: Request) {
  const body = await request.json() as { experiments?: RankItem[] };
  const ranked = (body.experiments ?? []).map((item) => ({
    experiment_id: item.id,
    score: score(item),
    evidence: [
      item.initialOxygenPct != null && item.finalOxygenPct != null ? "oxygen change" : null,
      item.initialCoPpm != null && item.finalCoPpm != null ? "CO change" : null
    ].filter(Boolean)
  })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return NextResponse.json({
    ranked,
    warning: "Prototype comparison score, not an official NASA safety rating. Missing measurements are omitted."
  });
}
