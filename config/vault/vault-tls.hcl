ui = true
disable_mlock = false

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/certs/vault.cert.pem"
  tls_key_file  = "/certs/vault.key.pem"
  tls_client_ca_file = "/certs/ca.cert.pem"
  tls_require_and_verify_client_cert = true
  tls_min_version = "tls12"
  tls_cipher_suites = "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256,TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384"
}

api_addr = "https://127.0.0.1:8200"
cluster_addr = "https://127.0.0.1:8201"

# Enable audit logging
audit {
  enabled = true
}

# Telemetry
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname = true
}
