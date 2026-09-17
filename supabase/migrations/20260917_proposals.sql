-- Client-facing "Product Proposal" documents (showcase PDF of selected lots,
-- distinct from priced Quotations). Numbers are sequential and permanent —
-- reference_no is derived from them so it can never drift out of sync.

create sequence if not exists proposal_number_seq start with 1;

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  number integer not null default nextval('proposal_number_seq') unique,
  prefix text not null default 'AMB',
  reference_no text generated always as (prefix || '/PROP/' || lpad(number::text, 3, '0')) stored,
  client_name text not null,
  proposal_date date not null default current_date,
  items jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now()
);

alter sequence proposal_number_seq owned by proposals.number;

alter table proposals enable row level security;
-- No policies: only the server-side admin (service role) client writes/reads
-- this table, mirroring audit_logs. Authenticated/anon roles get no access.

create index if not exists proposals_created_at_idx on proposals (created_at desc);
