use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FFprobeResult {
    pub success: bool,
    pub format_name: Option<String>,
    pub duration_seconds: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub frame_rate: Option<f64>,
    pub audio_channels: Option<u32>,
    pub sample_rate: Option<u32>,
    pub codec_name: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
    channels: Option<u32>,
    sample_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawFormat {
    format_name: Option<String>,
    duration: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawFFprobeOutput {
    streams: Option<Vec<RawStream>>,
    format: Option<RawFormat>,
}

pub fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(CHARSET[(b0 >> 2) as usize] as char);
        result.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARSET[(((b1 & 0x0F) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARSET[(b2 & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

#[tauri::command]
pub fn probe_media_file(file_path: String) -> FFprobeResult {
    // 1. Validaciones preventivas de seguridad sobre la ruta
    if file_path.is_empty() || file_path.contains('\0') {
        return FFprobeResult {
            success: false,
            format_name: None,
            duration_seconds: None,
            width: None,
            height: None,
            frame_rate: None,
            audio_channels: None,
            sample_rate: None,
            codec_name: None,
            error: Some("Ruta de archivo no válida".to_string()),
        };
    }

    // 2. Ejecutar ffprobe de forma segura sin shell (argumentos directos)
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-print_format",
            "json",
            &file_path,
        ])
        .output();

    let output = match output {
        Ok(out) => out,
        Err(e) => {
            return FFprobeResult {
                success: false,
                format_name: None,
                duration_seconds: None,
                width: None,
                height: None,
                frame_rate: None,
                audio_channels: None,
                sample_rate: None,
                codec_name: None,
                error: Some(format!("FFprobe no disponible en el sistema: {}", e)),
            };
        }
    };

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return FFprobeResult {
            success: false,
            format_name: None,
            duration_seconds: None,
            width: None,
            height: None,
            frame_rate: None,
            audio_channels: None,
            sample_rate: None,
            codec_name: None,
            error: Some(format!("Error en FFprobe: {}", err_msg.trim())),
        };
    }

    // 3. Parsear JSON estructurado
    let parsed: RawFFprobeOutput = match serde_json::from_slice(&output.stdout) {
        Ok(data) => data,
        Err(e) => {
            return FFprobeResult {
                success: false,
                format_name: None,
                duration_seconds: None,
                width: None,
                height: None,
                frame_rate: None,
                audio_channels: None,
                sample_rate: None,
                codec_name: None,
                error: Some(format!("Error al parsear salida de FFprobe: {}", e)),
            };
        }
    };

    let mut width = None;
    let mut height = None;
    let mut frame_rate = None;
    let mut audio_channels = None;
    let mut sample_rate = None;
    let mut codec_name = None;

    if let Some(streams) = parsed.streams {
        for s in streams {
            if s.codec_type.as_deref() == Some("video") && width.is_none() {
                width = s.width;
                height = s.height;
                codec_name = s.codec_name;
                if let Some(fps_str) = s.r_frame_rate {
                    if let Some((num, den)) = fps_str.split_once('/') {
                        if let (Ok(n), Ok(d)) = (num.parse::<f64>(), den.parse::<f64>()) {
                            if d > 0.0 {
                                frame_rate = Some(n / d);
                            }
                        }
                    }
                }
            } else if s.codec_type.as_deref() == Some("audio") && audio_channels.is_none() {
                audio_channels = s.channels;
                if let Some(sr) = s.sample_rate {
                    sample_rate = sr.parse::<u32>().ok();
                }
                if codec_name.is_none() {
                    codec_name = s.codec_name;
                }
            }
        }
    }

    let mut format_name = None;
    let mut duration_seconds = None;

    if let Some(fmt) = parsed.format {
        format_name = fmt.format_name;
        if let Some(dur_str) = fmt.duration {
            duration_seconds = dur_str.parse::<f64>().ok();
        }
    }

    FFprobeResult {
        success: true,
        format_name,
        duration_seconds,
        width,
        height,
        frame_rate,
        audio_channels,
        sample_rate,
        codec_name,
        error: None,
    }
}

#[tauri::command]
pub async fn generate_media_thumbnail(
    file_path: String,
    offset_seconds: Option<f64>,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let ss = offset_seconds.unwrap_or(1.0).max(0.0).to_string();
        let output = Command::new("ffmpeg")
            .args([
                "-y",
                "-ss", &ss,
                "-i", &file_path,
                "-vframes", "1",
                "-s", "320x180",
                "-f", "image2pipe",
                "-vcodec", "mjpeg",
                "-"
            ])
            .output();

        match output {
            Ok(out) if out.status.success() && !out.stdout.is_empty() => {
                let b64 = base64_encode(&out.stdout);
                Ok(Some(format!("data:image/jpeg;base64,{}", b64)))
            }
            _ => Ok(None),
        }
    })
    .await
    .map_err(|e| format!("Error en tarea de generación de miniatura: {}", e))?
}
