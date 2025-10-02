#!/bin/bash
set -e

echo "🔐 Setting up Certificate Authority for mTLS..."

# Create directory structure
mkdir -p /tmp/ca/{certs,crl,newcerts,private}
chmod 700 /tmp/ca/private

# Create CA configuration
cat > /tmp/ca/openssl.cnf <<EOF
[ ca ]
default_ca = CA_default

[ CA_default ]
dir               = /tmp/ca
certs             = \$dir/certs
crl_dir           = \$dir/crl
new_certs_dir     = \$dir/newcerts
database          = \$dir/index.txt
serial            = \$dir/serial
RANDFILE          = \$dir/private/.rand

private_key       = \$dir/private/ca.key.pem
certificate       = \$dir/certs/ca.cert.pem

crlnumber         = \$dir/crlnumber
crl               = \$dir/crl/ca.crl.pem
crl_extensions    = crl_ext
default_crl_days  = 30

default_md        = sha256
name_opt          = ca_default
cert_opt          = ca_default
default_days      = 375
preserve          = no
policy            = policy_strict

[ policy_strict ]
countryName             = match
stateOrProvinceName     = match
organizationName        = match
organizationalUnitName  = optional
commonName              = supplied
emailAddress            = optional

[ policy_loose ]
countryName             = optional
stateOrProvinceName     = optional
localityName            = optional
organizationName        = optional
organizationalUnitName  = optional
commonName              = supplied
emailAddress            = optional

[ req ]
default_bits        = 2048
distinguished_name  = req_distinguished_name
string_mask         = utf8only
default_md          = sha256
x509_extensions     = v3_ca

[ req_distinguished_name ]
countryName                     = Country Name (2 letter code)
stateOrProvinceName             = State or Province Name
localityName                    = Locality Name
0.organizationName              = Organization Name
organizationalUnitName          = Organizational Unit Name
commonName                      = Common Name
emailAddress                    = Email Address

countryName_default             = RU
stateOrProvinceName_default     = Moscow
localityName_default            = Moscow
0.organizationName_default      = Telegram Ecommerce Bot
organizationalUnitName_default  = Security Team
emailAddress_default            = security@botrt.local

[ v3_ca ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true
keyUsage = critical, digitalSignature, cRLSign, keyCertSign

[ v3_intermediate_ca ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true, pathlen:0
keyUsage = critical, digitalSignature, cRLSign, keyCertSign

[ usr_cert ]
basicConstraints = CA:FALSE
nsCertType = client, email
nsComment = "OpenSSL Generated Client Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
keyUsage = critical, nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth, emailProtection

[ server_cert ]
basicConstraints = CA:FALSE
nsCertType = server
nsComment = "OpenSSL Generated Server Certificate"
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer:always
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[ crl_ext ]
authorityKeyIdentifier=keyid:always

[ ocsp ]
basicConstraints = CA:FALSE
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, OCSPSigning
EOF

# Initialize CA database
echo 1000 > /tmp/ca/serial
touch /tmp/ca/index.txt
echo 1000 > /tmp/ca/crlnumber

# Generate CA private key
echo "🔑 Generating CA private key..."
openssl genrsa -aes256 -passout pass:botrt-ca-password -out /tmp/ca/private/ca.key.pem 4096
chmod 400 /tmp/ca/private/ca.key.pem

# Generate CA certificate
echo "📜 Generating CA certificate..."
openssl req -config /tmp/ca/openssl.cnf \
    -key /tmp/ca/private/ca.key.pem \
    -new -x509 -days 7300 -sha256 -extensions v3_ca \
    -out /tmp/ca/certs/ca.cert.pem \
    -passin pass:botrt-ca-password \
    -subj "/C=RU/ST=Moscow/L=Moscow/O=Telegram Ecommerce Bot/OU=Security Team/CN=BotRT Root CA"

chmod 444 /tmp/ca/certs/ca.cert.pem

echo "✅ Root CA created successfully"

# Verify CA certificate
openssl x509 -noout -text -in /tmp/ca/certs/ca.cert.pem

echo "📋 CA certificate details:"
openssl x509 -noout -subject -issuer -dates -in /tmp/ca/certs/ca.cert.pem
