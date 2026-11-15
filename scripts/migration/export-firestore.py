#!/usr/bin/env python3
"""Read-only Firestore REST export using gcloud's existing user login. No dependencies."""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

PROJECT = 'controlquest-studio-18ba7'

def stamp(value=None):
    return (value or dt.datetime.now(dt.timezone.utc)).isoformat(timespec='microseconds').replace('+00:00', 'Z')

class Client:
    def __init__(self, project=PROJECT, database='(default)', max_requests=45000):
        self.root = f'projects/{project}/databases/{database}/documents'
        self.project, self.database = project, database
        self.read_time = stamp(dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=5))
        self.started, self.requests, self.max_requests = time.monotonic(), 0, max_requests
        self.token = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True, stderr=subprocess.DEVNULL).strip()
        if not self.token:
            raise RuntimeError('No Google login token. Sign in to Cloud Shell first.')

    def request(self, method, resource, params=None, body=None):
        if method not in ('GET', 'POST') or (method == 'POST' and not resource.endswith((':listCollectionIds', ':runQuery'))):
            raise RuntimeError('Only read-only operations are supported.')
        if time.monotonic() - self.started > 55 * 60:
            raise RuntimeError('Snapshot time window reached. Export is incomplete; do not import it.')
        if self.requests >= self.max_requests:
            raise RuntimeError('Request safety limit reached. Export is incomplete.')
        self.requests += 1
        url = 'https://firestore.googleapis.com/v1/' + urllib.parse.quote(resource, safe='/:()')
        if params:
            url += '?' + urllib.parse.urlencode(params, doseq=True)
        request = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Do not print response bodies, request headers, or tokens.
            if error.code == 429:
                raise RuntimeError('Firestore quota/rate limit reached (429). Stopped without retrying; partial export is not complete.') from None
            raise RuntimeError(f'Firestore read failed (HTTP {error.code}). Check owner access, API availability and quota; no automatic retries.') from None
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError('Firestore connection failed. Partial export is not complete.') from None

    def collections(self, parent):
        token = ''
        while True:
            payload = {'pageSize': 100, 'readTime': self.read_time}
            if token:
                payload['pageToken'] = token
            result = self.request('POST', parent + ':listCollectionIds', body=payload)
            yield from result.get('collectionIds', [])
            token = result.get('nextPageToken')
            if not token:
                return

    def documents(self, parent, collection, mask=None):
        token = ''
        while True:
            params = {'pageSize': 100, 'showMissing': 'true', 'readTime': self.read_time}
            if mask:
                params['mask.fieldPaths'] = mask
            if token:
                params['pageToken'] = token
            result = self.request('GET', parent + '/' + collection, params=params)
            yield from result.get('documents', [])
            token = result.get('nextPageToken')
            if not token:
                return

    def recent(self, uid, field):
        query = {'from': [{'collectionId': 'studyReviews'}], 'orderBy': [{'field': {'fieldPath': field}, 'direction': 'DESCENDING'}], 'limit': 10, 'select': {'fields': [{'fieldPath': name} for name in ('recordType', 'type', 'reviewedAt', 'occurredAt', 'mode', 'rating')]}}
        result = self.request('POST', self.root + '/users/' + uid + ':runQuery', body={'structuredQuery': query, 'readTime': self.read_time})
        return [row['document'] for row in result if 'document' in row]

