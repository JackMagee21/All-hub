use std::fs;
use std::path::Path;

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<String, String> {
    let p = Path::new(&path);

    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Could not create directories: {}", e))?;
        }
    }

    fs::write(&path, content.as_bytes())
        .map_err(|e| format!("Could not write file: {}", e))?;

    Ok(format!("Saved to {}", path))
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Could not read '{}': {}", path, e))
}