# Project rules

- Each app under `src/` (e.g. `src/Instagram`, `src/azdo`) may import from `src/lib` but never from a sibling app folder.
- Shared code belongs in `src/lib`. If two apps need the same thing, move or copy it there instead of importing across apps.
