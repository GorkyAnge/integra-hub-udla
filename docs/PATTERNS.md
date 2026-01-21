# IntegraHub - Documentación de Patrones de Integración

## 📋 Matriz de Patrones Implementados

| Patrón | Ubicación | Descripción |
|--------|-----------|-------------|
| **Message Router** | Order Service | Enruta mensajes a colas específicas según tipo de evento |
| **Message Translator** | Legacy Processor | Convierte CSV → JSON → Modelo de datos |
| **Publish/Subscribe** | Notification Service | Fanout exchange para notificaciones múltiples |
| **Point-to-Point** | Inventory/Payment | Colas dedicadas con un solo consumidor |
| **Dead Letter Channel** | RabbitMQ Config | DLQ para mensajes fallidos |
| **Idempotent Consumer** | Order Service | Redis para evitar duplicados |
| **Circuit Breaker** | Order Service | Opossum para proteger llamadas externas |
| **Retry with Backoff** | Order Service | Reintentos con espera exponencial |
| **Correlation Identifier** | Todos los servicios | UUID para trazabilidad end-to-end |
| **Content-Based Router** | RabbitMQ Bindings | Routing keys para direccionar mensajes |

---

## 🔄 Flujo Order-to-Cash

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │───▶│  Auth Service   │───▶│ Token Validated │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│  Order Service  │───▶│    RabbitMQ     │
│  (Create Order) │    │  order.events   │
└─────────────────┘    └─────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│Inventory Service│  │ Payment Service │  │   Analytics     │
│(Reserve Stock)  │  │ (Process Pay)   │  │   (Kafka)       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Notification Service                        │
│               (Pub/Sub - Fanout Exchange)                   │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│ Customer Email  │          │ Operations Alert│
└─────────────────┘          └─────────────────┘
```

---

## 🏗️ Diagrama C4 - Contexto

```
┌─────────────────────────────────────────────────────────────────┐
│                        IntegraHub                               │
│                   Order-to-Cash Platform                        │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Retail Staff  │  │  E-commerce Web │  │  Legacy Systems │
│   (Portal)      │  │  Applications   │  │  (CSV Files)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🔧 Configuración de Resiliencia

### Circuit Breaker (Opossum)
```javascript
{
  timeout: 5000,           // 5 segundos timeout
  errorThresholdPercentage: 50,  // 50% errores para abrir
  resetTimeout: 30000      // 30 segundos para intentar cerrar
}
```

### Retry with Backoff
```javascript
{
  retries: 3,
  minTimeout: 1000,        // 1 segundo inicial
  maxTimeout: 10000,       // 10 segundos máximo
  factor: 2                // Exponencial: 1s, 2s, 4s
}
```

---

## 📊 Métricas y Monitoreo

| Servicio | Puerto | Health Endpoint | Dashboard |
|----------|--------|-----------------|-----------|
| Auth | 3000 | /health | - |
| Orders | 3001 | /health | - |
| Inventory | 3002 | /health | - |
| Payments | 3003 | /health | - |
| Notifications | 3004 | /health | - |
| Analytics | 3005 | /health | - |
| RabbitMQ | 15672 | /api/health | Management UI |
| Kafka | 8090 | - | Kafka UI |

---

## 🔐 Seguridad

### OAuth2 Grant Types Soportados
- `client_credentials` - Para servicios M2M
- (Extensible a `authorization_code`, `password`)

### Headers Requeridos
```http
Authorization: Bearer <access_token>
X-Correlation-ID: <uuid>
Idempotency-Key: <uuid>  (para POST)
```

---

## 📁 Estructura de Proyecto

```
IntegraHub/
├── docker-compose.yml
├── .env.example
├── README.md
├── infrastructure/
│   ├── init-db.sql
│   ├── nginx.conf
│   └── rabbitmq/
├── services/
│   ├── auth-service/
│   ├── order-service/
│   ├── inventory-service/
│   ├── payment-service/
│   └── notification-service/
├── legacy/
│   └── csv-processor/
├── analytics/
├── portal/
├── postman/
└── docs/
```
