# Logstash Configuration

Logstash pipeline configuration for log processing and forwarding.

## 📁 File

### `pipeline/logstash.conf`
Logstash pipeline configuration for processing application logs.

**Pipeline stages:**
1. **Input**: Collect logs from multiple sources
2. **Filter**: Parse, transform, enrich logs
3. **Output**: Send to Elasticsearch

## 🚀 Usage

### Docker Compose

```yaml
services:
  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    ports:
      - "5044:5044"  # Beats input
      - "9600:9600"  # Monitoring
    volumes:
      - ./config/logstash/pipeline:/usr/share/logstash/pipeline:ro
    environment:
      LS_JAVA_OPTS: "-Xmx256m -Xms256m"
```

## 📋 Pipeline Structure

```conf
input {
  # File input
  file {
    path => "/var/log/app/*.log"
    start_position => "beginning"
  }
  
  # TCP input
  tcp {
    port => 5000
  }
}

filter {
  # JSON parsing
  json {
    source => "message"
  }
  
  # Date parsing
  date {
    match => ["timestamp", "ISO8601"]
  }
  
  # Add fields
  mutate {
    add_field => {
      "environment" => "production"
    }
  }
}

output {
  # Elasticsearch
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "app-logs-%{+YYYY.MM.dd}"
  }
  
  # Stdout (debugging)
  stdout {
    codec => rubydebug
  }
}
```

## 📊 Monitoring

```bash
# Check pipeline stats
curl http://localhost:9600/_node/stats/pipelines

# Health check
curl http://localhost:9600/_node/stats
```

## 📚 Resources
- [Logstash Documentation](https://www.elastic.co/guide/en/logstash/current/index.html)
- [Pipeline Configuration](https://www.elastic.co/guide/en/logstash/current/configuration.html)
