//! Saves a file that the frontend made. The frontend has no file system
//! access: it can only write to a path the user selects in the native
//! "Save as" dialog.

use std::path::{Path, PathBuf};

use percent_encoding::percent_decode_str;
use serde::Serialize;
use tauri::http::HeaderMap;
use tauri::ipc::{InvokeBody, Request};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Must match `FILE_NAME_HEADER` in `src/lib/save.ts`.
const FILE_NAME_HEADER: &str = "x-file-name";

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SaveResult {
    Saved,
    Cancelled,
}

/// Body: the file bytes (raw IPC body). Header `x-file-name`: the
/// suggested file name, URI-encoded.
#[tauri::command]
pub async fn save_file(app: AppHandle, request: Request<'_>) -> Result<SaveResult, String> {
    let data = raw_body(request.body())?;
    let suggested_name = suggested_file_name(request.headers())?;
    let Some(path) = ask_save_path(app, suggested_name).await? else {
        return Ok(SaveResult::Cancelled);
    };
    std::fs::write(&path, data).map_err(|error| error.to_string())?;
    Ok(SaveResult::Saved)
}

async fn ask_save_path(app: AppHandle, suggested_name: String) -> Result<Option<PathBuf>, String> {
    // The blocking dialog must not run on the async runtime's threads.
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().set_file_name(suggested_name).blocking_save_file()
    })
    .await
    .map_err(|error| error.to_string())?;
    selected
        .map(|file_path| file_path.into_path().map_err(|error| error.to_string()))
        .transpose()
}

fn raw_body(body: &InvokeBody) -> Result<&[u8], String> {
    match body {
        InvokeBody::Raw(bytes) => Ok(bytes),
        InvokeBody::Json(_) => Err("expected the file content as raw bytes".into()),
    }
}

/// Decodes the header and keeps only the last path component, so the
/// frontend cannot preselect a folder.
fn suggested_file_name(headers: &HeaderMap) -> Result<String, String> {
    let encoded = headers
        .get(FILE_NAME_HEADER)
        .ok_or("missing file name")?
        .to_str()
        .map_err(|error| error.to_string())?;
    let decoded = percent_decode_str(encoded)
        .decode_utf8()
        .map_err(|error| error.to_string())?;
    Path::new(decoded.as_ref())
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_owned)
        .ok_or_else(|| "invalid file name".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers_with_name(value: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(FILE_NAME_HEADER, value.parse().unwrap());
        headers
    }

    #[test]
    fn raw_body_returns_the_bytes() {
        let body = InvokeBody::Raw(vec![1, 2, 3]);
        assert_eq!(raw_body(&body), Ok(&[1u8, 2, 3][..]));
    }

    #[test]
    fn raw_body_rejects_json() {
        assert!(raw_body(&InvokeBody::default()).is_err());
    }

    #[test]
    fn file_name_is_uri_decoded() {
        let headers = headers_with_name("M%C3%BCller%20Liste_crypt.csv");
        assert_eq!(suggested_file_name(&headers), Ok("Müller Liste_crypt.csv".into()));
    }

    #[test]
    fn file_name_drops_folders() {
        let headers = headers_with_name("..%2F..%2Fetc%2Fdata.csv");
        assert_eq!(suggested_file_name(&headers), Ok("data.csv".into()));
    }

    #[test]
    fn file_name_is_required() {
        assert!(suggested_file_name(&HeaderMap::new()).is_err());
    }

    #[test]
    fn file_name_must_not_be_empty() {
        assert!(suggested_file_name(&headers_with_name("..")).is_err());
    }

    #[test]
    fn result_serializes_like_the_frontend_type() {
        assert_eq!(serde_json::to_string(&SaveResult::Saved).unwrap(), "\"saved\"");
        assert_eq!(serde_json::to_string(&SaveResult::Cancelled).unwrap(), "\"cancelled\"");
    }
}
