create schema controlquest_migration;
revoke all on schema controlquest_migration from public, anon, authenticated, service_role;

create table controlquest_migration.snapshots (
    source_sha256 text primary key check (source_sha256 ~ '^[0-9a-f]{64}$'),
    retained_sha256 text not null check (retained_sha256 ~ '^[0-9a-f]{64}$'),
    source_project text not null,
    source_read_time timestamptz not null,
    source_document_count integer not null check (source_document_count > 0),
    retained_document_count integer not null check (
        retained_document_count > 0 and retained_document_count <= source_document_count
    ),
    imported_at timestamptz not null default now()
);

create table controlquest_migration.documents (
    source_sha256 text not null references controlquest_migration.snapshots,
    path text not null,
    document jsonb not null check (jsonb_typeof(document) = 'object'),
    primary key (source_sha256, path)
);

-- The import transport is discarded in the same transaction that records a snapshot.
create table controlquest_migration.fragments (
    retained_sha256 text not null check (retained_sha256 ~ '^[0-9a-f]{64}$'),
    part integer not null check (part >= 0),
    contents bytea not null,
    primary key (retained_sha256, part)
);

revoke all on all tables in schema controlquest_migration from public, anon, authenticated, service_role;
alter table controlquest_migration.snapshots enable row level security;
alter table controlquest_migration.documents enable row level security;
alter table controlquest_migration.fragments enable row level security;

create function controlquest_migration.finish_import(
    source_hash text,
    retained_hash text,
    firebase_project text,
    firebase_database text,
    read_time timestamptz,
    source_count integer,
    retained_count integer
) returns integer
language plpgsql
set search_path = ''
as $$
declare
    payload bytea;
    document_prefix text := format('projects/%s/databases/%s/documents/', firebase_project, firebase_database);
    inserted integer;
begin
    select string_agg(contents, ''::bytea order by part) into payload
    from controlquest_migration.fragments
    where retained_sha256 = retained_hash;

    if payload is null or encode(sha256(payload), 'hex') <> retained_hash then
        raise exception 'Staging data checksum does not match';
    end if;

    insert into controlquest_migration.snapshots (
        source_sha256, retained_sha256, source_project, source_read_time,
        source_document_count, retained_document_count
    ) values (
        source_hash, retained_hash, firebase_project, read_time, source_count, retained_count
    );

    insert into controlquest_migration.documents (source_sha256, path, document)
    select source_hash, substring(document->>'name' from length(document_prefix) + 1), document
    from (
        select line::jsonb as document
        from string_to_table(convert_from(payload, 'UTF8'), chr(10)) as entry(line)
        where line <> ''
    ) decoded
    where starts_with(document->>'name', document_prefix);
    get diagnostics inserted = row_count;

    if inserted <> retained_count then
        raise exception 'Staging row count does not match';
    end if;

    delete from controlquest_migration.fragments where retained_sha256 = retained_hash;
    return inserted;
end;
$$;

revoke all on function controlquest_migration.finish_import(text, text, text, text, timestamptz, integer, integer)
from public, anon, authenticated, service_role;
