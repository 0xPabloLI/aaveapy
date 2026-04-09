# Reserve ID Canonical Key

Status: implemented.

## Decision

- Use backend `reserveId` as the canonical UI/state key when present.
- Reserve payloads must always include `reserveId`; do not rely on composite fallback in production code.

## Scope

- Row anchoring and scroll targets in the reserves table.
- Portfolio position lookup and search selection wiring.
- Mobile reserve card anchors and portfolio toggles.
- Shared simulation id generation.

## Notes

- This change reduces duplicated key construction across the frontend.
- The API contract now enforces `reserveId` as required; `snapshot.version` remains optional metadata.
