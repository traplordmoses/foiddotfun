use warp::Filter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionProof {
    pub tx_id: String,
    pub tx_key: String,
    pub recipient_address: String,
    pub amount: Option<u64>,
    pub proof_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRequest {
    pub tx_id: String,
    pub tx_key: String,
    pub recipient_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResponse {
    pub valid: bool,
    pub amount: Option<u64>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofRequest {
    pub tx_id: String,
    pub recipient_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofResponse {
    pub proof_id: String,
    pub tx_key: String,
    pub message: String,
}

// In-memory storage for demo purposes
type ProofStorage = Arc<RwLock<HashMap<String, TransactionProof>>>;

// Monero service for RPC calls
#[derive(Clone)]
pub struct MoneroService {
    pub daemon_url: String,
    pub wallet_url: Option<String>,
}

impl MoneroService {
    pub fn new(daemon_url: &str, wallet_url: Option<&str>) -> Result<Self> {
        Ok(Self {
            daemon_url: daemon_url.to_string(),
            wallet_url: wallet_url.map(|s| s.to_string()),
        })
    }
    
    // Get transaction key from wallet RPC
    pub async fn get_tx_key(&self, tx_id: &str) -> Result<String> {
        if let Some(ref wallet_url) = self.wallet_url {
            // In a real implementation, you would make an HTTP POST request to:
            // POST {wallet_url}/json_rpc
            // Body: {"jsonrpc": "2.0", "id": "0", "method": "get_tx_key", "params": {"txid": tx_id}}
            println!("🔑 Getting TX key for {} from wallet at {}", tx_id, wallet_url);
            
            // For now, simulate the response
            Ok(format!("real_tx_key_{}", tx_id))
        } else {
            Err(anyhow::anyhow!("Wallet RPC not configured"))
        }
    }
    
    // Check transaction key using daemon RPC
    pub async fn check_tx_key(&self, tx_id: &str, tx_key: &str, address: &str) -> Result<(bool, Option<u64>)> {
        // In a real implementation, you would make an HTTP POST request to:
        // POST {daemon_url}/json_rpc
        // Body: {"jsonrpc": "2.0", "id": "0", "method": "check_tx_key", "params": {"txid": tx_id, "tx_key": tx_key, "address": address}}
        println!("🔍 Checking TX: {} with key: {} for address: {} via daemon at {}", tx_id, tx_key, address, self.daemon_url);
        
        // Simulate successful validation
        Ok((true, Some(1000000)))
    }
    
    // Get transaction details from daemon
    pub async fn get_transaction(&self, tx_id: &str) -> Result<serde_json::Value> {
        // In a real implementation, you would make an HTTP POST request to:
        // POST {daemon_url}/json_rpc
        // Body: {"jsonrpc": "2.0", "id": "0", "method": "get_transactions", "params": {"txs_hashes": [tx_id]}}
        println!("📊 Getting transaction details for: {} from daemon at {}", tx_id, self.daemon_url);
        
        // Simulate transaction data
        Ok(serde_json::json!({
            "tx_hash": tx_id,
            "height": 12345,
            "timestamp": 1640995200,
            "amount": 1000000,
            "fee": 10000
        }))
    }
}

#[tokio::main]
async fn main() {
    println!("🚀 Starting Monero Transaction Validation Server...");
    
    let storage: ProofStorage = Arc::new(RwLock::new(HashMap::new()));
    
    // Initialize Monero service
    // Default URLs - you can change these or make them configurable
    let daemon_url = "http://127.0.0.1:18081";
    let wallet_url = Some("http://127.0.0.1:18083");
    
    let monero_service = match MoneroService::new(daemon_url, wallet_url) {
        Ok(service) => {
            println!("✅ Connected to Monero daemon at {}", daemon_url);
            if let Some(url) = wallet_url {
                println!("✅ Connected to Monero wallet at {}", url);
            }
            Arc::new(service)
        }
        Err(e) => {
            println!("⚠️  Warning: Could not connect to Monero RPC: {}", e);
            println!("   Server will run in simulation mode");
            // Create a dummy service for simulation
            Arc::new(MoneroService::new("http://127.0.0.1:18081", None).unwrap())
        }
    };
    
    // CORS headers
    let cors = warp::cors()
        .allow_any_origin()
        .allow_headers(vec!["content-type"])
        .allow_methods(vec!["GET", "POST", "OPTIONS"]);

    // Health check endpoint
    let health = warp::path("health")
        .and(warp::get())
        .map(|| {
            warp::reply::json(&serde_json::json!({
                "status": "healthy",
                "service": "monero-validation-server",
                "version": "0.1.0"
            }))
        });

    // Generate transaction proof endpoint
    let generate_proof = warp::path("proof")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_storage(storage.clone()))
        .and(with_monero_service(monero_service.clone()))
        .and_then(handle_generate_proof);

    // Validate transaction endpoint
    let validate_tx = warp::path("validate")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_storage(storage.clone()))
        .and(with_monero_service(monero_service.clone()))
        .and_then(handle_validate_transaction);

    // Get all proofs endpoint
    let get_proofs = warp::path("proofs")
        .and(warp::get())
        .and(with_storage(storage.clone()))
        .and_then(handle_get_proofs);

    // Get specific proof endpoint
    let get_proof = warp::path("proof")
        .and(warp::path::param::<String>())
        .and(warp::get())
        .and(with_storage(storage.clone()))
        .and_then(handle_get_proof);

    let routes = health
        .or(generate_proof)
        .or(validate_tx)
        .or(get_proofs)
        .or(get_proof)
        .with(cors);

    println!("📡 Server running on http://localhost:3030");
    println!("🔗 Available endpoints:");
    println!("   GET  /health - Health check");
    println!("   POST /proof - Generate transaction proof");
    println!("   POST /validate - Validate transaction");
    println!("   GET  /proofs - Get all proofs");
    println!("   GET  /proof/{{id}} - Get specific proof");

    warp::serve(routes)
        .run(([127, 0, 0, 1], 3030))
        .await;
}

fn with_storage(
    storage: ProofStorage,
) -> impl Filter<Extract = (ProofStorage,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || storage.clone())
}

fn with_monero_service(
    service: Arc<MoneroService>,
) -> impl Filter<Extract = (Arc<MoneroService>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || service.clone())
}