def export(client, output, max_documents=20000):
    output = pathlib.Path(output)
    archive = output.with_suffix('.zip')
    if archive.exists():
        raise RuntimeError('Archive already exists. Choose a new output name.')
    output.mkdir(parents=True, exist_ok=False)
    raw = output / 'firestore-documents.jsonl'
    manifest = {'format': 'controlquest-firestore-rest-v1', 'project': client.project, 'database': client.database, 'readTime': client.read_time, 'startedAt': stamp(), 'complete': False, 'documentCount': 0, 'missingParentCount': 0, 'collectionCounts': {}, 'scope': 'All discoverable Firestore documents and subcollections in this database; excludes Firebase Auth, Storage objects and device-only pending work.'}
    def save_manifest():
        manifest['requests'] = client.requests
        (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    save_manifest()
    try:
        with raw.open('x', encoding='utf-8') as stream:
            parents = [client.root]
            seen = set()
            while parents:
                parent = parents.pop()
                for collection in client.collections(parent):
                    collection_path = parent[len(client.root) + 1:] + '/' + collection if parent != client.root else collection
                    manifest['collectionCounts'].setdefault(collection_path, 0)
                    for document in client.documents(parent, collection):
                        name = document.get('name', '')
                        if not name.startswith(client.root + '/') or name in seen:
                            raise RuntimeError('Invalid or duplicate document path; export stopped.')
                        seen.add(name)
                        parents.append(name)  # Includes absent parents with nested subcollections.
                        if 'createTime' not in document and 'updateTime' not in document:
                            manifest['missingParentCount'] += 1
                            continue
                        if manifest['documentCount'] >= max_documents:
                            raise RuntimeError('Document safety limit reached; export is incomplete.')
                        stream.write(json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n')
                        manifest['documentCount'] += 1
                        manifest['collectionCounts'][collection_path] += 1
        manifest['sha256'] = hashlib.sha256(raw.read_bytes()).hexdigest()
        manifest['completedAt'] = stamp()
        manifest['complete'] = True
        save_manifest()
        temporary_archive = pathlib.Path(str(archive) + '.partial')
        with zipfile.ZipFile(temporary_archive, 'x', zipfile.ZIP_DEFLATED) as zipped:
            zipped.write(raw, raw.name)
            zipped.write(output / 'manifest.json', 'manifest.json')
        temporary_archive.rename(archive)
        return archive
    except Exception:
        manifest['complete'] = False
        manifest['stoppedAt'] = stamp()
        save_manifest()
        raise

def scalar(fields, name):
    value = fields.get(name, {})
    return value.get('stringValue', value.get('timestampValue', ''))

def activity(client, uid):
    records = []
    for field in ('reviewedAt', 'occurredAt'):
        for doc in client.recent(uid, field):
            fields = doc.get('fields', {})
            records.append({'time': scalar(fields, field), 'kind': scalar(fields, 'recordType') or scalar(fields, 'type') or 'review', 'id': doc['name'].rsplit('/', 1)[-1], 'lastCloudDocumentUpdate': doc.get('updateTime')})
    unique = {r['id']: r for r in records}
    return {'uid': uid, 'checkedAt': client.read_time, 'recentSavedEvents': sorted(unique.values(), key=lambda r: r['time'], reverse=True), 'interpretation': 'Saved-event evidence only. Event times may be earlier offline study replayed later. No events does not prove inactivity. This is not live presence and cannot see unsynced device work. Ask Ty to sync and pause before export.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['list-users', 'activity', 'export'])
    parser.add_argument('--project', default=PROJECT)
    parser.add_argument('--database', default='(default)')
    parser.add_argument('--uid', help='Exact UID from list-users; never guessed by name')
    parser.add_argument('--output', default='controlquest-export-' + dt.datetime.now().strftime('%Y%m%d-%H%M%S'))
    parser.add_argument('--max-documents', type=int, default=20000)
    parser.add_argument('--max-requests', type=int, default=45000)
    args = parser.parse_args()
    for name in ('project', 'database'):
        if '/' in getattr(args, name):
            parser.error('Project/database cannot contain a slash.')
    if args.mode == 'activity' and (not args.uid or '/' in args.uid):
        parser.error('activity requires --uid with an exact user ID.')
    if args.max_documents < 1 or args.max_requests < 1:
        parser.error('Limits must be positive.')
    try:
        client = Client(args.project, args.database, args.max_requests)
        if args.mode == 'list-users':
            result = [{'uid': d['name'].rsplit('/', 1)[-1], 'displayName': scalar(d.get('fields', {}), 'displayName')} for d in client.documents(client.root, 'users', ['displayName']) if 'createTime' in d or 'updateTime' in d]
            print(json.dumps(result, indent=2))
        elif args.mode == 'activity':
            print(json.dumps(activity(client, args.uid), indent=2))
        else:
            print('Read-only export; consumes normal Firestore read quota. No billing settings are changed.', flush=True)
            archive = export(client, args.output, args.max_documents)
            print('Complete snapshot archive: ' + str(archive))
    except Exception as error:
        print('STOPPED: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__) + '. Keep partial files for diagnosis; upload only a completed archive.', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
