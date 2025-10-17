# AI 模型推理工具

這是一個基於 Tauri + Rust + TypeScript 的 AI 模型推理應用，可以將您的 Python 推理腳本轉換為桌面應用程序。

## 功能特性

- 🤖 支持 ONNX 和 TorchScript 模型推理
- 🖼️ 單張圖像推理
- 📂 批量圖像推理
- 🎨 現代化的用戶界面
- ⚡ 高性能的 Rust 後端
- 🔧 易於擴展的架構

## 技術棧

### 後端 (Rust)
- **Tauri**: 跨平台桌面應用框架
- **ONNX Runtime**: 模型推理引擎
- **Image**: 圖像處理
- **NDArray**: 數組操作
- **Serde**: 序列化/反序列化

### 前端 (TypeScript)
- **TypeScript**: 類型安全的 JavaScript
- **HTML5/CSS3**: 現代化用戶界面
- **Tauri API**: 與 Rust 後端通信

## 項目結構

```
tauri-app/
├── src/                    # 前端代碼
│   ├── main.ts            # 主應用邏輯
│   └── styles.css         # 樣式文件
├── src-tauri/            # Rust 後端
│   ├── src/
│   │   ├── lib.rs        # 主入口
│   │   └── inference.rs  # 推理模組
│   └── Cargo.toml        # Rust 依賴
├── index.html            # HTML 入口
└── package.json          # Node.js 依賴
```

## 安裝和運行

### 前置要求

- Node.js (推薦 18+)
- Rust (最新穩定版)
- pnpm (推薦) 或 npm

### 安裝依賴

```bash
# 安裝前端依賴
pnpm install

# 安裝 Rust 依賴 (自動執行)
```

### 開發模式

```bash
# 啟動開發服務器
pnpm tauri dev
```

### 構建應用

```bash
# 構建生產版本
pnpm tauri build
```

## 使用說明

### 1. 載入模型

1. 選擇模型文件 (.onnx 或 .pt)
2. 選擇模型類型 (ONNX 或 TorchScript)
3. 可選：選擇類別名稱文件 (.json 或 .txt)
4. 點擊"載入模型"

### 2. 單張圖像推理

1. 點擊或拖拽圖像到上傳區域
2. 預覽圖像後點擊"開始推理"
3. 查看推理結果和置信度

### 3. 批量推理

1. 選擇包含圖像的目錄
2. 點擊"開始批量推理"
3. 查看統計信息和結果

## API 接口

### Rust 後端 API

```rust
// 載入模型
load_model(model_path: String, model_type: String, class_names_path: Option<String>)

// 單張圖像推理
infer_single_image(image_path: String)

// 批量推理
batch_inference(image_dir: String)
```

### 前端調用示例

```typescript
// 載入模型
const response = await invoke<InferenceResponse>('load_model', {
  modelPath: '/path/to/model.onnx',
  modelType: 'onnx',
  classNamesPath: '/path/to/classes.json'
});

// 推理圖像
const result = await invoke<InferenceResponse>('infer_single_image', {
  imagePath: '/path/to/image.jpg'
});
```

## 自定義和擴展

### 添加新的模型支持

1. 在 `src-tauri/src/inference.rs` 中添加新的模型類型
2. 實現相應的加載和推理邏輯
3. 更新前端 UI 以支持新類型

### 自定義預處理

修改 `preprocess_image` 函數以適應您的模型需求：

```rust
pub fn preprocess_image(&self, image_path: &str) -> Result<Array3<f32>> {
    // 自定義預處理邏輯
    // 例如：調整大小、歸一化、數據增強等
}
```

### 添加新的推理後端

1. 在 `Cargo.toml` 中添加新的依賴
2. 在 `ModelInference` 結構體中添加新的字段
3. 實現相應的推理方法

## 性能優化

### Rust 後端優化

- 使用 `rayon` 進行並行處理
- 優化內存使用和數據結構
- 使用 SIMD 指令集加速計算

### 前端優化

- 使用 Web Workers 進行後台處理
- 實現虛擬滾動處理大量結果
- 添加結果緩存機制

## 故障排除

### 常見問題

1. **模型載入失敗**
   - 檢查模型文件路徑是否正確
   - 確認模型格式是否支持
   - 查看控制台錯誤信息

2. **推理速度慢**
   - 檢查是否啟用了 GPU 加速
   - 優化圖像預處理流程
   - 考慮使用更小的模型

3. **內存使用過高**
   - 減少批量推理的圖像數量
   - 優化圖像預處理
   - 及時釋放不需要的資源

### 調試技巧

- 使用 `cargo run` 直接運行 Rust 代碼進行調試
- 在瀏覽器開發者工具中查看前端日誌
- 使用 `println!` 宏在 Rust 中輸出調試信息

## 貢獻指南

1. Fork 本項目
2. 創建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 許可證

本項目採用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 致謝

- [Tauri](https://tauri.app/) - 跨平台桌面應用框架
- [ONNX Runtime](https://onnxruntime.ai/) - 模型推理引擎
- [Rust](https://www.rust-lang.org/) - 系統編程語言
- [TypeScript](https://www.typescriptlang.org/) - 類型安全的 JavaScript