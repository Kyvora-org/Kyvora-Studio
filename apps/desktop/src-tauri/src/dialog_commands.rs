use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_project_save_path(
    app: tauri::AppHandle,
    default_name: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();

    let name = default_name.unwrap_or_else(|| "Mi proyecto.xtp".to_string());
    dialog = dialog.set_file_name(&name);
    dialog = dialog.add_filter("Proyecto Kyvora Studio (*.xtp)", &["xtp"]);

    let chosen = dialog.blocking_save_file();
    let file_path = chosen.and_then(|p| p.as_path().map(|path| path.to_string_lossy().to_string()));

    Ok(file_path)
}

#[tauri::command]
pub async fn pick_project_open_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dialog = app
        .dialog()
        .file()
        .add_filter("Proyecto Kyvora Studio (*.xtp)", &["xtp"]);

    let chosen = dialog.blocking_pick_file();
    let file_path = chosen.and_then(|p| p.as_path().map(|path| path.to_string_lossy().to_string()));

    Ok(file_path)
}

#[tauri::command]
pub async fn pick_export_save_path(
    app: tauri::AppHandle,
    default_name: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();

    let name = default_name.unwrap_or_else(|| "Video_Exportado.mp4".to_string());
    dialog = dialog.set_file_name(&name);
    dialog = dialog.add_filter("Video MP4 (*.mp4)", &["mp4"]);

    let chosen = dialog.blocking_save_file();
    let file_path = chosen.and_then(|p| p.as_path().map(|path| path.to_string_lossy().to_string()));

    Ok(file_path)
}

#[tauri::command]
pub async fn pick_media_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dialog = app
        .dialog()
        .file()
        .add_filter("Archivos multimedia", &["mp4", "mkv", "avi", "mov", "webm", "mp3", "wav", "aac", "flac", "ogg", "m4a", "jpg", "jpeg", "png", "webp", "gif", "bmp"]);

    let chosen = dialog.blocking_pick_files();
    let paths = match chosen {
        Some(list) => list
            .into_iter()
            .filter_map(|p| p.as_path().map(|path| path.to_string_lossy().to_string()))
            .collect(),
        None => Vec::new(),
    };

    Ok(paths)
}

#[tauri::command]
pub async fn pick_folder_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dialog = app.dialog().file();
    let chosen = dialog.blocking_pick_folder();
    let folder_path = chosen.and_then(|p| p.as_path().map(|path| path.to_string_lossy().to_string()));
    Ok(folder_path)
}

#[tauri::command]
pub async fn scan_media_folder(folder_path: String) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let allowed_exts = ["mp4", "mkv", "avi", "mov", "webm", "mp3", "wav", "aac", "flac", "ogg", "m4a", "jpg", "jpeg", "png", "webp", "gif", "bmp"];
    if let Ok(entries) = std::fs::read_dir(&folder_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if allowed_exts.contains(&ext.to_lowercase().as_str()) {
                        files.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    // Ordenar alfabéticamente para secuencias de imágenes o clips ordenados
    files.sort();
    Ok(files)
}

#[tauri::command]
pub async fn write_temp_media_file(
    app: tauri::AppHandle,
    filename: String,
    contents: Vec<u8>,
) -> Result<String, String> {
    use tauri::Manager;
    let temp_dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("kyvora_media_staging");

    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Error creando carpeta temporal: {}", e))?;

    let file_path = temp_dir.join(&filename);
    std::fs::write(&file_path, &contents).map_err(|e| format!("Error escribiendo medio temporal {}: {}", file_path.display(), e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cleanup_temp_media_files(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let temp_dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("kyvora_media_staging");

    if temp_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
    Ok(())
}

#[tauri::command]
pub async fn check_file_exists(file_path: String) -> Result<bool, String> {
    let p = std::path::Path::new(&file_path);
    Ok(p.exists() && p.is_file())
}

#[tauri::command]
pub async fn read_project_binary_file(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| format!("Error al leer {}: {}", file_path, e))
}

#[tauri::command]
pub async fn write_project_binary_file(file_path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&file_path, &contents).map_err(|e| format!("Error al escribir {}: {}", file_path, e))
}

