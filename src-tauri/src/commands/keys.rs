use keyring::Entry;

const SERVICE: &str = "ai-hub";
const ACCOUNT: &str = "openrouter";

#[tauri::command]
pub fn save_key(key: String) -> Result<(), String> {
    Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_key() -> Result<Option<String>, String> {
    match Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| e.to_string())?
        .get_password()
    {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_key() -> Result<(), String> {
    match Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| e.to_string())?
        .delete_password()
    {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}