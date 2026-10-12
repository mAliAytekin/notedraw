# Knowledge Canvas — Codex / Vibe Coding Prompt

Aşağıdaki prompt'u proje klasöründe Codex'e ver. `knowledge_canvas_faz_plani.md` dosyasını da aynı klasöre koy. İlk oturumun hedefi Faz 0–1'dir; sonraki fazlar açıkça istendiğinde uygulanır.

---

You are implementing Knowledge Canvas, a local-first personal whiteboard application. Read `knowledge_canvas_faz_plani.md` as the product roadmap. Inspect the existing repository and applicable AGENTS.md before making changes. Preserve existing user work. If the roadmap is missing, use this prompt as the complete initial specification.

## Product goal

Build an Excalidraw-like infinite whiteboard where users draw boxes, arrows and freehand strokes AND edit Markdown notes directly inside movable, resizable cards on the same canvas. This is not a separate Markdown editor screen with a drawing tab. The canvas is the main workspace. Double-clicking a card opens an actual editor inside that card.

Eventually users organize boards and notes into folders and use a Tauri desktop application backed by real Markdown files. Start with a browser prototype.

## Scope for this session

Implement Phase 0 and Phase 1 completely, with verified persistence and working interactions. Do not implement folder management, Tauri, cloud, authentication, collaboration, AI, MCP, backlinks or graph databases in this session. Those are future phases. Do not stop after scaffolding or producing a plan. Work until the current scope is runnable, or identify a concrete environmental blocker and finish all work independent of that blocker.

## Stack

- React + TypeScript + Vite.
- tldraw SDK for canvas tools and document state.
- Tiptap for inline rich-text editing, using its current open-source Markdown support where compatible.
- IndexedDB for browser persistence; no backend.
- Small CSS layer; Tailwind is optional if already present.
- Vitest for serialization/storage invariants and Playwright for critical browser interactions.

Check current official documentation and compatible versions before installing. Pin dependency resolution with a lockfile. Do not invent API names or copy obsolete examples. Avoid paid Tiptap cloud conversion APIs. Check tldraw licensing and explain production licensing in README; never bypass license checks, assume personal usage is exempt, or silently substitute another canvas engine. Development work may proceed under applicable development terms. Do not deploy or publish this prototype.

## Required architecture

Keep domain data, storage and components separate without overengineering.

- `Note`: stable noteId, title, Markdown string, revision, timestamps; relativePath may be introduced for later desktop storage.
- `MarkdownCard`: native tldraw custom shape with noteId, width/height and visual props; position is managed by tldraw.
- `Board`: stable boardId, title, versioned native document snapshot.
- `Asset`: stable ID and persisted bytes/metadata if used.

A note is the canonical content source. Shapes reference notes by ID; do not keep independent editable copies of the same note in shape props. Deleting a card does not delete its note. Duplicating a card reuses noteId; an explicit future “duplicate note” action creates a new ID.

Define a small asynchronous StorageAdapter with load/save operations and an IndexedDB implementation. Design it so a future Tauri adapter can reuse the domain model. Do not implement Tauri now. Use tldraw's document snapshot APIs and custom shape schema/migrations. Persist required asset data rather than ephemeral object URLs. Session/camera state may be separate from document data.

Suggested organization:

```text
src/app/
src/canvas/MarkdownCardShapeUtil.tsx
src/editor/
src/domain/
src/storage/StorageAdapter.ts
src/storage/IndexedDbAdapter.ts
src/tests/
docs/architecture.md
docs/progress.md
README.md
```

Adapt names to an existing project. Do not build a generic plugin system.

## Phase 0: prove the key interaction first

1. Render a usable tldraw canvas with built-in drawing tools.
2. Add one native custom `markdown-card` shape using documented ShapeUtil, geometry and HTML container APIs.
3. Make it movable, resizable, selectable and bindable to arrows.
4. Render a Tiptap editor inside the card while editing.
5. Verify text selection and typing do not drag the shape or activate canvas shortcuts.

Finish this technical proof before adding broader UI or persistence features.

## Phase 1: complete single-board MVP

- Minimal app toolbar with “Yeni Markdown Kartı”, save status and a theme toggle.
- Add a new card centered in the current visible viewport with its own Note.
- Single click selects; drag moves; resize handles resize.
- Double-click enters inline editing. Escape or clicking outside finishes editing and preserves the draft.
- Card content scrolls when it exceeds the card height; wheel behavior must be deliberate and must not unexpectedly pan/zoom while editing.
- Support headings, paragraphs, bold/italic, ordered/unordered lists, links, blockquotes and fenced code blocks.
- Provide Markdown source and rendered preview modes inside the card. Rich text is a supported editing mode, not the authoritative storage format.
- Raw source is an escape hatch for unsupported syntax. Do not silently remove unknown syntax when entering rich-text mode. Preserve raw content and show a concise limitation if conversion cannot round-trip it safely.
- Support Turkish text and Unicode.
- Mount an active Tiptap editor only for the card currently being edited. Other cards use a lightweight preview.
- Keep the note store shared so multiple cards referencing one note stay in sync.
- Use a small demo board featuring Bilinç Problemi and İşlevselcilik on first launch only. Never overwrite existing data with demo content.

