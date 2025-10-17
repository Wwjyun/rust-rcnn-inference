import { invoke } from "@tauri-apps/api/core";

// 定義類型
interface InferenceResult {
  class_id: number;
  class_name: string;
  probability: number;
}

interface BatchResult {
  image_name: string;
  result: InferenceResult;
  inference_time_ms: number;
}

interface InferenceStats {
  total_images: number;
  successful_images: number;
  total_time_ms: number;
  average_time_ms: number;
  fps: number;
}

interface InferenceResponse {
  success: boolean;
  message: string;
  results?: InferenceResult[];
  batch_results?: Record<string, BatchResult>;
  stats?: InferenceStats;
}

class InferenceApp {
  private modelLoaded = false;
  private currentImage: string | null = null;

  constructor() {
    this.initializeUI();
  }

  private initializeUI() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div class="container">
        <header>
          <h1>🤖 AI 模型推理工具</h1>
          <p>支持 ONNX 和 TorchScript 模型推理</p>
        </header>

        <div class="main-content">
          <!-- 模型配置區域 -->
          <div class="config-section">
            <h2>📁 模型配置</h2>
            <div class="form-group">
              <label for="model-path">模型文件路徑:</label>
              <div class="input-group">
                <input type="text" id="model-path" placeholder="選擇模型文件 (.onnx 或 .pt)" />
                <button id="browse-model">瀏覽</button>
              </div>
            </div>
            
            <div class="form-group">
              <label for="model-type">模型類型:</label>
              <select id="model-type">
                <option value="onnx">ONNX</option>
                <option value="torchscript">TorchScript</option>
              </select>
            </div>

            <div class="form-group">
              <label for="class-names">類別名稱文件 (可選):</label>
              <div class="input-group">
                <input type="text" id="class-names" placeholder="選擇類別名稱文件 (.json 或 .txt)" />
                <button id="browse-classes">瀏覽</button>
              </div>
            </div>

            <button id="load-model" class="primary-btn">載入模型</button>
            <div id="model-status" class="status"></div>
          </div>

          <!-- 單張圖像推理區域 -->
          <div class="inference-section">
            <h2>🖼️ 單張圖像推理</h2>
            <div class="image-upload">
              <div class="upload-area" id="upload-area">
                <div class="upload-content">
                  <span class="upload-icon">📷</span>
                  <p>點擊或拖拽圖像到此處</p>
                  <p class="upload-hint">支持 PNG, JPG, JPEG, BMP, WEBP</p>
                </div>
                <input type="file" id="image-input" accept="image/*" style="display: none;" />
              </div>
            </div>

            <div class="image-preview" id="image-preview" style="display: none;">
              <img id="preview-img" alt="預覽圖像" />
              <button id="infer-single" class="primary-btn">開始推理</button>
            </div>

            <div id="single-results" class="results"></div>
          </div>

