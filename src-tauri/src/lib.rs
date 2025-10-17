mod inference;

use inference::{ModelInference, ModelType, InferenceResult, BatchResult, InferenceStats};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct InferenceRequest {
    pub model_path: String,
    pub image_path: Option<String>,
    pub image_dir: Option<String>,
    pub model_type: String,
    pub class_names_path: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct InferenceResponse {
    pub success: bool,
    pub message: String,
    pub results: Option<Vec<InferenceResult>>,
    pub batch_results: Option<HashMap<String, BatchResult>>,
    pub stats: Option<InferenceStats>,
}

// 全局狀態管理
struct AppState {
    inference_engine: Mutex<ModelInference>,
}

#[tauri::command]
fn load_model(
    state: State<'_, AppState>,
    model_path: String,
    model_type: String,
    class_names_path: Option<String>,
) -> Result<InferenceResponse, String> {
    let model_type_enum = match model_type.to_lowercase().as_str() {
        "torchscript" => ModelType::TorchScript,
        "onnx" => ModelType::ONNX,
        _ => return Ok(InferenceResponse {
            success: false,
            message: "不支持的模型類型".to_string(),
            results: None,
            batch_results: None,
            stats: None,
        }),
    };

    let mut engine = state.inference_engine.lock().map_err(|e| e.to_string())?;
    
    // 使用 tokio::task::block_in_place 來處理異步操作
    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(async {
            engine.load_model(&model_path, model_type_enum).await
        })
    });
    
    match result {
        Ok(_) => {
            if let Some(class_path) = class_names_path {
                if let Err(e) = engine.load_class_names(Some(&class_path)) {
                    return Ok(InferenceResponse {
                        success: false,
                        message: format!("載入類別名稱失敗: {}", e),
                        results: None,
                        batch_results: None,
                        stats: None,
                    });
                }
            } else {
                engine.load_class_names(None).map_err(|e| e.to_string())?;
            }
            
            Ok(InferenceResponse {
                success: true,
                message: "模型載入成功".to_string(),
                results: None,
                batch_results: None,
                stats: None,
            })
        }
        Err(e) => Ok(InferenceResponse {
            success: false,
            message: format!("載入模型失敗: {}", e),
            results: None,
            batch_results: None,
            stats: None,
        }),
    }
}

#[tauri::command]
fn infer_single_image(
    state: State<'_, AppState>,
    image_path: String,
) -> Result<InferenceResponse, String> {
    let engine = state.inference_engine.lock().map_err(|e| e.to_string())?;
    
    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(async {
            engine.infer_single_image(&image_path).await
        })
    });
    
    match result {
        Ok((results, inference_time)) => {
            println!("推理時間: {:.2} 毫秒", inference_time);
            Ok(InferenceResponse {
                success: true,
                message: format!("推理完成，耗時 {:.2} 毫秒", inference_time),
                results: Some(results),
                batch_results: None,
                stats: None,
            })
        }
        Err(e) => Ok(InferenceResponse {
            success: false,
            message: format!("推理失敗: {}", e),
            results: None,
            batch_results: None,
            stats: None,
        }),
    }
}

#[tauri::command]
fn batch_inference(
    state: State<'_, AppState>,
    image_dir: String,
) -> Result<InferenceResponse, String> {
    let engine = state.inference_engine.lock().map_err(|e| e.to_string())?;
    
    let result = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(async {
            engine.batch_inference(&image_dir).await
        })
    });
    
    match result {
        Ok((batch_results, stats)) => {
            println!("批量推理統計:");
            println!("處理的圖像數量: {}", stats.total_images);
            println!("成功處理的圖像數量: {}", stats.successful_images);
            println!("總推理時間: {:.2} 毫秒", stats.total_time_ms);
            println!("平均每張圖像推理時間: {:.2} 毫秒", stats.average_time_ms);
            println!("推理速度: {:.2} FPS", stats.fps);
            
            Ok(InferenceResponse {
                success: true,
                message: "批量推理完成".to_string(),
                results: None,
                batch_results: Some(batch_results),
                stats: Some(stats),
            })
        }
        Err(e) => Ok(InferenceResponse {
            success: false,
            message: format!("批量推理失敗: {}", e),
            results: None,
            batch_results: None,
            stats: None,
        }),
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            inference_engine: Mutex::new(ModelInference::new()),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            load_model,
            infer_single_image,
            batch_inference
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}