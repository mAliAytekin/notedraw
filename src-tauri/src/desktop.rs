use crate::workspace::{Commit, Snapshot, Workspace};
use base64::Engine;
use std::io::Write;
use std::{path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct Desktop {
    workspace: Mutex<Option<Workspace>>,
}
fn with_workspace<T>(
    state: &Desktop,
    action: impl FnOnce(&mut Workspace) -> Result<T, String>,
) -> Result<T, String> {
    let mut slot = state
        .workspace
        .lock()
        .map_err(|_| "Workspace kilidi kullanılamıyor.")?;
    action(slot.as_mut().ok_or("Workspace klasörü seçilmedi.")?)
}
fn settings(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(feature = "desktop-qa")]
    if let Some(path) = option_env!("NOTEDRAW_QA_SETTINGS") {
        return Ok(PathBuf::from(path).join("recent-workspace.json"));
    }
    // Native smoke tests use an isolated directory; production uses the standard app data location.
    if let Some(path) = std::env::var_os("NOTEDRAW_SETTINGS_DIR") {
        return Ok(PathBuf::from(path).join("recent-workspace.json"));
    }
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("recent-workspace.json"))
}
fn set_workspace(app: &AppHandle, state: &Desktop, path: PathBuf) -> Result<Snapshot, String> {
    let mut workspace = Workspace::open(&path)?;
    let snapshot = workspace.snapshot()?;
    let settings = settings(app)?;
    std::fs::create_dir_all(settings.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(
        settings,
        serde_json::to_vec(&path).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    *state
        .workspace
        .lock()
        .map_err(|_| "Workspace kilidi kullanılamıyor.")? = Some(workspace);
    Ok(snapshot)
}
#[tauri::command]
async fn workspace_choose(
    app: AppHandle,
    state: State<'_, Desktop>,
) -> Result<Option<Snapshot>, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("Knowledge Canvas workspace klasörünü seç")
        .blocking_pick_folder();
    match selected {
        Some(path) => {
            set_workspace(&app, &state, path.into_path().map_err(|e| e.to_string())?).map(Some)
        }
        None => Ok(None),
    }
}
#[tauri::command]
async fn workspace_resume(
    app: AppHandle,
    state: State<'_, Desktop>,
) -> Result<Option<Snapshot>, String> {
    let open = state
        .workspace
        .lock()
        .map_err(|_| "Workspace kilidi kullanılamıyor.")?
        .is_some();
    if open {
        return with_workspace(&state, |w| w.snapshot()).map(Some);
    }
    let settings = settings(&app)?;
    if !settings.exists() {
        return Ok(None);
    }
    let path: PathBuf =
        serde_json::from_slice(&std::fs::read(settings).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    set_workspace(&app, &state, path).map(Some)
}
#[tauri::command]
async fn workspace_read(state: State<'_, Desktop>) -> Result<Snapshot, String> {
    with_workspace(&state, |w| w.snapshot())
}
#[tauri::command]
async fn workspace_commit(state: State<'_, Desktop>, plan: Commit) -> Result<Snapshot, String> {
    with_workspace(&state, |w| w.commit(plan))
}
#[tauri::command]
async fn workspace_checkpoint(
    state: State<'_, Desktop>,
    value: serde_json::Value,
) -> Result<(), String> {
    with_workspace(&state, |w| w.checkpoint(value))
}
#[tauri::command]
async fn workspace_discard_draft(state: State<'_, Desktop>) -> Result<(), String> {
    with_workspace(&state, |w| w.discard_draft())
}
#[tauri::command]
async fn workspace_close(state: State<'_, Desktop>) -> Result<(), String> {
    *state
        .workspace
        .lock()
        .map_err(|_| "Workspace kilidi kullanılamıyor.")? = None;
    Ok(())
}
// The frontend supplies bytes, never a destination path. The native dialog
// grants access to exactly the file the user chooses for this export.
#[tauri::command]
async fn export_save(app: AppHandle, name: String, data: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| e.to_string())?;
    let selected = app
        .dialog()
        .file()
        .set_title("Dışa aktarılan dosyayı kaydet")
        .set_file_name(name)
        .blocking_save_file();
    let Some(selected) = selected else {
        return Ok(());
    };
    let path = selected.into_path().map_err(|e| e.to_string())?;
    save_export(&path, &bytes)
}
fn save_export(path: &std::path::Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Geçersiz kayıt konumu.")?;
    let temporary = parent.join(format!(".notedraw-export-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| -> std::io::Result<()> {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        std::fs::rename(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }
    result.map_err(|e| format!("Dosya kaydedilemedi: {e}"))
}

#[cfg(test)]
mod export_tests {
    use super::save_export;
    #[test]
    fn export_replaces_file_without_leaving_temporary_files() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("Türkçe.svg");
        std::fs::write(&path, b"old").unwrap();
        save_export(&path, "<svg>Türkçe</svg>".as_bytes()).unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "<svg>Türkçe</svg>");
        assert_eq!(std::fs::read_dir(root.path()).unwrap().count(), 1);
    }
    #[test]
    fn failed_export_keeps_existing_destination_and_cleans_temporary_file() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("directory.svg");
        std::fs::create_dir(&path).unwrap();
        assert!(save_export(&path, b"new").is_err());
        assert!(path.is_dir());
        assert_eq!(std::fs::read_dir(root.path()).unwrap().count(), 1);
    }
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Desktop::default())
        .invoke_handler(tauri::generate_handler![
            workspace_choose,
            workspace_resume,
            workspace_read,
            workspace_commit,
            workspace_checkpoint,
            workspace_discard_draft,
            workspace_close,
            export_save
        ])
        .run(tauri::generate_context!())
        .expect("Knowledge Canvas masaüstü uygulaması başlatılamadı");
}
