mod media_probe;
mod export_engine;
mod dialog_commands;

use media_probe::{probe_media_file, generate_media_thumbnail};
use export_engine::{execute_ffmpeg_export, cancel_export_task, append_export_log, get_export_log_location, get_export_progress};
use dialog_commands::{
    pick_project_save_path, 
    pick_project_open_path, 
    pick_export_save_path,
    pick_media_files,
    pick_folder_path,
    scan_media_folder,
    write_temp_media_file,
    cleanup_temp_media_files,
    read_project_binary_file,
    write_project_binary_file,
    check_file_exists
};

#[tauri::command]
fn get_app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_app_version, 
            probe_media_file,
            generate_media_thumbnail,
            execute_ffmpeg_export,
            cancel_export_task,
            append_export_log,
            get_export_log_location,
            get_export_progress,
            pick_project_save_path,
            pick_project_open_path,
            pick_export_save_path,
            pick_media_files,
            pick_folder_path,
            scan_media_folder,
            write_temp_media_file,
            cleanup_temp_media_files,
            read_project_binary_file,
            write_project_binary_file,
            check_file_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kyvora Studio desktop application");
}