## Interaction and undo rules

- While typing, Backspace/Delete edit text rather than deleting shapes.
- Ctrl/Cmd+A selects editor text. Ctrl/Cmd+Z undoes text edits through the editor while editing; outside editing it uses canvas history.
- Clipboard shortcuts, arrow keys and IME/composition remain usable in the editor.
- Use documented tldraw event coordination; do not stop every event indiscriminately and break selection or pointer capture.
- Deleting a selected card outside editing deletes only the shape.
- Arrows remain bound when a card moves or resizes.
- Duplicated cards share note content by design; document this behavior.

## Persistence and recovery

Use IndexedDB transactions to persist a coherent revision of board data and referenced notes. Debounce about 600 ms, serialize asynchronous writes, and prevent older writes from replacing newer revisions. Save indicators must reflect committed writes rather than scheduled writes.

Retain dirty state after failure, expose retry and preserve recoverable drafts. Flush pending edits before controlled board navigation and storage replacement. For pagehide/visibility transitions use best-effort checkpoints; do not promise asynchronous writes will complete on sudden process termination. Prefer durable draft updates during editing to relying on unload events.

On load, validate envelope schema and custom shapes before replacing state. Show a recoverable error for malformed or newer unsupported data; do not reset or overwrite it silently. Handle missing notes with a visible placeholder. Avoid render/save feedback loops and editor initialization events that overwrite stored content.

Provide a single-board JSON backup export/import that includes all referenced notes and any persisted assets with a schema version. Validate before import and ask before replacing the current board. Also allow exporting an individual Note as UTF-8 `.md`. This backup format is not an Excalidraw or Obsidian canvas file.

## Verification

Write meaningful checks for the highest-risk behavior:

1. Supported Markdown fixture round-trip retains semantic content, including Turkish and fenced code.
2. Older asynchronous writes cannot overwrite newer revisions; failure keeps dirty state.
3. Reload restores note text, card position/size and bound arrows.
4. Typing, text selection, Backspace/Delete, Ctrl/Cmd+A and undo inside a card do not trigger destructive canvas actions.
5. Deleting a card retains its note; two cards referencing the same note update together.
6. Backup export/import restores the board and rejects malformed input without damaging current content.

Run typecheck, production build and appropriate tests. Use an actual browser for the core inline editor flow if available. Report any unavailable test environment accurately; do not claim screenshot/UI verification without performing it. Do not add trivial tests solely to increase coverage.

## Deliverables and progress

Create working code, README with exact install/dev/build/test commands, `docs/architecture.md`, and `docs/progress.md`. Record completed roadmap phases, package versions, supported Markdown syntax, storage format, limitations and the next concrete task. Keep these docs updated when implementing later phases.

At the end, report what works, the commands run and their results, material limitations, and how to start the app. Communicate in Turkish; code identifiers may be English. Explain that browser persistence is separate from real local filesystem access.

## Instructions for later sessions

When the user explicitly requests a later phase, read the roadmap, progress file and existing code; implement that phase and verify earlier critical behavior still works. Reuse the same noteId model and storage adapter. Phase 2 adds logical browser folders, multiple boards, shared notes and workspace backup. Phase 3 adds Tauri 2, real `.md`/`.board.json` files, safe workspace access, robust writes and external-change conflict handling. Phase 4 adds search, extended Markdown and usability/performance improvements. Do not implement Phase 5 without a separate request.

Do not repeatedly ask for confirmation for routine reversible implementation choices inside the requested phase. Record reasonable assumptions and continue.

## Additional user requirement — 8 October 2026

Phase 2 also includes an in-app PDF reading panel fixed in screen coordinates over the whiteboard. The user must be able to read the PDF while writing notes in Markdown cards and panning/zooming the whiteboard. Canvas movement must not move or scale the PDF panel. PDF scrolling, page navigation, zoom, and text selection must be independent of canvas interactions. Opening/reading a PDF must not damage existing notes or board data.

The user answered the PDF persistence questions during Phase 2 (D-018): store PDF bytes in the workspace and its backup, restore the last page/zoom, and let each board show its own last opened PDF. These choices are implemented and should not be asked again. Phase 3 integrates the reader with actual workspace files under the existing filesystem access rules. The PDF requirement extends Phase 2 and does not change the completed Phase 1 scope; current implementation/test status is recorded in docs/progress.md.

The user additionally requested a movable PDF panel and a collapsible Knowledge workspace sidebar. Dragging the PDF header must reposition the panel independently of canvas pan/zoom. Keep the chosen panel position per board; clamp it to the visible canvas when the window or sidebar changes. Provide a clearly labeled sidebar toggle and a close control inside the sidebar, remember visibility in this browser, and preserve the existing canvas instance and notes when toggling. This Phase 2 addition is tracked as D-023.

The user also requested resizing the PDF panel. Support independent width/height changes through edge and corner handles, with keyboard access. Remember dimensions per board and include them in workspace backups; older readers without dimensions remain valid. Keep the opposite edge anchored and the panel reachable within the canvas. Resizing must preserve PDF page/zoom/scroll and canvas/note state; cancellation must discard the provisional resize. This Phase 2 addition is tracked as D-024.
