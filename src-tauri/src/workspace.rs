use base64::{Engine, engine::general_purpose::STANDARD};
use cap_std::{
    ambient_authority,
    fs::{Dir, OpenOptions},
};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
};

const META: &str = ".knowledge-canvas";
const MANIFEST: &str = ".knowledge-canvas/workspace.json";
const JOURNAL: &str = ".knowledge-canvas/journal.json";
const DRAFT: &str = ".knowledge-canvas/draft.json";
const LAST_GOOD: &str = ".knowledge-canvas/last-good.json";
const LIMIT: usize = 256 * 1024 * 1024;
#[cfg(test)]
#[path = "workspace_tests.rs"]
mod tests;
type Result<T> = std::result::Result<T, String>;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FileData {
    pub path: String,
    pub encoding: String,
    pub data: String,
}
impl FileData {
    fn bytes(&self) -> Result<Vec<u8>> {
        match self.encoding.as_str() {
            "utf8" => Ok(self.data.as_bytes().to_vec()),
            "base64" => STANDARD.decode(&self.data).map_err(|e| e.to_string()),
            _ => Err("Desteklenmeyen dosya kodlaması.".into()),
        }
    }
}
#[derive(Serialize, Deserialize)]
pub struct Snapshot {
    pub path: String,
    pub writable: bool,
    pub token: String,
    pub files: Vec<FileData>,
    pub draft: Option<Value>,
    pub last_good: Option<Value>,
    pub warnings: Vec<String>,
}
#[derive(Deserialize)]
pub struct Commit {
    pub files: Vec<FileData>,
    pub directories: Vec<String>,
    pub backup: Value,
    pub expected_token: String,
}
#[derive(Serialize, Deserialize)]
struct Change {
    path: String,
    before: Option<String>,
    after: Option<String>,
    backup: String,
    stage: String,
}
#[derive(Serialize, Deserialize)]
struct Journal {
    version: u32,
    id: String,
    changes: Vec<Change>,
}

