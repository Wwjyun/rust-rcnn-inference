model = load_model(args={
    "model_path": model_path,
    "device": "cuda" if torch.cuda.is_available() else "cpu"
})