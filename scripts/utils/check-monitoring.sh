#!/bin/bash

echo "========================================="
echo " Checking Monitoring Services Status"
echo "========================================="
echo ""

echo "[1/5] Checking Docker containers..."
docker-compose ps
echo ""

echo "[2/5] Checking Prometheus container..."
docker ps --filter "name=prometheus" --format "table {{.Names}}\t{{.Status}}"
echo ""

echo "[3/5] Checking Prometheus logs (last 10 lines)..."
docker-compose logs --tail 10 prometheus
echo ""

echo "[4/5] Testing Prometheus endpoint..."
curl -s http://82.147.84.78:9090/-/healthy
echo ""
echo ""

echo "[5/5] Testing backend metrics..."
curl -s http://82.147.84.78:3001/metrics | grep "# HELP" | head -5
echo ""

echo ""
echo "========================================="
echo " Monitoring URLs:"
echo "========================================="
echo " Prometheus:  http://82.147.84.78:9090"
echo " Grafana:     http://82.147.84.78:3030"
echo " Backend:     http://82.147.84.78:3001/metrics"
echo " UI Monitor:  http://82.147.84.78:3000/monitoring"
echo "========================================="
echo ""