          <!-- 批量推理區域 -->
          <div class="batch-section">
            <h2>📂 批量推理</h2>
            <div class="form-group">
              <label for="batch-dir">圖像目錄:</label>
              <div class="input-group">
                <input type="text" id="batch-dir" placeholder="選擇包含圖像的目錄" />
                <button id="browse-batch">瀏覽目錄</button>
              </div>
            </div>
            <button id="batch-inference" class="primary-btn">開始批量推理</button>
            <div id="batch-results" class="results"></div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners() {
    // 模型載入
    document.getElementById('load-model')?.addEventListener('click', () => this.loadModel());
    
    // 文件選擇按鈕
    document.getElementById('browse-model')?.addEventListener('click', () => this.browseModelFile());
    document.getElementById('browse-classes')?.addEventListener('click', () => this.browseClassNamesFile());
    document.getElementById('browse-batch')?.addEventListener('click', () => this.browseBatchDirectory());
    
    // 圖像上傳
    const uploadArea = document.getElementById('upload-area');
    const imageInput = document.getElementById('image-input') as HTMLInputElement;
    
    uploadArea?.addEventListener('click', () => imageInput.click());
    uploadArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });
    uploadArea?.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });
    uploadArea?.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files && files[0]) {
        this.handleImageUpload(files[0]);
      }
    });

    imageInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        this.handleImageUpload(target.files[0]);
      }
    });

    // 單張推理
    document.getElementById('infer-single')?.addEventListener('click', () => this.inferSingleImage());
    
    // 批量推理
    document.getElementById('batch-inference')?.addEventListener('click', () => this.batchInference());
  }

  private async loadModel() {
    const modelPath = (document.getElementById('model-path') as HTMLInputElement).value;
    const modelType = (document.getElementById('model-type') as HTMLSelectElement).value;
    const classNames = (document.getElementById('class-names') as HTMLInputElement).value;

    if (!modelPath) {
      this.showStatus('請選擇模型文件', 'error');
      return;
    }

    // 檢查文件路徑是否有效
    if (!modelPath.includes('.') || (!modelPath.endsWith('.onnx') && !modelPath.endsWith('.pt') && !modelPath.endsWith('.pth'))) {
      this.showStatus('請選擇有效的模型文件 (.onnx, .pt, .pth)', 'error');
      return;
    }

    try {
      this.showStatus('正在載入模型...', 'loading');
      
      const response = await invoke<InferenceResponse>('load_model', {
        model_path: modelPath,
        model_type: modelType,
        class_names_path: classNames || null
      });

      if (response.success) {
        this.modelLoaded = true;
        this.showStatus('✅ 模型載入成功', 'success');
      } else {
        this.showStatus(`❌ ${response.message}`, 'error');
      }
    } catch (error) {
      console.error('載入模型時出錯:', error);
      this.showStatus(`❌ 載入模型時出錯: ${error}`, 'error');
    }
  }

  private handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖像文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.currentImage = result;
      
      const preview = document.getElementById('image-preview') as HTMLElement;
      const img = document.getElementById('preview-img') as HTMLImageElement;
      
      img.src = result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  private async inferSingleImage() {
    if (!this.modelLoaded) {
      this.showStatus('請先載入模型', 'error');
      return;
    }

    if (!this.currentImage) {
      this.showStatus('請先選擇圖像', 'error');
      return;
    }

    try {
      const resultsDiv = document.getElementById('single-results');
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div class="loading">正在推理...</div>';

        // 由於當前實現的限制，我們需要先保存圖像到臨時文件
        // 這裡我們使用一個模擬的圖像路徑進行測試
        const tempImagePath = 'temp_image.jpg'; // 實際應用中需要保存base64到臨時文件
        
        const response = await invoke<InferenceResponse>('infer_single_image', {
          image_path: tempImagePath
        });

        this.displayResults(response, resultsDiv);
      }
    } catch (error) {
      console.error('推理時出錯:', error);
      const resultsDiv = document.getElementById('single-results');
      if (resultsDiv) {
        resultsDiv.innerHTML = `<div class="error">推理失敗: ${error}</div>`;
      }
    }
  }

  private async batchInference() {
    if (!this.modelLoaded) {
      this.showStatus('請先載入模型', 'error');
      return;
    }

    const batchDir = (document.getElementById('batch-dir') as HTMLInputElement).value;
    if (!batchDir) {
      this.showStatus('請選擇圖像目錄', 'error');
      return;
    }

    try {
      const resultsDiv = document.getElementById('batch-results');
      if (resultsDiv) {
        resultsDiv.innerHTML = '<div class="loading">正在批量推理...</div>';

        const response = await invoke<InferenceResponse>('batch_inference', {
          image_dir: batchDir
        });

        this.displayBatchResults(response, resultsDiv);
      }
    } catch (error) {
      console.error('批量推理時出錯:', error);
      const resultsDiv = document.getElementById('batch-results');
      if (resultsDiv) {
        resultsDiv.innerHTML = `<div class="error">批量推理失敗: ${error}</div>`;
      }
    }
  }

  private displayResults(response: InferenceResponse, container: HTMLElement) {
    if (!response.success) {
      container.innerHTML = `<div class="error">${response.message}</div>`;
      return;
    }

    if (response.results) {
      let html = `<div class="success">${response.message}</div><div class="results-list">`;
      response.results.forEach((result, index) => {
        html += `
          <div class="result-item">
            <span class="rank">${index + 1}</span>
            <span class="class-name">${result.class_name}</span>
            <span class="probability">${result.probability.toFixed(2)}%</span>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    }
  }

  private displayBatchResults(response: InferenceResponse, container: HTMLElement) {
    if (!response.success) {
      container.innerHTML = `<div class="error">${response.message}</div>`;
      return;
    }

    let html = `<div class="success">${response.message}</div>`;
    
    if (response.stats) {
      html += `
        <div class="stats">
          <h3>統計信息</h3>
          <p>總圖像數: ${response.stats.total_images}</p>
          <p>成功處理: ${response.stats.successful_images}</p>
          <p>總時間: ${response.stats.total_time_ms.toFixed(2)} ms</p>
          <p>平均時間: ${response.stats.average_time_ms.toFixed(2)} ms</p>
          <p>推理速度: ${response.stats.fps.toFixed(2)} FPS</p>
        </div>
      `;
    }

    if (response.batch_results) {
      html += '<div class="batch-results"><h3>推理結果</h3>';
      Object.entries(response.batch_results).forEach(([imageName, result]) => {
        html += `
          <div class="batch-item">
            <div class="image-name">${imageName}</div>
            <div class="result-info">
              <span class="class-name">${result.result.class_name}</span>
              <span class="probability">${result.result.probability.toFixed(2)}%</span>
              <span class="time">${result.inference_time_ms.toFixed(2)}ms</span>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  private showStatus(message: string, type: 'loading' | 'success' | 'error') {
    const statusDiv = document.getElementById('model-status');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status ${type}`;
    }
  }

  private async browseModelFile() {
    try {
      // 使用 Tauri v2 的正確導入方式
      const { open } = await import('@tauri-apps/plugin-dialog');
      console.log('正在打開文件選擇對話框...');
      
      const selected = await open({
        title: '選擇模型文件',
        multiple: false,
        directory: false,
        filters: [
          {
            name: '模型文件',
            extensions: ['onnx', 'pt', 'pth', 'tflite']
          },
          {
            name: 'ONNX 模型',
            extensions: ['onnx']
          },
          {
            name: 'PyTorch 模型',
            extensions: ['pt', 'pth']
          },
          {
            name: 'TensorFlow Lite',
            extensions: ['tflite']
          }
        ]
      });
      
      console.log('選擇的文件:', selected);
      
      if (selected && typeof selected === 'string') {
        (document.getElementById('model-path') as HTMLInputElement).value = selected;
        this.showStatus('模型文件已選擇', 'success');
      } else {
        this.showStatus('未選擇文件', 'error');
      }
    } catch (error) {
      console.error('選擇模型文件時出錯:', error);
      this.showStatus('選擇模型文件時出錯，請檢查文件路徑', 'error');
    }
  }

  private async browseClassNamesFile() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: '選擇類別名稱文件',
        multiple: false,
        directory: false,
        filters: [
          {
            name: '文本文件',
            extensions: ['txt', 'json']
          },
          {
            name: 'JSON 文件',
            extensions: ['json']
          },
          {
            name: '文本文件',
            extensions: ['txt']
          }
        ]
      });
      
      if (selected && typeof selected === 'string') {
        (document.getElementById('class-names') as HTMLInputElement).value = selected;
        this.showStatus('類別名稱文件已選擇', 'success');
      }
    } catch (error) {
      console.error('選擇類別名稱文件時出錯:', error);
      this.showStatus('選擇類別名稱文件時出錯，請檢查文件路徑', 'error');
    }
  }

  private async browseBatchDirectory() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: '選擇圖像目錄',
        directory: true,
        multiple: false
      });

      if (selected && typeof selected === 'string') {
        (document.getElementById('batch-dir') as HTMLInputElement).value = selected;
        this.showStatus('圖像目錄已選擇', 'success');
      }
    } catch (error) {
      console.error('選擇目錄時出錯:', error);
      this.showStatus('選擇目錄時出錯，請檢查路徑', 'error');
    }
  }
}

// 初始化應用
window.addEventListener('DOMContentLoaded', () => {
  new InferenceApp();
});
