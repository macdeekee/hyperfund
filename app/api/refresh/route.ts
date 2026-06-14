import { NextResponse } from 'next/server';
import { fetchLiveAndPersistSnapshot } from '../../lib/hyperfund-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const snapshot = await fetchLiveAndPersistSnapshot({ refresh: true });
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to refresh HyperFund data'
      },
      { status: 502 }
    );
  }
}

export async function GET() {
  return POST();
}
