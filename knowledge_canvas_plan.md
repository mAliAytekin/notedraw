# Knowledge Canvas — Phased Development Plan

Date: October 8, 2026

## 1. Product goal

Create and edit real Markdown notes alongside boxes, arrows, and freehand drawings on an Excalidraw-like infinite whiteboard. Markdown cards can be dragged, resized, and connected to other objects with arrows. Double-click to write inside a card without switching to a separate note screen.

Folders contain multiple whiteboards and Markdown notes. The same note can appear on different whiteboards. Primary uses: philosophy concept maps, AI research, and game design notes.

## 2. Technology and scope

| Area | Choice | Decision |
|---|---|---|
| Interface | React + TypeScript + Vite | A small, single application |
| Whiteboard | tldraw | A custom React shape for Markdown |
| Card editor | Tiptap + open-source Markdown support | Basic formatting; raw Markdown mode |
| Initial persistence | IndexedDB | Browser prototype; not real folders |
| Desktop | Tauri 2 | A real local workspace at a later stage |
| Files | UTF-8 `.md`, versioned `.board.json`, assets | Portable user data |
| Styling | Simple CSS or Tailwind | Whichever fits the existing project |
| Testing | Vitest and Playwright | Data integrity and critical interactions |

The first release has no backend, accounts, cloud, simultaneous collaboration, AI, MCP, or graph database. Do not build a drawing engine from scratch. Keep browser storage and the local filesystem distinct until the desktop phase.

### License and API checks

Before implementation, check the current official tldraw and Tiptap documentation, package compatibility, and licenses; pin the versions used in the lockfile. The default tldraw SDK license permits development use; evaluate the appropriate license key and terms for production/distribution. Do not assume personal use is automatically unlimited and free. If licensing is a blocker, preserve the working development prototype and present an engine change as a separate decision.

## 3. Data model: separate notes from cards

- **Note:** stable `noteId`, title, workspace-relative file path, Markdown content, and revision.
- **MarkdownCard:** tldraw shape ID, `noteId`, width/height, and display properties. tldraw manages position.
- **Board:** stable `boardId`, title, path, tldraw document snapshot, and schema version.
- **Folder:** stable ID, parent ID, name, and relative path.
- **Asset:** stable ID, relative path, and MIME type.

Do not duplicate Markdown text in every card. A note has a single source of truth. Deleting a card does not delete its note. Deleting a note requires explicit confirmation and reference management for the cards using it. The noteId remains unchanged when renaming/moving a note.

Example desktop workspace:

```text
MyKnowledge/
  .knowledge-canvas/workspace.json
  Philosophy/
    Ontology/
      Consciousness.md
      Ontology.board.json
  AI Research/
  Game Design/
  assets/
```

The workspace manifest maps note IDs to paths. Board snapshots hold card references and drawings; Markdown bodies remain in `.md` files. Browser export is a versioned backup package containing boards, notes, the manifest, and assets. Do not describe this format as an Obsidian `.canvas` or Excalidraw file.

## 4. Phases

| Phase | Deliverable | Completion criterion |
|---|---|---|
| 0 | Technical validation | An editable Markdown shape on the same canvas |
| 1 | Single-board MVP | Cards, drawing, autosave, reopening |
| 2 | Browser app with folders and PDF reading | Multiple boards, shared notes, backups, note-taking from a fixed PDF panel |
| 3 | Local desktop workspace | Real files through Tauri |
| 4 | Quality for daily use | Search, links, performance |
| 5 | Optional extensions | AI/MCP/sync as separate scope |

### Phase 0 — Validate the hardest interaction

Set up React/Vite; add a `markdown-card` custom shape to the tldraw canvas. Edit Turkish headings, paragraphs, and lists with Tiptap inside the card. Separate selection/dragging from writing mode. The card must accept arrow connections and stay in place during zoom and pan.

Acceptance: Double-click enters writing mode; Escape ends editing. While typing, letters, Backspace, Delete, Ctrl/Cmd+A, and undo must not trigger canvas commands. Selecting text must not drag the card. Arrows stay attached when the card moves. Do not add folders or Tauri before completing this phase.

### Phase 1 — Single-whiteboard MVP

Add new note cards; support headings, paragraphs, bold/italic, lists, links, quotes, and fenced code. Arrows, boxes, and freehand drawing use the SDK tools. Cards provide preview, rich-text, and raw Markdown modes. Tables and math are optional in this phase; unsupported Markdown must not be silently converted.

