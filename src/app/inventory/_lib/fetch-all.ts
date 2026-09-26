// PostgREST returns at most `max-rows` (1000 on Supabase by default) per request, so a
// bare `.limit(5000)` silently yields 1000 rows. This walks the result set in fixed-size
// ranges instead, and reports when it stopped at `maxRows` rather than at the end.
export type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export type FetchAllResult<T> = {
  rows: T[];
  error: string | null;
  /** True when `maxRows` was reached and more rows may exist. */
  truncated: boolean;
};

export const DEFAULT_PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  fetchRange: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: { maxRows: number; pageSize?: number },
): Promise<FetchAllResult<T>> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const rows: T[] = [];

  while (rows.length < options.maxRows) {
    const from = rows.length;
    const to = Math.min(from + pageSize, options.maxRows) - 1;
    const { data, error } = await fetchRange(from, to);

    if (error) return { rows: [], error: error.message, truncated: false };

    const page = data ?? [];
    rows.push(...page);

    // A short page means the result set is exhausted.
    if (page.length < to - from + 1) return { rows, error: null, truncated: false };
  }

  return { rows, error: null, truncated: true };
}
