#!/bin/bash
set -e

SERVICE_NAME=${1:-"backend"}
DOMAIN=${2:-"botrt.local"}
CA_DIR=${3:-"/tmp/ca"}

echo "🔐 Generating mTLS certificates for service: $SERVICE_NAME"

# Create service directory
mkdir -p "$CA_DIR/services/$SERVICE_NAME"

# Generate service private key
echo "🔑 Generating private key for $SERVICE_NAME..."
openssl genrsa -out "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.key.pem" 2048
chmod 400 "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.key.pem"

# Create certificate signing request
echo "📝 Creating CSR for $SERVICE_NAME..."
cat > "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.cnf" <<EOF
[ req ]
default_bits = 2048
prompt = no
distinguished_name = req_distinguished_name
req_extensions = v3_req

[ req_distinguished_name ]
C=RU
ST=Moscow
L=Moscow
O=Telegram Ecommerce Bot
OU=Services
CN=$SERVICE_NAME.$DOMAIN

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = $SERVICE_NAME.$DOMAIN
DNS.2 = $SERVICE_NAME
DNS.3 = localhost
DNS.4 = 127.0.0.1
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate CSR
openssl req -config "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.cnf" \
    -key "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.key.pem" \
    -new -sha256 -out "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.csr.pem"

# Sign the certificate with CA
echo "📜 Signing certificate for $SERVICE_NAME..."
openssl ca -config "$CA_DIR/openssl.cnf" \
    -extensions server_cert -days 375 -notext -md sha256 \
    -in "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.csr.pem" \
    -out "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.cert.pem" \
    -passin pass:botrt-ca-password \
    -batch

chmod 444 "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.cert.pem"

# Create certificate chain
echo "🔗 Creating certificate chain..."
cat "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.cert.pem" \
    "$CA_DIR/certs/ca.cert.pem" > \
    "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.chain.pem"

# Generate client certificate for mTLS
echo "👤 Generating client certificate for $SERVICE_NAME..."
openssl genrsa -out "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.key.pem" 2048
chmod 400 "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.key.pem"

# Client CSR
cat > "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.cnf" <<EOF
[ req ]
default_bits = 2048
prompt = no
distinguished_name = req_distinguished_name
req_extensions = v3_req

[ req_distinguished_name ]
C=RU
ST=Moscow
L=Moscow
O=Telegram Ecommerce Bot
OU=Services
CN=$SERVICE_NAME-client.$DOMAIN

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

openssl req -config "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.cnf" \
    -key "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.key.pem" \
    -new -sha256 -out "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.csr.pem"

# Sign client certificate
openssl ca -config "$CA_DIR/openssl.cnf" \
    -extensions usr_cert -days 375 -notext -md sha256 \
    -in "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.csr.pem" \
    -out "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.cert.pem" \
    -passin pass:botrt-ca-password \
    -batch

chmod 444 "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.cert.pem"

# Verify certificates
echo "🔍 Verifying certificates..."
openssl verify -CAfile "$CA_DIR/certs/ca.cert.pem" \
    "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.cert.pem"

openssl verify -CAfile "$CA_DIR/certs/ca.cert.pem" \
    "$CA_DIR/services/$SERVICE_NAME/$SERVICE_NAME.client.cert.pem"

echo "✅ Certificates generated successfully for $SERVICE_NAME"
echo "📁 Files created in: $CA_DIR/services/$SERVICE_NAME/"
ls -la "$CA_DIR/services/$SERVICE_NAME/"