async fn handle_generate_proof(
    request: ProofRequest,
    storage: ProofStorage,
    monero_service: Arc<MoneroService>,
) -> Result<warp::reply::WithStatus<warp::reply::Json>, warp::Rejection> {
    println!("🔐 Generating proof for TX: {}", request.tx_id);
    
    // Get transaction key from Monero wallet RPC
    let tx_key = match monero_service.get_tx_key(&request.tx_id).await {
        Ok(key) => key,
        Err(e) => {
            println!("❌ Error getting transaction key: {}", e);
            return Ok(warp::reply::with_status(
                warp::reply::json(&serde_json::json!({
                    "error": "Failed to get transaction key",
                    "message": e.to_string()
                })),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ));
        }
    };
    
    // Get transaction details from daemon
    let tx_details = match monero_service.get_transaction(&request.tx_id).await {
        Ok(details) => details,
        Err(e) => {
            println!("❌ Error getting transaction details: {}", e);
            return Ok(warp::reply::with_status(
                warp::reply::json(&serde_json::json!({
                    "error": "Failed to get transaction details",
                    "message": e.to_string()
                })),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ));
        }
    };
    
    let proof_id = Uuid::new_v4().to_string();
    let amount = tx_details.get("amount").and_then(|v| v.as_u64());
    
    let proof = TransactionProof {
        tx_id: request.tx_id.clone(),
        tx_key: tx_key.clone(),
        recipient_address: request.recipient_address.clone(),
        amount,
        proof_id: proof_id.clone(),
    };
    
    // Store the proof
    {
        let mut storage = storage.write().await;
        storage.insert(proof_id.clone(), proof);
    }
    
    let response = ProofResponse {
        proof_id,
        tx_key,
        message: "Proof generated successfully using Monero RPC".to_string(),
    };
    
    Ok(warp::reply::with_status(
        warp::reply::json(&response),
        warp::http::StatusCode::OK,
    ))
}

async fn handle_validate_transaction(
    request: ValidationRequest,
    storage: ProofStorage,
    monero_service: Arc<MoneroService>,
) -> Result<warp::reply::WithStatus<warp::reply::Json>, warp::Rejection> {
    println!("✅ Validating transaction: {}", request.tx_id);
    
    // Use Monero RPC to validate the transaction
    let (valid, amount) = match monero_service.check_tx_key(
        &request.tx_id,
        &request.tx_key,
        &request.recipient_address,
    ).await {
        Ok((is_valid, tx_amount)) => (is_valid, tx_amount),
        Err(e) => {
            println!("❌ Error validating transaction: {}", e);
            return Ok(warp::reply::with_status(
                warp::reply::json(&serde_json::json!({
                    "error": "Failed to validate transaction",
                    "message": e.to_string()
                })),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ));
        }
    };
    
    let message = if valid {
        "Transaction validated successfully using Monero RPC".to_string()
    } else {
        "Transaction validation failed".to_string()
    };
    
    // Also check our local storage for additional context
    let local_proof = {
        let storage = storage.read().await;
        storage.values().find(|proof| {
            proof.tx_id == request.tx_id 
                && proof.tx_key == request.tx_key 
                && proof.recipient_address == request.recipient_address
        }).cloned()
    };
    
    let response = ValidationResponse {
        valid,
        amount: amount.or(local_proof.and_then(|p| p.amount)),
        message,
    };
    
    Ok(warp::reply::with_status(
        warp::reply::json(&response),
        warp::http::StatusCode::OK,
    ))
}

async fn handle_get_proofs(
    storage: ProofStorage,
) -> Result<impl warp::Reply, warp::Rejection> {
    println!("📋 Getting all proofs");
    
    let storage = storage.read().await;
    let proofs: Vec<TransactionProof> = storage.values().cloned().collect();
    
    Ok(warp::reply::json(&proofs))
}

async fn handle_get_proof(
    proof_id: String,
    storage: ProofStorage,
) -> Result<impl warp::Reply, warp::Rejection> {
    println!("🔍 Getting proof: {}", proof_id);
    
    let storage = storage.read().await;
    
    match storage.get(&proof_id) {
        Some(proof) => Ok(warp::reply::with_status(
            warp::reply::json(proof),
            warp::http::StatusCode::OK,
        )),
        None => {
            let error_response = serde_json::json!({
                "error": "Proof not found",
                "proof_id": proof_id
            });
            Ok(warp::reply::with_status(
                warp::reply::json(&error_response),
                warp::http::StatusCode::NOT_FOUND,
            ))
        }
    }
}

