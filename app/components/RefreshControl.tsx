'use client';

import { useState, useTransition } from 'react';
import { RefreshCcw } from 'lucide-react';
import { refreshLiveData } from '../actions/refresh';

export function RefreshControl() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="refreshControl">
      <button
        className="iconButton primary"
        type="button"
        aria-label="Refresh live data"
        title="Refresh live data"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await refreshLiveData();
            setMessage(result.ok ? `Updated ${result.date}` : result.message ?? 'Refresh failed');
          });
        }}
      >
        <RefreshCcw size={18} className={isPending ? 'spin' : undefined} />
        <span>{isPending ? 'Refreshing' : 'Refresh'}</span>
      </button>
      {message ? <span className="refreshMessage">{message}</span> : null}
    </div>
  );
}
