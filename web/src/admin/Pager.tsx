import { useEffect, useState } from 'react';
import { pageWindow, paginate } from '../lib/paginate';

/** Client-side paging for a list that is already loaded. Resets to page 1 whenever `resetKey` changes (filters). */
export function usePaged<T>(items: T[], size = 25, resetKey = '') {
  const [page, setPage] = useState(1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a changed filter sends the list back to its first page
  useEffect(() => setPage(1), [resetKey]);
  const paged = paginate(items, page, size);
  return { ...paged, setPage };
}

export function Pager({
  page,
  pages,
  total,
  setPage,
}: {
  page: number;
  pages: number;
  total: number;
  setPage: (n: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="adm-pager" aria-label="Pages">
      <span className="mono muted">{total} items</span>
      <span className="grow" />
      <button
        type="button"
        className="adm-btn"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        ← Prev
      </button>
      {pageWindow(page, pages).map((n, i) =>
        n === '…' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static ellipsis markers
          <span key={`g${i}`} className="mono muted">
            …
          </span>
        ) : (
          <button
            type="button"
            key={n}
            className={`adm-btn${n === page ? ' solid' : ''}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => setPage(n)}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className="adm-btn"
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}
