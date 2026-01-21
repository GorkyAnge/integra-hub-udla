# IntegraHub - Arquitectura C4

## Nivel 1: Diagrama de Contexto

```
                    ┌───────────────────────────────────────────────────────┐
                    │                    IntegraHub                          │
                    │            Order-to-Cash Platform                      │
                    │                                                        │
                    │  Plataforma de integración empresarial para            │
                    │  automatizar el flujo completo desde pedido            │
                    │  hasta facturación en empresas de retail               │
                    └───────────────────────────────────────────────────────┘
                                            │
            ┌───────────────────────────────┼───────────────────────────────┐
            │                               │                               │
            ▼                               ▼                               ▼
    ┌───────────────┐              ┌───────────────┐              ┌───────────────┐
    │               │              │               │              │               │
    │  Retail Staff │              │  E-Commerce   │              │    Legacy     │
    │    (Users)    │              │  Applications │              │   Systems     │
    │               │              │               │              │               │
    │  Usa el portal│              │ Consumen APIs │              │ Envían CSVs   │
    │  demo para    │              │ REST para     │              │ a carpeta     │
    │  crear/ver    │              │ crear órdenes │              │ inbox         │
    │  pedidos      │              │ programátic.  │              │               │
    └───────────────┘              └───────────────┘              └───────────────┘
```

---

## Nivel 2: Diagrama de Contenedores

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 IntegraHub                                       │
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Portal    │  │ API Gateway │  │    Auth     │  │   Order     │             │
│  │   (Nginx)   │──│   (Nginx)   │──│   Service   │──│   Service   │             │
│  │             │  │             │  │   (Node.js) │  │   (Node.js) │             │
│  │ Puerto:8080 │  │ Puerto:80   │  │ Puerto:3000 │  │ Puerto:3001 │             │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────┬──────┘             │
│                                                            │                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │                     │
│  │  Inventory  │  │   Payment   │  │Notification │        │                     │
│  │   Service   │◀─│   Service   │◀─│   Service   │◀───────┘                     │
│  │   (Node.js) │  │   (Node.js) │  │   (Node.js) │   via RabbitMQ              │
│  │ Puerto:3002 │  │ Puerto:3003 │  │ Puerto:3004 │                              │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘                              │
│         │                │                                                       │
│  ┌──────┴────────────────┴──────┐  ┌─────────────┐  ┌─────────────┐             │
│  │         PostgreSQL            │  │   Legacy    │  │  Analytics  │             │
│  │        (Base de Datos)        │  │  Processor  │  │   Service   │             │
│  │         Puerto:5432           │  │   (Node.js) │  │   (Node.js) │             │
│  └───────────────────────────────┘  │ File Watcher│  │ Puerto:3005 │             │
│                                     └─────────────┘  └──────┬──────┘             │
│  ┌─────────────┐  ┌─────────────┐                          │                     │
│  │   RabbitMQ  │  │    Redis    │  ┌─────────────┐        │                     │
│  │   (Broker)  │  │   (Cache)   │  │    Kafka    │◀───────┘                     │
│  │ Puerto:5672 │  │ Puerto:6379 │  │  (Streaming)│                              │
│  │ UI: 15672   │  └─────────────┘  │ Puerto:9092 │                              │
│  └─────────────┘                   └─────────────┘                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Nivel 3: Diagrama de Componentes - Order Service

```
┌─────────────────────────────────────────────────────────────────┐
│                        Order Service                             │
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐                    │
│  │   Express App   │────▶│  Order Routes   │                    │
│  │   (index.js)    │     │                 │                    │
│  └─────────────────┘     └────────┬────────┘                    │
│                                   │                              │
│         ┌─────────────────────────┼─────────────────────────┐   │
│         │                         │                         │   │
│         ▼                         ▼                         ▼   │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────┐│
│  │  Auth Middleware│     │   Idempotency   │     │  Resilience ││
│  │                 │     │    Service      │     │   Service   ││
│  │ Valida JWT      │     │ Redis-backed    │     │ CircuitBreak││
│  │ tokens          │     │ deduplication   │     │ Retry+Back  ││
│  └─────────────────┘     └─────────────────┘     └─────────────┘│
│                                   │                              │
│                                   ▼                              │
│                          ┌─────────────────┐                    │
│                          │   RabbitMQ      │                    │
│                          │   Publisher     │                    │
│                          │                 │                    │
│                          │ order.events    │                    │
│                          │ (Topic Exchange)│                    │
│                          └─────────────────┘                    │
│                                   │                              │
│                                   ▼                              │
│                          ┌─────────────────┐                    │
│                          │     Kafka       │                    │
│                          │   Publisher     │                    │
│                          │ (Analytics)     │                    │
│                          └─────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flujo de Datos: Crear Orden

```
┌────────┐    ┌─────────┐    ┌────────┐    ┌──────────┐    ┌───────────┐
│ Client │───▶│ Gateway │───▶│  Auth  │───▶│  Order   │───▶│ PostgreSQL│
└────────┘    └─────────┘    └────────┘    └──────────┘    └───────────┘
    │                            │              │
    │         JWT Token          │              │
    │◀───────────────────────────┤              │
    │                                           │
    │         POST /orders                      │
    │──────────────────────────────────────────▶│
    │                                           │
    │                            ┌──────────────┼──────────────┐
    │                            │ RabbitMQ     │              │
    │                            ▼              ▼              ▼
    │                    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │                    │ Inventory │  │  Payment  │  │  Notific. │
    │                    │  Service  │  │  Service  │  │  Service  │
    │                    └───────────┘  └───────────┘  └───────────┘
    │                            │              │
    │                            │   Events     │
    │                            ▼              ▼
    │                    ┌─────────────────────────┐
    │                    │         Kafka          │
    │                    │    (Analytics Topic)   │
    │                    └─────────────────────────┘
    │                                   │
    │                                   ▼
    │                           ┌─────────────┐
    │                           │  Analytics  │
    │                           │   Service   │
    │                           └─────────────┘
```

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ─────▶ | Flujo sincrónico (HTTP/REST) |
| ═════▶ | Flujo asincrónico (Mensajería) |
| ◀───── | Respuesta |
| [Node.js] | Servicio implementado en Node.js + Express |
| [Nginx] | Servidor web / Proxy reverso |

---

## Tecnologías

| Componente | Tecnología | Versión |
|------------|------------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | Express | 4.18.x |
| Database | PostgreSQL | 15 |
| Message Broker | RabbitMQ | 3.12 |
| Cache | Redis | 7 |
| Streaming | Apache Kafka | Latest |
| API Gateway | Nginx | Alpine |
| Container | Docker | Latest |
| Orchestration | Docker Compose | 3.8 |
