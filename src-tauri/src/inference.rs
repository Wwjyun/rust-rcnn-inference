use anyhow::{anyhow, Result};
use image::GenericImageView;
use ndarray::Array3;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InferenceResult {
    pub class_id: usize,
    pub class_name: String,
    pub probability: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchResult {
    pub image_name: String,
    pub result: InferenceResult,
    pub inference_time_ms: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InferenceStats {
    pub total_images: usize,
    pub successful_images: usize,
    pub total_time_ms: f64,
    pub average_time_ms: f64,
    pub fps: f64,
}

pub struct ModelInference {
    class_names: Vec<String>,
    model_type: ModelType,
}

#[derive(Debug, Clone)]
pub enum ModelType {
    TorchScript,
    ONNX,
}

impl ModelInference {
    pub fn new() -> Self {
        Self {
            class_names: Vec::new(),
            model_type: ModelType::ONNX,
        }
    }

    pub async fn load_model(&mut self, model_path: &str, model_type: ModelType) -> Result<()> {
        self.model_type = model_type.clone();
        
        match model_type {
            ModelType::ONNX => self.load_onnx_model(model_path).await,
            ModelType::TorchScript => self.load_torchscript_model(model_path).await,
        }
    }

    async fn load_onnx_model(&mut self, _model_path: &str) -> Result<()> {
        // 簡化實現 - 暫時跳過實際的ONNX加載
        println!("ONNX模型加載功能正在開發中...");
        Ok(())
    }

    async fn load_torchscript_model(&mut self, _model_path: &str) -> Result<()> {
        // TorchScript模型加載需要tch庫和libtorch
        Err(anyhow!("TorchScript模型加載尚未實現，請使用ONNX模型"))
    }

    pub fn load_class_names(&mut self, class_names_path: Option<&str>) -> Result<()> {
        if let Some(path) = class_names_path {
            if Path::new(path).exists() {
                let content = std::fs::read_to_string(path)?;
                if path.ends_with(".json") {
                    self.class_names = serde_json::from_str(&content)?;
                } else {
                    self.class_names = content.lines().map(|s| s.to_string()).collect();
                }
            } else {
                println!("警告: 找不到類別名稱文件 {}", path);
                self.class_names = (0..1000).map(|i| format!("Class_{}", i)).collect();
            }
        } else {
            self.class_names = (0..1000).map(|i| format!("Class_{}", i)).collect();
        }
        Ok(())
    }

    pub fn preprocess_image(&self, image_path: &str) -> Result<Array3<f32>> {
        let img = image::open(image_path)?;
        let img = img.resize_exact(224, 224, image::imageops::FilterType::Lanczos3);
        
        let (width, height) = img.dimensions();
        let mut array = Array3::<f32>::zeros((3, height as usize, width as usize));
        
        let rgb_img = img.to_rgb8();
        for (y, row) in rgb_img.rows().enumerate() {
            for (x, pixel) in row.enumerate() {
                for c in 0..3 {
                    let normalized = (pixel[c] as f32 / 255.0 - [0.485, 0.456, 0.406][c]) / [0.229, 0.224, 0.225][c];
                    array[[c, y, x]] = normalized;
                }
            }
        }
        
        Ok(array)
    }

    pub async fn infer_single_image(&self, image_path: &str) -> Result<(Vec<InferenceResult>, f64)> {
        let start_time = Instant::now();
        
        // 預處理圖像
        let _preprocessed = self.preprocess_image(image_path)?;
        
        // 模擬推理過程
        let inference_time = start_time.elapsed().as_secs_f64() * 1000.0;
        
        // 生成模擬結果
        let results = self.generate_mock_results();
        
        Ok((results, inference_time))
    }

    fn generate_mock_results(&self) -> Vec<InferenceResult> {
        let mut results = Vec::new();
        let top_k = std::cmp::min(5, self.class_names.len());
        
        for i in 0..top_k {
            let probability = (100.0 - i as f32 * 15.0).max(5.0);
            let class_name = self.class_names.get(i).unwrap_or(&format!("Class_{}", i)).clone();
            
            results.push(InferenceResult {
                class_id: i,
                class_name,
                probability,
            });
        }
        
        results
    }

    pub async fn batch_inference(&self, image_dir: &str) -> Result<(HashMap<String, BatchResult>, InferenceStats)> {
        let mut results = HashMap::new();
        let mut total_time = 0.0;
        let mut success_count = 0;
        
        let entries = std::fs::read_dir(image_dir)?;
        let image_files: Vec<_> = entries
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    matches!(ext.to_str(), Some("png") | Some("jpg") | Some("jpeg") | Some("bmp") | Some("webp"))
                } else {
                    false
                }
            })
            .collect();
        
        let total_files = image_files.len();
        
        for entry in &image_files {
            let image_path = entry.path();
            let image_name = image_path.file_name().unwrap().to_string_lossy().to_string();
            
            println!("處理: {}", image_name);
            
            match self.infer_single_image(&image_path.to_string_lossy()).await {
                Ok((inference_results, inference_time)) => {
                    if let Some(result) = inference_results.first() {
                        results.insert(image_name.clone(), BatchResult {
                            image_name,
                            result: result.clone(),
                            inference_time_ms: inference_time,
                        });
                        total_time += inference_time;
                        success_count += 1;
                    }
                }
                Err(e) => {
                    println!("處理 {} 時出錯: {}", image_name, e);
                }
            }
        }
        
        let stats = InferenceStats {
            total_images: total_files,
            successful_images: success_count,
            total_time_ms: total_time,
            average_time_ms: if success_count > 0 { total_time / success_count as f64 } else { 0.0 },
            fps: if total_time > 0.0 { 1000.0 * success_count as f64 / total_time } else { 0.0 },
        };
        
        Ok((results, stats))
    }
}

impl Default for ModelInference {
    fn default() -> Self {
        Self::new()
    }
}