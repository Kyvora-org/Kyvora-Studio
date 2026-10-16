use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportJobProgress {
    pub percentage: f32,
    pub current_time_seconds: f64,
    pub total_duration_seconds: f64,
    pub fps: f32,
    pub speed: String,
    pub is_completed: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportTaskRequest {
    pub output_path: String,
    pub duration_seconds: f64,
    pub ffmpeg_args: Vec<String>,
}

// Global cancellation flag for active export job
static IS_EXPORT_CANCELLED: AtomicBool = AtomicBool::new(false);

fn get_export_log_path() -> PathBuf {
    if let Ok(app_data) = std::env::var("APPDATA") {
        let dir = PathBuf::from(app_data).join("Kyvora").join("logs");
        let _ = std::fs::create_dir_all(&dir);
        return dir.join("kyvora_export.log");
    }
    std::env::temp_dir().join("kyvora_export.log")
}

pub fn append_export_log_disk(stage: &str, message: &str) {
    let log_path = get_export_log_path();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
        let duration = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default();
        let secs = duration.as_secs();
        let millis = duration.subsec_millis();
        let _ = writeln!(file, "[timestamp={}.{:03}s] [{}] {}", secs, millis, stage, message);
    }
}

#[tauri::command]
pub fn cancel_export_task() -> bool {
    IS_EXPORT_CANCELLED.store(true, Ordering::SeqCst);
    append_export_log_disk("CANCEL_REQUESTED", "Export task cancellation requested by user");
    true
}

#[tauri::command]
pub fn append_export_log(stage: String, message: String) -> bool {
    append_export_log_disk(&stage, &message);
    true
}

#[tauri::command]
pub fn get_export_log_location() -> String {
    get_export_log_path().to_string_lossy().to_string()
}