Save boards and notes to IndexedDB. Use an approximately 600 ms debounce, a serialized write queue, revision tracking, and saving/saved/error indicators. Flush before switching boards. Do not promise absolute guarantees for the final debounce interval on abrupt tab/process closure; use recoverable drafts. Preserve dirty state when saving fails.

Acceptance: Edit, move, resize, and connect a card with an arrow, then reopen the page; the text and scene return. An older write result must not overwrite newer text. Outside the editor, Delete removes the card, not the note. Validate raw Markdown import/export fixtures semantically.

### Phase 2 — Folders, multiple boards, PDF reading, and portable backups

Provide a folder tree on the left with creation, rename, move, and confirmed deletion of folders/boards/notes. Browser folders are logical records within the application. Add notes to the canvas by dragging or selecting them. Display the same note on two boards and in two cards on the same board; edits appear in every view. Deleting one card must not remove the note.

Add workspace export/import with schema versioning, validation, assets, conflict handling, and recovery. Unknown/corrupt formats must not overwrite the existing workspace. If a note reference cannot be resolved, show a recoverable missing-note card.

Acceptance: Create a board and note under Philosophy/Ontology; links continue to work after rename/move. Export and import into a clean workspace; texts, arrows, cards, and assets open correctly. Rapid board switching must not lose the latest text.

**October 8, 2026 — additional user requirement: a fixed PDF reading panel.** Users must be able to open and read a PDF over the whiteboard while writing notes in canvas Markdown cards. The PDF panel stays fixed in screen coordinates; whiteboard pan/zoom must not change its position or scale. The panel lives in an application layer independent of the canvas camera, and canvas navigation/editing remains available while it is open.

Basic PDF opening, page navigation, independent scrolling/zoom, selection/copying from an existing text layer, and closing the panel are part of Phase 2. Pointer/wheel/keyboard/clipboard events over the PDF must not reach the canvas; preserve the Markdown editor's text shortcuts. PDF loading/reading errors must not change notes or boards. D-018 decisions confirmed with the user during Phase 2 development: PDFs are included in the workspace and backup; the last page/zoom is remembered; each board displays its own last PDF.

**October 8, 2026 — additional interface requirement:** Users can move the PDF panel by its header; its chosen screen position stays fixed during whiteboard pan/zoom. Remember the panel position per board and constrain it to an accessible area when the window narrows. The Knowledge workspace panel on the left has a visible toggle; remember its visibility preference in the browser. Toggling it must not recreate the canvas or notes.

**October 8, 2026 — additional resizing requirement:** Users can change the PDF panel's width and height from its edges/corners. Remember its size per board and include it in workspace backups. Resizing must not change PDF zoom, page, scroll position, or the whiteboard camera; enforce minimum size and canvas bounds. Support older backups without panel dimensions.

Additional acceptance: With a PDF open, write in a Markdown card → pan/zoom the whiteboard → the PDF panel's screen position and PDF zoom remain unchanged → scroll/change pages inside the PDF → the whiteboard camera remains unchanged → return to the note; preserve its text and existing save behavior. Also validate open-PDF behavior across board switches and PDF persistence according to the agreed decisions.

### Phase 3 — Tauri and the real filesystem

**October 8, 2026 — implementation and user decisions:** The Phase 3 development scope has been implemented; macOS native development smoke tests and a debug `.app` build passed. External `.md` files are automatically discovered on startup/Refresh, and their names come from filenames (D-025). Conflicts require an explicit choice between disk/local versions; there is no automatic merge (D-026). Removed files are preserved in the workspace trash (D-027). The user chose development mode for now; the tldraw native license will be decided separately before packaging (D-028). Standalone licensed/signed distribution is not yet complete. See [evidence](docs/progress.md) and the [file/recovery guide](docs/desktop-workspace.md).

Replace the storage adapter with a Tauri implementation. Support workspace selection, `.md` reading/writing, `.board.json`, the manifest, and assets. Allow access only to the selected workspace; prevent path traversal and symlink escapes. Write using a temporary file in the same directory and a platform-appropriate atomic replace strategy; preserve the last good file if saving fails.

