fn main() {
    // Declares the app's own commands, so each one needs an explicit
    // permission in a capability (see capabilities/default.json).
    let manifest = tauri_build::AppManifest::new().commands(&["save_file"]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to run tauri-build");
}