#[tauri::command]
pub async fn execute_ffmpeg_export(
    app_handle: tauri::AppHandle,
    request: ExportTaskRequest,
) -> Result<String, String> {
    IS_EXPORT_CANCELLED.store(false, Ordering::SeqCst);

    let log_path_str = get_export_log_path().to_string_lossy().to_string();
    append_export_log_disk("EXPORT_START", &format!("Iniciando exportación hacia: '{}'. Duración: {:.2}s. Log: {}", request.output_path, request.duration_seconds, log_path_str));

    // 1. Validaciones preventivas de seguridad en argumentos y rutas
    if request.output_path.is_empty() || request.output_path.contains('\0') {
        let err = "Ruta de exportación inválida".to_string();
        append_export_log_disk("VALIDATION_ERROR", &err);
        return Err(err);
    }

    for arg in &request.ffmpeg_args {
        if arg.contains('\0') {
            let err = "Argumento con caracteres nulos no permitido".to_string();
            append_export_log_disk("VALIDATION_ERROR", &err);
            return Err(err);
        }
    }

    append_export_log_disk("FFMPEG_ARGS", &format!("Argumentos FFmpeg: {:?}", request.ffmpeg_args));

    // 2. Ejecutar FFmpeg en un thread bloqueante dedicado fuera del Tokio runtime de Tauri
    let output_path_clone = request.output_path.clone();
    let duration = request.duration_seconds;
    let ffmpeg_args = request.ffmpeg_args.clone();

    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let mut child = match Command::new("ffmpeg")
            .args(&ffmpeg_args)
            .stderr(Stdio::piped())
            .stdout(Stdio::null())
            .spawn()
        {
            Ok(proc) => proc,
            Err(e) => {
                let err = format!("No se pudo iniciar FFmpeg en el sistema (Verifique instalación en PATH): {}", e);
                append_export_log_disk("SPAWN_ERROR", &err);
                return Err(err);
            }
        };

        let stderr = match child.stderr.take() {
            Some(s) => s,
            None => {
                let err = "No se pudo conectar con el flujo de diagnóstico de FFmpeg".to_string();
                append_export_log_disk("STDERR_ERROR", &err);
                return Err(err);
            }
        };

        let reader = BufReader::new(stderr);
        let mut stderr_lines: Vec<String> = Vec::new();
        let mut last_emit_time = Instant::now();
        let mut last_percentage: f32 = -1.0;

        for line in reader.lines() {
            if IS_EXPORT_CANCELLED.load(Ordering::SeqCst) {
                let _ = child.kill();
                let _ = child.wait();
                append_export_log_disk("CANCELLED", "Subproceso FFmpeg terminado por cancelación.");
                let _ = app_handle.emit(
                    "export-progress",
                    ExportJobProgress {
                        percentage: 0.0,
                        current_time_seconds: 0.0,
                        total_duration_seconds: duration,
                        fps: 0.0,
                        speed: "0x".to_string(),
                        is_completed: false,
                        error: Some("Exportación cancelada por el usuario".to_string()),
                    },
                );
                return Err("Exportación cancelada por el usuario".to_string());
            }

            if let Ok(l) = line {
                if stderr_lines.len() >= 60 {
                    stderr_lines.remove(0);
                }
                stderr_lines.push(l.clone());

                if l.contains("time=") {
                    let current_sec = parse_time_from_ffmpeg_line(&l);
                    let percentage = if duration > 0.0 {
                        ((current_sec / duration) * 100.0).clamp(0.0, 99.0) as f32
                    } else {
                        50.0
                    };

                    let now = Instant::now();
                    // Throttle IPC events to at most once every 250ms or when percentage increases by >= 1%
                    if now.duration_since(last_emit_time).as_millis() >= 250 || (percentage - last_percentage) >= 1.0 {
                        last_emit_time = now;
                        last_percentage = percentage;

                        let _ = app_handle.emit(
                            "export-progress",
                            ExportJobProgress {
                                percentage,
                                current_time_seconds: current_sec,
                                total_duration_seconds: duration,
                                fps: parse_fps_from_ffmpeg_line(&l),
                                speed: parse_speed_from_ffmpeg_line(&l),
                                is_completed: false,
                                error: None,
                            },
                        );
                    }
                }
            }
        }

        let status = child.wait().map_err(|e| {
            let err = format!("Error esperando terminación de FFmpeg: {}", e);
            append_export_log_disk("WAIT_ERROR", &err);
            err
        })?;

        if !status.success() {
            let diag = stderr_lines.join("\n");
            let err = format!(
                "FFmpeg finalizó con error (código {:?}):\n{}",
                status.code(),
                if diag.is_empty() { "Sin salida de diagnóstico" } else { &diag }
            );
            append_export_log_disk("FFMPEG_FAILED", &err);
            return Err(err);
        }

        // Validación de existencia y tamaño de salida
        let out_path = std::path::Path::new(&output_path_clone);
        if !out_path.exists() {
            let err = format!(
                "Validación fallida: El archivo de salida '{}' no fue generado por FFmpeg.",
                output_path_clone
            );
            append_export_log_disk("OUTPUT_MISSING", &err);
            return Err(err);
        }

        let file_size = match std::fs::metadata(out_path) {
            Ok(meta) => meta.len(),
            Err(e) => {
                let err = format!("Error leyendo propiedades del archivo exportado: {}", e);
                append_export_log_disk("METADATA_ERROR", &err);
                return Err(err);
            }
        };

        if file_size == 0 {
            let err = format!(
                "Validación fallida: El archivo exportado '{}' se creó pero tiene 0 bytes.",
                output_path_clone
            );
            append_export_log_disk("ZERO_BYTES", &err);
            return Err(err);
        }

        let _ = app_handle.emit(
            "export-progress",
            ExportJobProgress {
                percentage: 100.0,
                current_time_seconds: duration,
                total_duration_seconds: duration,
                fps: 0.0,
                speed: "1x".to_string(),
                is_completed: true,
                error: None,
            },
        );

        let success_msg = format!(
            "Archivo exportado exitosamente en: {} ({:.2} MB)",
            output_path_clone,
            file_size as f64 / (1024.0 * 1024.0)
        );
        append_export_log_disk("EXPORT_SUCCESS", &success_msg);

        Ok(success_msg)
    })
    .await
    .map_err(|e| {
        let err = format!("Error en tarea asíncrona de renderizado: {}", e);
        append_export_log_disk("SPAWN_JOIN_ERROR", &err);
        err
    })?
}

fn parse_time_from_ffmpeg_line(line: &str) -> f64 {
    if let Some(pos) = line.find("time=") {
        let after = &line[pos + 5..];
        let token = after.split_whitespace().next().unwrap_or("");
        let parts: Vec<&str> = token.split(':').collect();
        if parts.len() == 3 {
            let h = parts[0].parse::<f64>().unwrap_or(0.0);
            let m = parts[1].parse::<f64>().unwrap_or(0.0);
            let s = parts[2].parse::<f64>().unwrap_or(0.0);
            return (h * 3600.0) + (m * 60.0) + s;
        }
    }
    0.0
}

fn parse_fps_from_ffmpeg_line(line: &str) -> f32 {
    if let Some(pos) = line.find("fps=") {
        let after = &line[pos + 4..];
        let token = after.split_whitespace().next().unwrap_or("0");
        return token.parse::<f32>().unwrap_or(0.0);
    }
    0.0
}

fn parse_speed_from_ffmpeg_line(line: &str) -> String {
    if let Some(pos) = line.find("speed=") {
        let after = &line[pos + 6..];
        let token = after.split_whitespace().next().unwrap_or("1x");
        return token.to_string();
    }
    "1x".to_string()
}

