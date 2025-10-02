#!/bin/bash

echo "=== Остановка контейнеров разработки ==="

docker-compose -f config/docker/docker-compose.dev.yml down

echo "Контейнеры остановлены"
