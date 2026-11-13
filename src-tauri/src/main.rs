// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Also in `cargo test` without the feature, so that CI tests it.
#[cfg(any(test, feature = "e2e"))]
mod e2e;
mod save;

use tauri::utils::config::WindowConfig;
use tauri::{App, WebviewWindowBuilder};

/// Must match the label in `tauri.conf.json`.
const MAIN_WINDOW: &str = "main";

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save::save_file])
        .setup(create_main_window)
        .run(tauri::generate_context!())
        .expect("failed to run the app");
}

/// `tauri.conf.json` has `"create": false` for the main window: the test
/// build must change its browser arguments before the window exists.
fn create_main_window(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let config = main_window_config(app)?;
    WebviewWindowBuilder::from_config(app.handle(), &config)?.build()?;
    Ok(())
}

fn main_window_config(app: &App) -> Result<WindowConfig, String> {
    #[allow(unused_mut)] // Only the test build changes the configuration.
    let mut config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW)
        .cloned()
        .ok_or_else(|| format!("tauri.conf.json has no window '{MAIN_WINDOW}'"))?;
    #[cfg(feature = "e2e")]
    {
        let port = std::env::var(e2e::CDP_PORT_VARIABLE).ok();
        config.additional_browser_args = e2e::browser_args(port.as_deref())?;
    }
    Ok(config)
}
