import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('exporter', pathlib.Path(__file__).parents[1] / 'scripts/migration/export-firestore.py')
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)

class ExportTests(unittest.TestCase):
    def client(self):
        with patch.object(e.subprocess, 'check_output', return_value='SECRET_TOKEN'):
            return e.Client()

    def test_nested_missing_and_raw_types(self):
        c = self.client()
        root = c.root
        calls = []
        def request(method, resource, params=None, body=None):
            calls.append((method, resource, params, body))
            if resource.endswith(':listCollectionIds'):
                parent = resource.removesuffix(':listCollectionIds')
                if parent == root:
                    return {'collectionIds': ['users'], 'nextPageToken': 'next'} if 'pageToken' not in body else {'collectionIds': ['groups']}
                return {'collectionIds': ['studyReviews']} if parent == root + '/users/missing' else {}
            if resource == root + '/users':
                return {'documents': [{'name': root + '/users/missing'}], 'nextPageToken': 'next'} if 'pageToken' not in params else {'documents': [{'name': root+'/users/existing','createTime':'2026-01-01T00:00:00Z','fields':{}}]}
            if resource == root + '/users/missing/studyReviews':
                return {'documents': [{'name': resource+'/event', 'createTime':'2026-01-01T00:00:00Z', 'fields': {'large': {'integerValue':'9007199254740993'}, 'binary': {'bytesValue':'YWJj'}}}]}
            return {}
        c.request = request
        with tempfile.TemporaryDirectory() as tmp:
            archive = e.export(c, pathlib.Path(tmp)/'out')
            with zipfile.ZipFile(archive) as z:
                self.assertEqual(set(z.namelist()), {'manifest.json','firestore-documents.jsonl'})
                manifest = json.loads(z.read('manifest.json'))
                self.assertTrue(manifest['complete'])
                self.assertEqual(manifest['documentCount'], 2)
                self.assertEqual(manifest['missingParentCount'], 1)
                raw = z.read('firestore-documents.jsonl').decode()
                self.assertIn('9007199254740993', raw)
                self.assertNotIn('SECRET_TOKEN', raw)
        for method, _, params, body in calls:
            self.assertEqual((body if method == 'POST' else params)['readTime'], c.read_time)
        self.assertTrue(any(p and p.get('pageToken') == 'next' for _,_,p,_ in calls))

    def test_failure_never_creates_complete_archive(self):
        c = self.client()
        c.collections = lambda parent: iter(['users'])
        def fail(*args):
            raise RuntimeError('Quota reached')
        c.documents = fail
        with tempfile.TemporaryDirectory() as tmp:
            target = pathlib.Path(tmp)/'out'
            with self.assertRaises(RuntimeError):
                e.export(c, target)
            self.assertFalse(json.loads((target/'manifest.json').read_text())['complete'])
            self.assertFalse(target.with_suffix('.zip').exists())

    def test_activity_minimal_and_no_presence_claim(self):
        c = self.client()
        c.recent = lambda uid, field: [{'name':c.root+'/users/'+uid+'/studyReviews/r','fields':{field:{'stringValue':'2026-01-01T00:00:00Z'},'question':{'stringValue':'PRIVATE'}}}] if field=='reviewedAt' else []
        result=e.activity(c,'ty')
        self.assertEqual(len(result['recentSavedEvents']),1)
        self.assertNotIn('PRIVATE',json.dumps(result))
        self.assertIn('not live presence', result['interpretation'])

    def test_http_errors_redacted_no_retry(self):
        c = self.client()
        with patch.object(e.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('x',429,'SECRET_TOKEN',{},None)) as call:
            with self.assertRaisesRegex(RuntimeError,'quota/rate') as caught:
                c.request('GET',c.root+'/users')
            self.assertNotIn('SECRET_TOKEN', str(caught.exception))
            self.assertEqual(call.call_count,1)
        with self.assertRaises(RuntimeError):
            c.request('POST',c.root+':commit',body={})

if __name__=='__main__':
    unittest.main()
