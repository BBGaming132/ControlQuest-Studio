"""Validate a Firestore ZIP and prepare a private Supabase staging snapshot."""

import argparse
import collections
import hashlib
import json
import pathlib
import subprocess
import tempfile
import zipfile


def decode_value(value):
    tag, data = next(iter(value.items()))
    if len(value) != 1:
        raise ValueError("Invalid Firestore value")
    if tag == "mapValue":
        return decode_fields(data.get("fields", {}))
    if tag == "arrayValue":
        return [decode_value(item) for item in data.get("values", [])]
    if tag == "integerValue":
        return int(data)
    if tag in {
        "nullValue", "booleanValue", "doubleValue", "timestampValue",
        "stringValue", "bytesValue", "referenceValue", "geoPointValue",
    }:
        return data
    raise ValueError(f"Unsupported Firestore value type: {tag}")


def decode_fields(fields):
    return {key: decode_value(value) for key, value in fields.items()}


def prepare(archive, output, expected_project):
    with zipfile.ZipFile(archive) as bundle:
        if sorted(bundle.namelist()) != ["firestore-documents.jsonl", "manifest.json"]:
            raise ValueError("Expected one Firestore document stream and one manifest")
        manifest = json.loads(bundle.read("manifest.json"))
        if (
            manifest["format"] != "controlquest-firestore-rest-v1"
            or manifest["complete"] is not True
            or manifest["project"] != expected_project
        ):
            raise ValueError("Expected a complete export from the specified Firebase project")

        prefix = f"projects/{expected_project}/databases/{manifest['database']}/documents/"
        source_hash = hashlib.sha256()
        retained_hash = hashlib.sha256()
        counts = collections.Counter()
        seen = set()
        referenced = set()
        chunks = {}
        documents = []

        with bundle.open("firestore-documents.jsonl") as stream, output.open("xb") as target:
            def retain(path, row, data):
                if not row.endswith(b"\n"):
                    raise ValueError("Expected a newline after each exporter record")
                target.write(row)
                retained_hash.update(row)
                documents.append({"path": path, "data": data})

            for row in stream:
                source_hash.update(row)
                raw = json.loads(row)
                if not raw["name"].startswith(prefix):
                    raise ValueError("Document is outside the exported database")
                path = raw["name"][len(prefix):]
                segments = path.split("/")
                if not all(segments) or len(segments) % 2 or path in seen:
                    raise ValueError("Invalid or duplicate document path")
                seen.add(path)
                counts[path.rsplit("/", 1)[0]] += 1
                fields = raw.get("fields", {})
                if fields.get("recordType", {}).get("stringValue") == "profile-chunk":
                    data = decode_fields(fields)
                    chunk_id = "profile_chunk_" + hashlib.sha256(data["data"].encode()).hexdigest()
                    if (
                        len(segments) != 4 or segments[0] != "users"
                        or segments[2] != "studyReviews" or segments[3] != chunk_id
                        or data["id"] != chunk_id or data["uid"] != segments[1]
                    ):
                        raise ValueError("Invalid profile chunk hash, identifier, or owner")
                    chunks[path] = stream.tell() - len(row)
                    continue

                data = decode_fields(fields)
                if len(segments) == 2 and segments[0] == "users":
                    metadata = data.get("_profileChunks")
                    if metadata:
                        for ids in metadata["fields"].values():
                            referenced.update(f"{path}/studyReviews/{chunk_id}" for chunk_id in ids)
                retain(path, row, data)

            if (
                source_hash.hexdigest() != manifest["sha256"]
                or len(seen) != manifest["documentCount"]
                or counts != collections.Counter(manifest["collectionCounts"])
            ):
                raise ValueError("Source checksum or document counts disagree with manifest")
            if not referenced.issubset(chunks):
                raise ValueError("A profile references a chunk missing from the source export")

            # Read chunks in source order to avoid repeatedly decompressing the archive.
            stream.seek(0)
            for path in sorted(referenced, key=chunks.__getitem__):
                stream.seek(chunks[path])
                row = stream.readline()
                retain(path, row, decode_fields(json.loads(row)["fields"]))

    validator = pathlib.Path(__file__).with_name("validate-export.mjs")
    with tempfile.TemporaryDirectory() as temp:
        validation_file = pathlib.Path(temp) / "validation.json"
        validation_file.write_text(json.dumps({
            "format": "controlquest-migration-v1",
            "capturedAt": manifest["readTime"],
            "complete": True,
            "documents": documents,
        }), encoding="utf-8")
        result = subprocess.run(
            ["node", str(validator), str(validation_file)],
            check=True, capture_output=True, text=True,
        )
        validation = json.loads(result.stdout)

    return {
        "sourceProject": expected_project,
        "sourceDatabase": manifest["database"],
        "sourceReadTime": manifest["readTime"],
        "sourceSha256": source_hash.hexdigest(),
        "retainedSha256": retained_hash.hexdigest(),
        "sourceDocumentCount": len(seen),
        "retainedDocumentCount": len(documents),
        "archivedChunkCount": len(chunks) - len(referenced),
        "retainedBytes": output.stat().st_size,
        "profilesHydrated": validation["profilesHydrated"],
        "counts": validation["counts"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    parser.add_argument("--project", required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists")

    # Publish only after both the raw archive check and the domain checks pass.
    with tempfile.TemporaryDirectory(dir=args.output.parent) as temp:
        candidate = pathlib.Path(temp) / "candidate.jsonl"
        summary = prepare(args.archive, candidate, args.project)
        candidate.rename(args.output)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
