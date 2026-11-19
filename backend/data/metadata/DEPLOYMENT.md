# Byte-preserving LOLA deployment

The existing manifest remains authoritative and unchanged. The local artifacts
match its pinned hashes: the PDS3 label is 5107 bytes, the PDS4 XML is 11930 bytes,
and the Apollo 17 cutout is 8192 bytes. Git previously stored normalized label
line endings, which did not match those hashes on deployment. The XML contains
mixed line endings; do not normalize or rewrite either label with a text editor.

`../.gitattributes` disables Git text conversion for both labels and the cutout.
`backend/.gitignore` permits only this audited small cutout in the raw directory.
No checksum, dataset value, or scientific formula has been changed.

Before a later authorized commit and Render deployment, include these files:

- `backend/.gitignore`
- `backend/data/.gitattributes`
- `backend/data/metadata/ldem_4.lbl`
- `backend/data/metadata/ldem_4.xml`
- `backend/data/metadata/lola_sample_manifest.json`
- `backend/data/raw/ldem_4_apollo17_cutout.bin`

Re-add the labels after applying the attributes so their Git blobs contain the
verified original bytes. Compare SHA-256 and byte lengths of the staged blobs
with the manifest, not just the working-tree copies. A successful local request
alone cannot prove that a Git-based deployment will contain the same bytes.

No remote deployment is performed by these changes. Render must deploy a later
authorized commit containing the artifacts and attributes. Missing artifacts or
checksum failures must continue to fail closed.

## Health metadata

Health mode `hybrid` describes the service capabilities. `/api/v1/analysis`
remains explicitly mock, with its existing contract unchanged. The existing
`live_nasa_integrations` field now distinguishes the integrity-checked local
LOLA dataset from the enabled JPL Horizons network provider. The field name is
retained for compatibility: local LOLA is not a live NASA service. Health does
not call Horizons or claim current remote availability; inspect each geometry
response's status and live_request_executed fields. If local data fails its
integrity check it is omitted from the integration list and terrain still fails
closed. Health mode's enum additionally accepts hybrid; no fields were removed.
