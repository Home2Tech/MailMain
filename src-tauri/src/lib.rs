// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn dispatch_campaign(
    supabase_url: String,
    anon_key: String,
    access_token: String,
    campaign_id: String,
) -> Result<String, String> {
    let base_url = reqwest::Url::parse(&supabase_url).map_err(|_| "Invalid Supabase URL".to_string())?;
    let host = base_url.host_str().unwrap_or_default();
    if base_url.scheme() != "https" || !host.ends_with(".supabase.co") {
        return Err("Campaign delivery requires a hosted Supabase URL".to_string());
    }

    let endpoint = base_url
        .join("functions/v1/dispatch-campaign")
        .map_err(|_| "Unable to form campaign endpoint URL".to_string())?;
    let response = reqwest::Client::new()
        .post(endpoint)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("apikey", anon_key)
        .json(&serde_json::json!({ "campaign_id": campaign_id }))
        .timeout(std::time::Duration::from_secs(45))
        .send()
        .await
        .map_err(|error| format!("Campaign request failed: {error}"))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Campaign function returned {status}: {body}"));
    }
    Ok(body)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, dispatch_campaign])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
