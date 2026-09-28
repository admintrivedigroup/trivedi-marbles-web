// A tiny in-memory stand-in for the Supabase query builder, covering just the calls the
// inventory code makes (select / insert / update / delete / upsert with eq, neq, in, lt,
// gte, is filters). Rows are plain objects, so embedded relations such as `slab_statuses(name)`
// are seeded directly on the row. `failWhen` lets a test make a specific write fail.
type Row = Record<string, unknown>;
type Filter = { kind: "eq" | "neq" | "in" | "lt" | "gte" | "is"; column: string; value: unknown };
type Op = "select" | "insert" | "update" | "delete" | "upsert";

export type FailContext = { table: string; op: Op; payload: unknown; filters: Filter[] };

export type FakeDbOptions = {
  failWhen?: (ctx: FailContext) => string | null;
  user?: { id: string; email: string } | null;
};

function matches(row: Row, filter: Filter): boolean {
  const v = row[filter.column];
  switch (filter.kind) {
    case "eq":
      return String(v) === String(filter.value);
    case "neq":
      return String(v) !== String(filter.value);
    case "in":
      return (filter.value as unknown[]).map(String).includes(String(v));
    case "lt":
      return v != null && String(v) < String(filter.value);
    case "gte":
      return v != null && String(v) >= String(filter.value);
    case "is":
      return filter.value === null ? v == null : v === filter.value;
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function createFakeDb(seed: Record<string, Row[]>, options: FakeDbOptions = {}) {
  const tables: Record<string, Row[]> = clone(seed);
  let idCounter = 0;
  const writes: { table: string; op: Op; payload: unknown; filters: Filter[] }[] = [];

  function from(table: string) {
    tables[table] ??= [];
    let op: Op = "select";
    let payload: unknown = null;
    let returning = false;
    let rangeWindow: [number, number] | null = null;
    const filters: Filter[] = [];

    const execute = (): { data: unknown; error: { message: string } | null } => {
      const failure = options.failWhen?.({ table, op, payload, filters });
      if (failure) return { data: null, error: { message: failure } };

      const rows = tables[table];
      const hit = rows.filter((row) => filters.every((f) => matches(row, f)));
      if (op !== "select") writes.push({ table, op, payload, filters: [...filters] });

      switch (op) {
        case "select":
          return { data: clone(rangeWindow ? hit.slice(rangeWindow[0], rangeWindow[1] + 1) : hit), error: null };
        case "insert": {
          const incoming = clone((Array.isArray(payload) ? payload : [payload]) as Row[]);
          for (const row of incoming) row.id ??= `gen-${++idCounter}`;
          rows.push(...incoming);
          return { data: returning ? clone(incoming) : null, error: null };
        }
        case "upsert": {
          rows.push(...clone((Array.isArray(payload) ? payload : [payload]) as Row[]));
          return { data: null, error: null };
        }
        case "update":
          for (const row of hit) Object.assign(row, payload as Row);
          return { data: returning ? clone(hit) : null, error: null };
        case "delete":
          tables[table] = rows.filter((row) => !hit.includes(row));
          return { data: returning ? clone(hit) : null, error: null };
      }
    };

    const builder = {
      select() {
        if (op !== "select") returning = true;
        return builder;
      },
      insert(rows: unknown) {
        op = "insert";
        payload = rows;
        return builder;
      },
      upsert(rows: unknown) {
        op = "upsert";
        payload = rows;
        return builder;
      },
      update(values: unknown) {
        op = "update";
        payload = values;
        return builder;
      },
      delete() {
        op = "delete";
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push({ kind: "eq", column, value });
        return builder;
      },
      neq(column: string, value: unknown) {
        filters.push({ kind: "neq", column, value });
        return builder;
      },
      in(column: string, value: unknown[]) {
        filters.push({ kind: "in", column, value });
        return builder;
      },
      lt(column: string, value: unknown) {
        filters.push({ kind: "lt", column, value });
        return builder;
      },
      gte(column: string, value: unknown) {
        filters.push({ kind: "gte", column, value });
        return builder;
      },
      is(column: string, value: unknown) {
        filters.push({ kind: "is", column, value });
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      range(from: number, to: number) {
        rangeWindow = [from, to];
        return builder;
      },
      maybeSingle() {
        const { data, error } = execute();
        return Promise.resolve({ data: ((data as Row[] | null) ?? [])[0] ?? null, error });
      },
      single() {
        const { data, error } = execute();
        const first = ((data as Row[] | null) ?? [])[0];
        return Promise.resolve(
          first ? { data: first, error } : { data: null, error: error ?? { message: "No rows found" } },
        );
      },
      then<R>(resolve: (value: { data: unknown; error: { message: string } | null }) => R) {
        return Promise.resolve(execute()).then(resolve);
      },
    };
    return builder;
  }

  const user = options.user === undefined ? { id: "user-1", email: "tester@example.com" } : options.user;

  return {
    client: {
      from,
      auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: "no user" } }) },
    },
    tables,
    writes,
  };
}
