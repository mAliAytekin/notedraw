use super::*;
use serde_json::json;
use std::fs;
fn text(path: &str, data: &str) -> FileData {
    FileData {
        path: path.into(),
        encoding: "utf8".into(),
        data: data.into(),
    }
}
fn plan(w: &mut Workspace, revision: u64, path: &str, content: &str) -> Commit {
    let manifest = json!({"format":"knowledge-canvas-files","schemaVersion":1,"workspaceId":"workspace:test","revision":revision,"notes":[{"path":path}],"boards":[],"pdfs":[{"path":"assets/read.pdf"}],"assets":[]});
    Commit {
        expected_token: w.snapshot().unwrap().token,
        files: vec![
            text(MANIFEST, &manifest.to_string()),
            text(path, content),
            FileData {
                path: "assets/read.pdf".into(),
                encoding: "base64".into(),
                data: STANDARD.encode(b"%PDF-1.4\nbytes"),
            },
        ],
        directories: vec![],
        backup: json!({"workspaceId":"workspace:test","revision":revision}),
    }
}
#[test]
fn utf8_binary_rename_and_trash_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let mut w = Workspace::open(dir.path()).unwrap();
    let p = plan(&mut w, 1, "Felsefe/Bilinç.md", "# Qualia\n\nTürkçe 👋");
    w.commit(p).unwrap();
    assert_eq!(
        fs::read_to_string(dir.path().join("Felsefe/Bilinç.md")).unwrap(),
        "# Qualia\n\nTürkçe 👋"
    );
    assert_eq!(
        fs::read(dir.path().join("assets/read.pdf")).unwrap(),
        b"%PDF-1.4\nbytes"
    );
    let p = plan(&mut w, 2, "AI/Zihin.md", "# Yeni içerik");
    w.commit(p).unwrap();
    assert!(!dir.path().join("Felsefe/Bilinç.md").exists());
    assert!(
        fs::read_dir(dir.path().join(".knowledge-canvas/trash"))
            .unwrap()
            .filter_map(|e| e.ok())
            .any(|e| fs::read_to_string(e.path().join("Felsefe/Bilinç.md"))
                .ok()
                .as_deref()
                == Some("# Qualia\n\nTürkçe 👋"))
    );
    drop(w);
    let mut reopened = Workspace::open(dir.path()).unwrap();
    assert!(
        reopened
            .snapshot()
            .unwrap()
            .files
            .iter()
            .any(|f| f.path == "AI/Zihin.md" && f.data == "# Yeni içerik")
    );
}
#[test]
fn external_change_preserves_disk_and_local_draft() {
    let dir = tempfile::tempdir().unwrap();
    let mut w = Workspace::open(dir.path()).unwrap();
    let p = plan(&mut w, 1, "Note.md", "original");
    w.commit(p).unwrap();
    let p = plan(&mut w, 2, "Note.md", "local");
    w.checkpoint(json!({"revision":2,"local":"local"})).unwrap();
    fs::write(dir.path().join("Note.md"), "external").unwrap();
    assert!(w.commit(p).err().unwrap().contains("DISK_CONFLICT"));
    assert_eq!(
        fs::read_to_string(dir.path().join("Note.md")).unwrap(),
        "external"
    );
    assert_eq!(w.snapshot().unwrap().draft.unwrap()["local"], "local");
}
#[test]
fn interrupted_rename_rolls_back_on_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let mut w = Workspace::open(dir.path()).unwrap();
    let p = plan(&mut w, 1, "Old.md", "original");
    w.commit(p).unwrap();
    let p = plan(&mut w, 2, "New.md", "replacement");
    assert!(w.commit_inner(p, Some(2)).is_err());
    drop(w);
    let mut reopened = Workspace::open(dir.path()).unwrap();
    assert_eq!(
        fs::read_to_string(dir.path().join("Old.md")).unwrap(),
        "original"
    );
    assert!(!dir.path().join("New.md").exists());
    assert_eq!(reopened.json(MANIFEST).unwrap().unwrap()["revision"], 1);
    assert!(reopened.snapshot().is_ok());
    assert!(!dir.path().join(JOURNAL).exists());
}
#[test]
fn interrupted_committed_manifest_preserves_new_generation() {
    let dir = tempfile::tempdir().unwrap();
    let mut w = Workspace::open(dir.path()).unwrap();
    let p = plan(&mut w, 1, "Old.md", "original");
    w.commit(p).unwrap();
    let p = plan(&mut w, 2, "Old.md", "new");
    assert!(w.commit_inner(p, Some(3)).is_err());
    drop(w);
    let mut reopened = Workspace::open(dir.path()).unwrap();
    assert_eq!(
        fs::read_to_string(dir.path().join("Old.md")).unwrap(),
        "new"
    );
    assert_eq!(reopened.json(MANIFEST).unwrap().unwrap()["revision"], 2);
    assert!(reopened.snapshot().is_ok());
    assert!(!dir.path().join(JOURNAL).exists());
}
#[test]
fn recovery_does_not_overwrite_external_edit_after_crash() {
    let dir = tempfile::tempdir().unwrap();
    let mut w = Workspace::open(dir.path()).unwrap();
    let p = plan(&mut w, 1, "Note.md", "original");
    w.commit(p).unwrap();
    let p = plan(&mut w, 2, "Note.md", "local");
    assert!(w.commit_inner(p, Some(2)).is_err());
    drop(w);
    fs::write(dir.path().join("Note.md"), "external after crash").unwrap();
    assert!(
        Workspace::open(dir.path())
            .err()
            .unwrap()
            .contains("dış değişiklik")
    );
    assert_eq!(
        fs::read_to_string(dir.path().join("Note.md")).unwrap(),
        "external after crash"
    );
    assert!(dir.path().join(JOURNAL).exists());
}
#[test]
fn native_writer_lock_and_monotonic_drafts() {
    let dir = tempfile::tempdir().unwrap();
    let mut first = Workspace::open(dir.path()).unwrap();
    let mut second = Workspace::open(dir.path()).unwrap();
    assert!(first.writable);
    assert!(!second.writable);
    assert!(second.checkpoint(json!({"revision":1})).is_err());
    first
        .checkpoint(json!({"revision":5,"local":"latest"}))
        .unwrap();
    first
        .checkpoint(json!({"revision":3,"local":"old"}))
        .unwrap();
    let p = plan(&mut first, 1, "Note.md", "committed");
    first.commit(p).unwrap();
    assert_eq!(second.snapshot().unwrap().draft.unwrap()["revision"], 5);
    drop(first);
    drop(second);
    assert!(Workspace::open(dir.path()).unwrap().writable);
}
#[test]
fn traversal_and_symlinks_stay_within_selected_root() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    fs::write(outside.path().join("Secret.md"), "keep").unwrap();
    let mut w = Workspace::open(dir.path()).unwrap();
    for path in [
        "../Secret.md",
        "/tmp/Secret.md",
        "a/../Secret.md",
        "a\\Secret.md",
        "C:/Secret.md",
    ] {
        assert!(w.read(path).is_err());
        let p = plan(&mut w, 1, path, "overwrite");
        assert!(w.commit(p).is_err());
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(outside.path(), dir.path().join("escape")).unwrap();
        assert!(w.read("escape/Secret.md").is_err());
        let p = plan(&mut w, 1, "escape/Secret.md", "overwrite");
        assert!(w.commit(p).is_err());
    }
    assert_eq!(
        fs::read_to_string(outside.path().join("Secret.md")).unwrap(),
        "keep"
    );
}
#[test]
fn uppercase_external_markdown_is_adopted_without_renaming() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("Dış Not.MD"), "Türkçe").unwrap();
    let mut w = Workspace::open(dir.path()).unwrap();
    let p = plan(&mut w, 1, "Dış Not.MD", "Türkçe");
    w.commit(p).unwrap();
    assert_eq!(
        fs::read_to_string(dir.path().join("Dış Not.MD")).unwrap(),
        "Türkçe"
    );
}
#[test]
fn readonly_reader_rejects_a_partly_applied_generation() {
    let dir = tempfile::tempdir().unwrap();
    let mut writer = Workspace::open(dir.path()).unwrap();
    let p = plan(&mut writer, 1, "Note.md", "before");
    writer.commit(p).unwrap();
    let mut reader = Workspace::open(dir.path()).unwrap();
    let p = plan(&mut writer, 2, "Note.md", "after");
    assert!(writer.commit_inner(p, Some(1)).is_err());
    assert!(reader.snapshot().is_err());
    writer.recover().unwrap();
    assert!(
        reader
            .snapshot()
            .unwrap()
            .files
            .iter()
            .any(|f| f.path == "Note.md" && f.data == "before")
    );
}
#[test]
fn deleted_pdf_and_board_are_recoverable_in_trash() {
    let dir = tempfile::tempdir().unwrap();
    let mut w = Workspace::open(dir.path()).unwrap();
    let mut p = plan(&mut w, 1, "Note.md", "keep");
    let mut manifest: Value = serde_json::from_str(&p.files[0].data).unwrap();
    manifest["boards"] = json!([{"path":"Board.board.json"}]);
    p.files[0].data = manifest.to_string();
    p.files
        .push(text("Board.board.json", "{\"document\":\"before\"}"));
    w.commit(p).unwrap();
    let mut p = plan(&mut w, 2, "Note.md", "keep");
    let mut manifest: Value = serde_json::from_str(&p.files[0].data).unwrap();
    manifest["pdfs"] = json!([]);
    p.files[0].data = manifest.to_string();
    p.files.retain(|f| f.path != "assets/read.pdf");
    w.commit(p).unwrap();
    assert!(!dir.path().join("assets/read.pdf").exists());
    assert!(!dir.path().join("Board.board.json").exists());
    let generations: Vec<_> = fs::read_dir(dir.path().join(".knowledge-canvas/trash"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    assert!(
        generations.iter().any(
            |p| fs::read(p.join("assets/read.pdf")).ok().as_deref() == Some(b"%PDF-1.4\nbytes")
        )
    );
    assert!(generations.iter().any(|p| {
        fs::read_to_string(p.join("Board.board.json"))
            .ok()
            .as_deref()
            == Some("{\"document\":\"before\"}")
    }));
}