Check revision/hash or mtime for externally changed files; if the editor is dirty, use a conflict flow instead of silently overwriting. Manual refresh is sufficient for the first desktop release; a watcher can be added later. Use a recovery journal or rollback for manifest update failures during moves/renames.

Bring the fixed PDF panel from Phase 2 to desktop. Integrate it with real workspace files and the manifest according to the PDF storage/reference decision; validate missing/moved PDFs and reopening behavior. File access must obey the same workspace boundaries. Basic PDF reading does not wait for the Tauri migration.

Acceptance: Close/reopen the app; real notes and boards return. `.md` files can be read in VS Code. Externally edited notes are visibly detected. Write failures must not lose data. Validate execution/packaging on the Mac target; when working in a Linux environment, do not claim macOS validation that was not actually performed.

### Phase 4 — Quality for daily use

**October 8, 2026 — implemented:** Title/content search, wiki-links/backlinks, table editing, KaTeX source/preview, keyboard accessibility, and PNG/SVG export were added. The user chose to update links on rename and leave visible broken links on deletion (D-029), a KaTeX source editor (D-030), and PNG+SVG exports that correctly display cards (D-031). Native SVG embeds cards as 2× raster images while other shapes remain vectors; browser SVG uses HTML foreignObject. See [acceptance/test/performance evidence](docs/progress.md) and [decisions](docs/decisions.md).

Provide simple note title/content search, supported Markdown tables, optional KaTeX, wiki-links/backlinks, a dark theme, and keyboard accessibility. Only the card being edited has an active Tiptap instance; other cards use lightweight previews. Use SDK capabilities for cards outside the viewport. Do not add complex optimizations without measurements.

If PNG/SVG board export is supported, verify that custom HTML cards actually appear in the output; if they do not, do not present it as a supported feature. Workspace export remains the primary lossless backup.

Acceptance: In a test scene with 100 note cards and 200 simple shapes, measure that editing does not rerender all editors. Validate source ↔ editor conversion for Markdown features. Document wiki-link behavior on deletion/rename.

**October 9, 2026 — PDF text tools (D-034):** After the phases were completed, the Phase 2 PDF feature was extended at the user's request: highlighting, underlining/strikethrough, and independent Markdown cards with the source PDF name/page when selected text or the “Drag to canvas” button is dropped onto the whiteboard. Marks are stored separately in workspace metadata without changing the source PDF and are included in full backups. Position is preserved across page/zoom/panel/camera changes; boards opening the same PDF share its marks. Deletion behavior, the single-writer policy, and compatibility with older backups are preserved. This addition does not start Phase 5.

### Phase 5 — Extensions requiring separate decisions

Sending selected notes to an LLM, summaries with sources, suggested concept links, MCP access, and cloud sync. Plan these after ensuring the core application's data integrity. Sync requires a conflict/version model; AI requires a defined scope for data transmission and a provider selected by the user.

## 5. Code organization

```text
src/
  app/
  canvas/MarkdownCardShapeUtil.tsx
  editor/
  explorer/
  domain/
  storage/StorageAdapter.ts
  storage/IndexedDbAdapter.ts
  storage/TauriAdapter.ts
  assets/
  tests/
docs/architecture.md
docs/progress.md
README.md
```

This is guidance; do not create unnecessary layers or a plugin framework. Separate storage and domain code from React components. Use the tldraw store for board state; do not create a second parallel shape store.

## 6. Vibe coding workflow

The first session implements only Phases 0–1. Give explicit goals in later sessions, such as “Implement Phase 2”. For every phase, record the working result, critical acceptance scenarios, checks performed, and remaining limitations in `docs/progress.md`. If a previously working phase breaks, fix it before adding new features.

Example smoke scenario: Open the Ontology board → add a Consciousness Problem card → write a qualia note → connect an arrow to a Functionalism box → move the card → reopen → add the same note to a second board → see the change on both boards.

## 7. Official reference sources

Checked on October 8, 2026. Verify current APIs and terms again when development begins.

- Custom shape: https://tldraw.dev/examples/custom-shape
- Shape model: https://tldraw.dev/docs/shapes
- tldraw license: https://tldraw.dev/community/license
- Tiptap Markdown: https://tiptap.dev/docs/editor/markdown
- Markdown installation: https://tiptap.dev/docs/editor/markdown/getting-started/installation
- Tauri: https://v2.tauri.app/
