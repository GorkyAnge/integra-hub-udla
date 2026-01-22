# 🚀 IntegraHub - Enterprise Integration Platform

## Plataforma de Integración Order-to-Cash para Retail

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.12-orange?logo=rabbitmq)](https://www.rabbitmq.com/)
[![Kafka](https://img.shields.io/badge/Kafka-Streaming-black?logo=apachekafka)](https://kafka.apache.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org/)

---

## 📋 Descripción

**IntegraHub** es una plataforma de integración empresarial diseñada para implementar un flujo completo **Order-to-Cash** que incluye:

- 📦 **Gestión de Pedidos** (Order Service)
- 📊 **Control de Inventario** (Inventory Service)
- 💳 **Procesamiento de Pagos** (Payment Service)
- 📧 **Sistema de Notificaciones** (Notification Service)
- 🔐 **Autenticación OAuth2 + JWT** (Auth Service)
- 📁 **Integración Legacy CSV** (Legacy Processor)
- 📈 **Analytics en Tiempo Real** (Kafka Streaming)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DEMO PORTAL (8080)                            │
│                    HTML/JS - Crear Pedidos, Ver Estado                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (Nginx:80)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  Auth Service │          │ Order Service │          │   Inventory   │
│    (3000)     │◄────────►│    (3001)     │◄────────►│    (3002)     │
│  OAuth2+JWT   │          │   REST API    │          │   REST API    │
└───────────────┘          └───────────────┘          └───────────────┘
                                    │                           │
                                    ▼                           ▼
                           ┌───────────────┐          ┌───────────────┐
                           │    Payment    │          │ Notification  │
                           │    (3003)     │          │    (3004)     │
                           │   REST API    │          │   Pub/Sub     │
                           └───────────────┘          └───────────────┘
                                    │                           │
        ┌───────────────────────────┴───────────────────────────┘
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   RabbitMQ    │          │     Redis     │          │  PostgreSQL   │
│  (5672/15672) │          │    (6379)     │          │    (5432)     │
│  P2P + PubSub │          │  Idempotency  │          │   Database    │
└───────────────┘          └───────────────┘          └───────────────┘
        │
        ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│ Legacy CSV    │          │    Kafka      │          │   Analytics   │
│  Processor    │          │ (9092/29092)  │          │    (3005)     │
│   /inbox      │          │   Streaming   │          │   ETL/Batch   │
└───────────────┘          └───────────────┘          └───────────────┘
```

---

## 🚀 Quick Start

### Prerrequisitos

- Docker Desktop 4.x+
- Docker Compose v2+
- 8GB RAM mínimo disponible

### Levantar el Sistema

```bash
# Clonar el repositorio
git clone <repository-url>
cd IntegraHub

# Copiar variables de entorno
cp .env.example .env

# Levantar todo el sistema
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Detener el Sistema

```bash
docker-compose down
```

---

## 🌐 URLs de Acceso

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Demo Portal** | http://localhost:8080 | Portal web principal |
| **API Gateway** | http://localhost:80 | Gateway unificado |
| **Auth Service** | http://localhost:3000/api-docs | OAuth2/JWT Auth |
| **Order Service** | http://localhost:3001/api-docs | API de Pedidos |
| **Inventory Service** | http://localhost:3002/api-docs | API de Inventario |
| **Payment Service** | http://localhost:3003/api-docs | API de Pagos |
| **Notification Service** | http://localhost:3004/api-docs | API de Notificaciones |
| **Analytics Service** | http://localhost:3005/api-docs | API de Analytics |
| **RabbitMQ Management** | http://localhost:15672 | UI RabbitMQ (admin/admin123) |
| **Kafka UI** | http://localhost:8090 | UI Kafka |

---

## 🔧 Patrones de Integración Implementados

Para documentación detallada de cada patrón, ver: [📋 PATRONES_IMPLEMENTACION.md](docs/PATRONES_IMPLEMENTACION.md)

### Resumen de Patrones

| Patrón | Dónde se Usa | Por Qué se Usa | Trade-offs |
|--------|--------------|----------------|------------|
| **Point-to-Point Channel** | Cola `order.process`, `payment.process` | Procesamiento secuencial garantizado, un solo consumidor activo | ❌ No escala con múltiples consumers<br>✅ Orden garantizado |
| **Publish/Subscribe** | Exchange `order.events` (Fanout) | Notificar a múltiples servicios sin acoplamiento | ❌ Todos reciben todo (no hay filtrado)<br>✅ Fácil agregar suscriptores |
| **Message Router** | Routing keys en Order Service | Dirigir mensajes según tipo de evento | ❌ Requiere conocer routing keys<br>✅ Flexible y escalable |
| **Message Translator** | Legacy CSV Processor | Transformar CSV legacy a JSON moderno | ❌ Código específico por formato<br>✅ Independencia de sistemas |
| **Dead Letter Channel** | Cola `orders.dlq` | Manejar mensajes que fallan repetidamente | ❌ Requiere monitoreo de DLQ<br>✅ No pierde mensajes |
| **Idempotent Consumer** | Redis cache en Order Service | Evitar procesamiento duplicado de pedidos | ❌ Dependencia de Redis<br>✅ Garantiza exactly-once |
| **Circuit Breaker** | Opossum en Order Service | Proteger contra caídas de servicios externos | ❌ Requiere ajuste de thresholds<br>✅ Previene cascading failures |
| **Retry with Backoff** | async-retry en Payment Service | Reintentar operaciones transitorias fallidas | ❌ Aumenta latencia en fallos<br>✅ Tolera errores temporales |
| **Correlation Identifier** | Header `x-correlation-id` | Trazar requests end-to-end en logs | ❌ Debe propagarse manualmente<br>✅ Debugging facilitado |
| **Content-Based Router** | RabbitMQ topic exchange | Ruteo basado en routing key patterns | ❌ Complejidad en bindings<br>✅ Filtrado fino de mensajes |

## 🔧 Patrones de Integración Implementados

Para documentación detallada de cada patrón, ver: [📋 PATRONES_IMPLEMENTACION.md](docs/PATRONES_IMPLEMENTACION.md)

### Resumen de Patrones

| Patrón | Dónde se Usa | Por Qué se Usa | Trade-offs |
|--------|--------------|----------------|------------|
| **Point-to-Point Channel** | Cola `order.process`, `payment.process` | Procesamiento secuencial garantizado, un solo consumidor activo | ❌ No escala con múltiples consumers<br>✅ Orden garantizado |
| **Publish/Subscribe** | Exchange `order.events` (Fanout) | Notificar a múltiples servicios sin acoplamiento | ❌ Todos reciben todo (no hay filtrado)<br>✅ Fácil agregar suscriptores |
| **Message Router** | Routing keys en Order Service | Dirigir mensajes según tipo de evento | ❌ Requiere conocer routing keys<br>✅ Flexible y escalable |
| **Message Translator** | Legacy CSV Processor | Transformar CSV legacy a JSON moderno | ❌ Código específico por formato<br>✅ Independencia de sistemas |
| **Dead Letter Channel** | Cola `orders.dlq` | Manejar mensajes que fallan repetidamente | ❌ Requiere monitoreo de DLQ<br>✅ No pierde mensajes |
| **Idempotent Consumer** | Redis cache en Order Service | Evitar procesamiento duplicado de pedidos | ❌ Dependencia de Redis<br>✅ Garantiza exactly-once |
| **Circuit Breaker** | Opossum en Order Service | Proteger contra caídas de servicios externos | ❌ Requiere ajuste de thresholds<br>✅ Previene cascading failures |
| **Retry with Backoff** | async-retry en Payment Service | Reintentar operaciones transitorias fallidas | ❌ Aumenta latencia en fallos<br>✅ Tolera errores temporales |
| **Correlation Identifier** | Header `x-correlation-id` | Trazar requests end-to-end en logs | ❌ Debe propagarse manualmente<br>✅ Debugging facilitado |
| **Content-Based Router** | RabbitMQ topic exchange | Ruteo basado en routing key patterns | ❌ Complejidad en bindings<br>✅ Filtrado fino de mensajes |

---

## 🛡️ Resiliencia

### Circuit Breaker
- Estado: CLOSED → OPEN → HALF-OPEN
- Threshold: 5 fallos consecutivos
- Timeout: 30 segundos

### Retry con Backoff
- Intentos: 3
- Delay inicial: 1 segundo
- Backoff exponencial: 1s → 2s → 4s

### Timeouts
- Request timeout: 5 segundos
- Connection timeout: 3 segundos

---

## 🔐 Seguridad

### OAuth2 + JWT

```bash
# Obtener token
POST /auth/token
Content-Type: application/json

{
  "client_id": "integrahub-client",
  "client_secret": "integrahub-secret",
  "grant_type": "client_credentials"
}

# Usar token
GET /api/orders
Authorization: Bearer <token>
```

---

## 📁 Estructura del Proyecto

```
IntegraHub/
├── services/
│   ├── auth-service/          # OAuth2 + JWT Authentication
│   ├── order-service/         # Order Management
│   ├── inventory-service/     # Inventory Control
│   ├── payment-service/       # Payment Processing
│   └── notification-service/  # Notifications (Email, Webhook)
├── legacy/
│   ├── inbox/                 # CSV files input
│   ├── processed/             # Processed files
│   ├── error/                 # Failed files
│   └── processor/             # CSV Processor service
├── analytics/
│   └── streaming/             # Kafka consumers & ETL
├── portal/
│   └── web/                   # Demo Portal (HTML/JS)
├── infrastructure/
│   ├── nginx/                 # API Gateway config
│   └── rabbitmq/              # RabbitMQ config
├── docs/
│   ├── c4-diagrams/           # C4 Architecture diagrams
│   ├── patterns-matrix/       # Integration patterns docs
│   └── api/                   # API documentation
├── postman/
│   └── IntegraHub.postman_collection.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 📊 Flujos Principales

### Flujo A: Creación de Pedido (E2E)

1. Cliente crea pedido via `POST /api/orders`
2. Se genera evento `OrderCreated`
3. Inventory Service reserva stock
4. Payment Service procesa pago
5. Se confirma con `OrderConfirmed` o rechaza con `OrderRejected`

### Flujo B: Notificaciones (Pub/Sub)

- Cambios de estado → Exchange fanout
- Webhook a Discord/Slack
- Notificación simulada al cliente

### Flujo C: Integración Legacy (CSV)

1. Archivo CSV en `/legacy/inbox`
2. Procesador detecta y valida
3. Transforma y carga a PostgreSQL
4. Mueve a `/processed` o `/error`

### Flujo D: Analytics (Streaming)

- Eventos → Kafka topics
- Consumer calcula métricas
- Dashboard en tiempo real

---

## 🧪 Testing

### Postman Collection

Importar `postman/IntegraHub.postman_collection.json` en Postman.

### Health Check

```bash
# Verificar estado de todos los servicios
curl http://localhost:3001/health

# Sistema completo
curl http://localhost:80/api/health
```

---

## 👥 Equipo

- **Proyecto Integrador 202610**
- **Asignatura:** Integración de Sistemas
- **Docente:** Darío Villamarín G.

---

## 📄 Licencia

Este proyecto es parte del trabajo académico del curso de Integración de Sistemas.

---

## 🆘 Troubleshooting

### Problema: Kafka falla al iniciar (NodeExists error)
**Error**: `KeeperErrorCode = NodeExists`

**Causa**: Kafka intentó registrarse en Zookeeper pero el nodo ya existía de una ejecución anterior.

**Solución**:
```bash
# Detener y eliminar volúmenes
docker-compose down -v

# Levantar nuevamente
docker-compose up -d
```

### Problema: Servicios no inician
```bash
# Ver logs detallados
docker-compose logs -f <service-name>

# Reiniciar un servicio específico
docker-compose restart <service-name>
```

### Problema: Puerto en uso
```bash
# Ver qué usa el puerto
netstat -ano | findstr :3000

# O en PowerShell
Get-NetTCPConnection -LocalPort 3000
```

### Problema: RabbitMQ no conecta
- Esperar 30-60 segundos después de `docker-compose up`
- Verificar health: http://localhost:15672

---

**¡Happy Integrating! 🎉**