pub struct Workspace {
    root: Dir,
    pub path: PathBuf,
    pub writable: bool,
    _lock: std::fs::File,
    observed: BTreeSet<String>,
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn relative(path: &str) -> Result<()> {
    if path.is_empty()
        || path.contains(['\\', '\0', ':'])
        || Path::new(path)
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
        || path
            .split('/')
            .any(|p| p.is_empty() || p == "." || p == "..")
    {
        return Err(format!("Workspace dışına çıkan veya geçersiz yol: {path}"));
    }
    Ok(())
}
impl Workspace {
    pub fn open(path: &Path) -> Result<Self> {
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        let root = Dir::open_ambient_dir(&path, ambient_authority()).map_err(|e| e.to_string())?;
        if let Ok(meta) = root.symlink_metadata(META) {
            if meta.file_type().is_symlink() || !meta.is_dir() {
                return Err("Workspace metadata dizini symlink olamaz.".into());
            }
        }
        root.create_dir_all(META).map_err(|e| e.to_string())?;
        let lock_path = format!("{META}/writer.lock");
        if let Ok(meta) = root.symlink_metadata(&lock_path) {
            if meta.file_type().is_symlink() || !meta.is_file() {
                return Err("Workspace kilit dosyası geçersiz.".into());
            }
        }
        let lock = root
            .open_with(
                &lock_path,
                OpenOptions::new().read(true).write(true).create(true),
            )
            .map_err(|e| e.to_string())?
            .into_std();
        let writable = match FileExt::try_lock_exclusive(&lock) {
            Ok(()) => true,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => false,
            Err(e) => return Err(e.to_string()),
        };
        let mut workspace = Self {
            root,
            path,
            writable,
            _lock: lock,
            observed: BTreeSet::new(),
        };
        if workspace.read(JOURNAL)?.is_some() {
            if !writable {
                return Err(
                    "Workspace kurtarma bekliyor; yazan uygulamanın işlemi tamamlamasını bekleyin."
                        .into(),
                );
            }
            workspace.recover()?;
        }
        Ok(workspace)
    }
    fn guard(&self, path: &str) -> Result<()> {
        relative(path)?;
        let mut part = PathBuf::new();
        for component in Path::new(path).components() {
            part.push(component);
            match self.root.symlink_metadata(&part) {
                Ok(meta) if meta.file_type().is_symlink() => {
                    return Err(format!("Symlink dosyasına erişim engellendi: {path}"));
                }
                Ok(_) => (),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => break,
                Err(e) => return Err(e.to_string()),
            }
        }
        Ok(())
    }
    fn read(&self, path: &str) -> Result<Option<Vec<u8>>> {
        self.guard(path)?;
        match self.root.open(path) {
            Ok(mut file) => {
                if file.metadata().map_err(|e| e.to_string())?.len() > LIMIT as u64 {
                    return Err(format!("Dosya çok büyük: {path}"));
                }
                let mut bytes = Vec::new();
                Read::by_ref(&mut file)
                    .take((LIMIT + 1) as u64)
                    .read_to_end(&mut bytes)
                    .map_err(|e| e.to_string())?;
                if bytes.len() > LIMIT {
                    return Err(format!("Dosya çok büyük: {path}"));
                }
                Ok(Some(bytes))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(format!("{path}: {e}")),
        }
    }
    fn mkdir(&self, path: &str) -> Result<()> {
        self.guard(path)?;
        self.root.create_dir_all(path).map_err(|e| e.to_string())
    }
    fn sync_parent(&self, path: &str) -> Result<()> {
        let parent = Path::new(path)
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        self.root
            .open_dir(parent)
            .map_err(|e| e.to_string())?
            .into_std_file()
            .sync_all()
            .map_err(|e| e.to_string())
    }
    fn atomic(&self, path: &str, bytes: &[u8]) -> Result<()> {
        self.guard(path)?;
        let parent = Path::new(path)
            .parent()
            .filter(|p| !p.as_os_str().is_empty());
        if let Some(parent) = parent {
            self.mkdir(&parent.to_string_lossy())?;
        }
        let tmp = format!(
            "{}{}.{}.tmp",
            parent
                .map(|p| format!("{}/", p.display()))
                .unwrap_or_default(),
            Path::new(path).file_name().unwrap().to_string_lossy(),
            uuid::Uuid::new_v4()
        );
        let result = (|| {
            let mut file = self
                .root
                .open_with(&tmp, OpenOptions::new().write(true).create_new(true))
                .map_err(|e| e.to_string())?;
            file.write_all(bytes)
                .and_then(|_| file.sync_all())
                .map_err(|e| e.to_string())?;
            self.guard(path)?;
            self.root
                .rename(&tmp, &self.root, path)
                .map_err(|e| e.to_string())?;
            self.sync_parent(path)
        })();
        if result.is_err() {
            let _ = self.root.remove_file(&tmp);
        }
        result
    }
    fn json(&self, path: &str) -> Result<Option<Value>> {
        self.read(path)?
            .map(|b| serde_json::from_slice(&b).map_err(|e| format!("{path}: {e}")))
            .transpose()
    }
    fn require_writer(&self) -> Result<()> {
        if self.writable {
            Ok(())
        } else {
            Err("Workspace başka uygulamada düzenleniyor; bu pencere salt okunur.".into())
        }
    }
    fn walk(
        &self,
        directory: &str,
        files: &mut BTreeMap<String, Vec<u8>>,
        warnings: &mut Vec<String>,
        depth: usize,
        total: &mut usize,
    ) -> Result<()> {
        if depth > 64 || files.len() > 10000 {
            return Err("Workspace tarama sınırını aşıyor.".into());
        }
        for entry in self
            .root
            .read_dir(if directory.is_empty() { "." } else { directory })
            .map_err(|e| e.to_string())?
        {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry
                .file_name()
                .into_string()
                .map_err(|_| "UTF-8 olmayan dosya adı.".to_string())?;
            if name.starts_with('.') {
                continue;
            }
            let path = if directory.is_empty() {
                name.clone()
            } else {
                format!("{directory}/{name}")
            };
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_symlink() {
                warnings.push(format!("Symlink atlandı: {path}"));
                continue;
            }
            if kind.is_dir() {
                self.walk(&path, files, warnings, depth + 1, total)?;
            } else if kind.is_file()
                && (name.to_lowercase().ends_with(".md")
                    || name.to_lowercase().ends_with(".board.json")
                    || path.starts_with("assets/"))
            {
                if files.len() >= 10000 {
                    return Err("Workspace tarama sınırını aşıyor.".into());
                }
                if let Some(bytes) = self.read(&path)? {
                    *total += bytes.len();
                    if *total > LIMIT {
                        return Err("Workspace verisi 256 MB sınırını aşıyor.".into());
                    }
                    files.insert(path, bytes);
                }
            }
        }
        Ok(())
    }
    fn disk(&self) -> Result<(BTreeMap<String, Vec<u8>>, Vec<String>)> {
        let mut files = BTreeMap::new();
        let mut warnings = Vec::new();
        self.walk("", &mut files, &mut warnings, 0, &mut 0)?;
        if let Some(bytes) = self.read(MANIFEST)? {
            files.insert(MANIFEST.into(), bytes);
        }
        if files.values().map(Vec::len).sum::<usize>() > LIMIT {
            return Err("Workspace verisi 256 MB sınırını aşıyor.".into());
        }
        Ok((files, warnings))
    }
    fn token(files: &BTreeMap<String, Vec<u8>>) -> String {
        let mut digest = Sha256::new();
        for (path, bytes) in files {
            digest.update(path.as_bytes());
            digest.update([0]);
            digest.update(hash(bytes).as_bytes());
            digest.update([0]);
        }
        format!("{:x}", digest.finalize())
    }
    pub fn snapshot(&mut self) -> Result<Snapshot> {
        if self.read(JOURNAL)?.is_some() {
            if !self.writable {
                return Err(
                    "Workspace işlemi sürüyor; tamamlandıktan sonra Yenile ile tekrar deneyin."
                        .into(),
                );
            }
            self.recover()?;
        }
        let (files, warnings) = self.disk()?;
        let token = Self::token(&files);
        if !self.writable
            && (self.read(JOURNAL)?.is_some() || Self::token(&self.disk()?.0) != token)
        {
            return Err("Workspace okuma sırasında değişti; Yenile ile tekrar deneyin.".into());
        }
        self.observed = files.keys().cloned().collect();
        let mut encoded = Vec::new();
        for (path, bytes) in files {
            let binary = path.starts_with("assets/");
            let data = if binary {
                STANDARD.encode(&bytes)
            } else {
                String::from_utf8(bytes).map_err(|_| format!("Dosya UTF-8 değil: {path}"))?
            };
            encoded.push(FileData {
                path,
                encoding: if binary { "base64" } else { "utf8" }.into(),
                data,
            });
        }
        Ok(Snapshot {
            path: self.path.to_string_lossy().into(),
            writable: self.writable,
            token,
            files: encoded,
            draft: self.json(DRAFT)?,
            last_good: self.json(LAST_GOOD)?,
            warnings,
        })
    }
    fn managed(manifest: Option<&[u8]>) -> Result<BTreeSet<String>> {
        let Some(bytes) = manifest else {
            return Ok(BTreeSet::new());
        };
        let value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
        if value["format"] != "knowledge-canvas-files" || value["schemaVersion"] != 1 {
            return Err("Workspace dosya formatı desteklenmiyor.".into());
        }
        let mut paths = BTreeSet::new();
        for key in ["notes", "boards", "pdfs", "assets"] {
            let entries = value[key]
                .as_array()
                .ok_or("Manifest dosya listesi geçersiz.")?;
            for entry in entries {
                let path = entry["path"]
                    .as_str()
                    .ok_or("Manifest dosya yolu geçersiz.")?;
                Self::managed_path(path)?;
                paths.insert(path.into());
            }
        }
        Ok(paths)
    }
    fn managed_path(path: &str) -> Result<()> {
        relative(path)?;
        if path.split('/').any(|p| p.starts_with('.'))
            || !(path.to_lowercase().ends_with(".md")
                || path.to_lowercase().ends_with(".board.json")
                || (path.starts_with("assets/") && !path.ends_with('/')))
        {
            return Err(format!("Yönetilen dosya yolu geçersiz: {path}"));
        }
        Ok(())
    }
    pub fn checkpoint(&self, value: Value) -> Result<()> {
        self.require_writer()?;
        let revision = value["revision"]
            .as_u64()
            .ok_or("Taslak revision geçersiz.")?;
        let committed = self
            .json(MANIFEST)?
            .and_then(|v| v["revision"].as_u64())
            .unwrap_or(0);
        let draft = self
            .json(DRAFT)?
            .and_then(|v| v["revision"].as_u64())
            .unwrap_or(0);
        if revision > committed.max(draft) {
            self.atomic(
                DRAFT,
                &serde_json::to_vec(&value).map_err(|e| e.to_string())?,
            )?;
        }
        Ok(())
    }
    pub fn discard_draft(&self) -> Result<()> {
        self.require_writer()?;
        self.guard(DRAFT)?;
        if self.read(DRAFT)?.is_some() {
            self.root.remove_file(DRAFT).map_err(|e| e.to_string())?;
            self.sync_parent(DRAFT)?;
        }
        Ok(())
    }
    pub fn commit(&mut self, plan: Commit) -> Result<Snapshot> {
        self.require_writer()?;
        if self.read(JOURNAL)?.is_some() {
            self.recover()?;
        }
        if let Err(error) = self.commit_inner(plan, None) {
            if self.read(JOURNAL)?.is_some() {
                if let Err(recovery) = self.recover() {
                    return Err(format!("{error} Kurtarma gerekiyor: {recovery}"));
                }
            }
            return Err(error);
        }
        self.snapshot()
    }
    fn commit_inner(&mut self, plan: Commit, stop_after: Option<usize>) -> Result<()> {
        let (before, _) = self.disk()?;
        if Self::token(&before) != plan.expected_token {
            return Err("DISK_CONFLICT: Diskte değişiklik var. Yerel içerik korunuyor; Yenile ile sürüm seçin.".into());
        }
        let old = Self::managed(before.get(MANIFEST).map(Vec::as_slice))?;
        let mut after = BTreeMap::new();
        for file in plan.files {
            if file.path != MANIFEST {
                Self::managed_path(&file.path)?;
            }
            if after.contains_key(&file.path) {
                return Err("Yinelenen dosya yolu.".into());
            }
            let bytes = file.bytes()?;
            if before.contains_key(&file.path)
                && file.path != MANIFEST
                && !old.contains(&file.path)
                && !(file.path.to_lowercase().ends_with(".md")
                    && self.observed.contains(&file.path))
            {
                return Err(format!(
                    "Mevcut yönetilmeyen dosya korunuyor: {}",
                    file.path
                ));
            }
            after.insert(file.path, bytes);
        }
        let manifest = after.get(MANIFEST).ok_or("Workspace manifest eksik.")?;
        let managed = Self::managed(Some(manifest))?;
        let metadata: Value = serde_json::from_slice(manifest).map_err(|e| e.to_string())?;
        let revision = metadata["revision"]
            .as_u64()
            .ok_or("Manifest revision geçersiz.")?;
        if plan.backup["revision"].as_u64() != Some(revision)
            || plan.backup["workspaceId"] != metadata["workspaceId"]
        {
            return Err("Kayıt/yedek revision veya kimlik uyuşmuyor.".into());
        }
        let previous_revision = before
            .get(MANIFEST)
            .and_then(|b| serde_json::from_slice::<Value>(b).ok())
            .and_then(|v| v["revision"].as_u64());
        if previous_revision.is_some_and(|r| revision <= r) {
            return Err("Kayıt revision çakıştı.".into());
        }
        let missing_pdfs: BTreeSet<_> = metadata["pdfs"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|p| p["missing"] == true)
            .filter_map(|p| p["path"].as_str())
            .collect();
        if after
            .keys()
            .any(|path| path != MANIFEST && !managed.contains(path))
            || managed.iter().any(|p| {
                !after.contains_key(p)
                    && before.get(p).is_none()
                    && !missing_pdfs.contains(p.as_str())
            })
        {
            return Err("Manifest ve kayıt dosyaları uyuşmuyor.".into());
        }
        if after.values().map(Vec::len).sum::<usize>() > LIMIT {
            return Err("Workspace kayıt sınırı 256 MB.".into());
        }
        for path in &plan.directories {
            relative(path)?;
            if path.split('/').any(|p| p.starts_with('.')) || path == "assets" {
                return Err("Klasör yolu geçersiz.".into());
            }
            self.mkdir(path)?;
        }
        after.insert(
            LAST_GOOD.into(),
            serde_json::to_vec(&plan.backup).map_err(|e| e.to_string())?,
        );
        let id = uuid::Uuid::new_v4().to_string();
        let mut changes = Vec::new();
        let paths: BTreeSet<_> = after
            .keys()
            .chain(old.iter().filter(|p| !managed.contains(*p)))
            .cloned()
            .collect();
        for path in paths {
            let original = if path == LAST_GOOD {
                self.read(&path)?
            } else {
                before.get(&path).cloned()
            };
            let next = after.get(&path);
            if original.as_ref() == next {
                continue;
            }
            let backup = format!("{META}/transactions/{id}/before/{path}");
            let stage = format!("{META}/transactions/{id}/after/{path}");
            if let Some(bytes) = &original {
                self.atomic(&backup, bytes)?;
            }
            if let Some(bytes) = next {
                self.atomic(&stage, bytes)?;
            }
            changes.push(Change {
                path,
                before: original.as_deref().map(hash),
                after: next.map(|v| hash(v)),
                backup,
                stage,
            });
        }
        // Publish the manifest last. A durable manifest is the transaction commit point.
        changes.sort_by_key(|c| c.path == MANIFEST);
        if Self::token(&self.disk()?.0) != plan.expected_token {
            return Err(
                "DISK_CONFLICT: Kayıt hazırlanırken disk değişti; dosyalar korunuyor.".into(),
            );
        }
        let journal = Journal {
            version: 1,
            id,
            changes,
        };
        self.atomic(
            JOURNAL,
            &serde_json::to_vec(&journal).map_err(|e| e.to_string())?,
        )?;
        for (index, change) in journal.changes.iter().enumerate() {
            if self.read(&change.path)?.as_deref().map(hash) != change.before {
                return Err(format!(
                    "DISK_CONFLICT: İşlem sırasında değişti: {}",
                    change.path
                ));
            }
            if change.after.is_some() {
                let bytes = self
                    .read(&change.stage)?
                    .ok_or("Transaction stage eksik.")?;
                self.atomic(&change.path, &bytes)?;
            } else if change.before.is_some() {
                self.guard(&change.path)?;
                self.root
                    .remove_file(&change.path)
                    .map_err(|e| e.to_string())?;
                self.sync_parent(&change.path)?;
            }
            if stop_after == Some(index + 1) {
                return Err("Simulated process stop".into());
            }
        }
        self.finalize(&journal)?;
        // Drafts newer than this commit belong to later edits and must survive.
        if self
            .json(DRAFT)?
            .and_then(|v| v["revision"].as_u64())
            .is_some_and(|r| r <= revision)
        {
            self.discard_draft()?;
        }
        Ok(())
    }
    fn finalize(&self, journal: &Journal) -> Result<()> {
        let transaction = format!("{META}/transactions/{}", journal.id);
        let trash = format!("{META}/trash/{}", journal.id);
        self.mkdir(&format!("{META}/trash"))?;
        self.guard(&transaction)?;
        self.guard(&trash)?;
        // Keep only original user files. Full envelope/staged copies are recovery machinery.
        if self.root.symlink_metadata(&transaction).is_ok() {
            let before = format!("{transaction}/before");
            let old_metadata = format!("{before}/{META}");
            self.guard(&old_metadata)?;
            if self.root.symlink_metadata(&old_metadata).is_ok() {
                self.root
                    .remove_dir_all(&old_metadata)
                    .map_err(|e| e.to_string())?;
            }
            if self.root.symlink_metadata(&before).is_ok()
                && self.root.symlink_metadata(&trash).is_err()
            {
                self.root
                    .rename(&before, &self.root, &trash)
                    .map_err(|e| e.to_string())?;
                self.atomic(
                    &format!("{trash}/.transaction.json"),
                    &serde_json::to_vec(journal).map_err(|e| e.to_string())?,
                )?;
                self.sync_parent(&trash)?;
            }
            self.root
                .remove_dir_all(&transaction)
                .map_err(|e| e.to_string())?;
        }
        self.guard(JOURNAL)?;
        self.root.remove_file(JOURNAL).map_err(|e| e.to_string())?;
        self.sync_parent(JOURNAL)
    }
    pub fn recover(&mut self) -> Result<()> {
        self.require_writer()?;
        let Some(bytes) = self.read(JOURNAL)? else {
            return Ok(());
        };
        let journal: Journal = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        if journal.version != 1 || uuid::Uuid::parse_str(&journal.id).is_err() {
            return Err("Transaction günlüğü geçersiz.".into());
        }
        for change in &journal.changes {
            if change.path != MANIFEST && change.path != LAST_GOOD {
                Self::managed_path(&change.path)?;
            }
            if change.backup != format!("{META}/transactions/{}/before/{}", journal.id, change.path)
                || change.stage
                    != format!("{META}/transactions/{}/after/{}", journal.id, change.path)
            {
                return Err("Transaction yolu geçersiz.".into());
            }
        }
        let committed = journal
            .changes
            .iter()
            .find(|c| c.path == MANIFEST)
            .is_some_and(|c| self.read(MANIFEST).ok().flatten().as_deref().map(hash) == c.after);
        if !committed {
            // Do not overwrite an external edit that happened after an interrupted transaction.
            for change in &journal.changes {
                let current = self.read(&change.path)?.as_deref().map(hash);
                if current != change.before && current != change.after {
                    return Err(format!(
                        "Kurtarma sırasında dış değişiklik bulundu: {}. before/ kopyası transaction klasöründe korunuyor.",
                        change.path
                    ));
                }
            }
            for change in journal.changes.iter().rev() {
                if change.before.is_some() {
                    let bytes = self
                        .read(&change.backup)?
                        .ok_or("Kurtarma kopyası eksik.")?;
                    if Some(hash(&bytes)) != change.before {
                        return Err("Kurtarma kopyasının hash'i uyuşmuyor.".into());
                    }
                    self.atomic(&change.path, &bytes)?;
                } else if self.read(&change.path)?.is_some() {
                    self.guard(&change.path)?;
                    self.root
                        .remove_file(&change.path)
                        .map_err(|e| e.to_string())?;
                    self.sync_parent(&change.path)?;
                }
            }
        }
        self.finalize(&journal)
    }
}
