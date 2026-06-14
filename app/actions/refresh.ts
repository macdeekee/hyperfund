'use server';

import { revalidatePath } from 'next/cache';
import { fetchLiveAndPersistSnapshot } from '../lib/hyperfund-repository';

export async function refreshLiveData() {
  try {
    const snapshot = await fetchLiveAndPersistSnapshot({ refresh: true });
    revalidatePath('/');

    return {
      ok: true,
      date: snapshot.date,
      capturedAt: snapshot.capturedAt
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unable to refresh live data'
    };
  }
}
