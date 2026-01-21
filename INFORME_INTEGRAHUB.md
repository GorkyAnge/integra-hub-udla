# Informe Técnico - IntegraHub
## Plataforma de Integración Order-to-Cash para Retail

---

## 1. Introducción

**IntegraHub** es una plataforma empresarial de integración diseñada para implementar un flujo completo **Order-to-Cash** en empresas de retail. El proyecto demuestra la aplicación práctica de patrones de integración empresarial, arquitecturas de microservicios y tecnologías modernas de middleware para resolver problemas reales de integración entre sistemas heterogéneos.

Este proyecto fue desarrollado como parte del curso de **Integración de Sistemas** (202610), combinando teoría y práctica en un entorno simulado que refleja los desafíos reales de las empresas modernas.

### Alcance del Proyecto

- Implementación de **7 microservicios** especializados
- Integración de **sistemas legacy** mediante procesamiento de archivos CSV
- Implementación de **4 flujos de integración** principales
- **Arquitectura basada en eventos** con RabbitMQ y Kafka
- **Portal web de demostración** funcional
- **Seguridad OAuth2 + JWT** en todas las comunicaciones
- **Resiliencia** mediante Circuit Breaker, Retry y Dead Letter Queues

---

## 2. Resumen Ejecutivo

### 2.1 Descripción Breve del Problema

Las empresas de retail modernas operan con múltiples sistemas independientes:
- **Sistemas de gestión de pedidos** (Order Management)
- **Control de inventario** (Inventory Management)
- **Procesamiento de pagos** (Payment Processing)
- **Sistemas legacy** que operan con archivos CSV
- **Sistemas de notificaciones** (Email, SMS, Webhooks)
- **Plataformas de analítica** para Business Intelligence

Estos sistemas, al no estar integrados, generan:
- **Duplicación de datos** y esfuerzo manual
- **Falta de visibilidad** en tiempo real del estado de pedidos
- **Errores humanos** en transferencia de datos
- **Imposibilidad de trazabilidad** end-to-end
- **Lentitud en procesos** que deberían ser automáticos

### 2.2 Objetivo de la Solución

Desarrollar una **plataforma de integración empresarial** que:

- **Automatice el flujo Order-to-Cash** completo desde la creación del pedido hasta la confirmación de pago  
- **Integre sistemas legacy** sin necesidad de modificarlos  
- **Proporcione trazabilidad** end-to-end mediante Correlation IDs  
- **Garantice resiliencia** ante fallos de red o servicios  
- **Implemente seguridad** mediante OAuth2/JWT  
- **Facilite analítica** en tiempo real mediante streaming  

### 2.3 Tecnologías y Enfoque de Integración

| Categoría | Tecnología | Propósito |
|-----------|------------|-----------|
| **Runtime** | Node.js 20 LTS | Servicios backend |
| **Framework Web** | Express.js 4.18 | APIs REST |
| **Message Broker** | RabbitMQ 3.12 | Mensajería asíncrona P2P y Pub/Sub |
| **Streaming Platform** | Apache Kafka | Eventos de analítica en tiempo real |
| **Database** | PostgreSQL 15 | Almacenamiento persistente |
| **Cache** | Redis 7 | Idempotencia y sesiones |
| **API Gateway** | Nginx Alpine | Proxy reverso y load balancing |
| **Containerization** | Docker + Docker Compose | Orquestación de servicios |
| **Authentication** | OAuth2 + JWT | Seguridad y control de acceso |
| **Resiliencia** | Opossum (Circuit Breaker) | Protección ante fallos |

**Enfoque de Integración:**
- **API-First**: Todas las integraciones síncronas mediante REST APIs
- **Event-Driven**: Comunicación asíncrona mediante eventos para desacoplamiento
- **File-Based**: Integración legacy mediante procesamiento de archivos CSV
- **Streaming**: Analítica en tiempo real con Kafka

### 2.4 Resultado Esperado

Una **plataforma funcional** que demuestre:

1. Creación de pedidos desde portal web
2. Procesamiento automático: inventario → pago → notificación
3. Integración con sistema legacy CSV
4. Dashboard de analítica en tiempo real
5. Autenticación y autorización OAuth2
6. Manejo resiliente de errores (Circuit Breaker, Retry, DLQ)
7. Trazabilidad completa con Correlation IDs
8. Documentación OpenAPI/Swagger
9. Colección Postman para testing
10. Sistema completamente dockerizado

---

## 3. Contexto y Problema

### 3.1 Situación de la Empresa

**Escenario**: Empresa de retail mediana con operación omnicanal (tiendas físicas + e-commerce) que enfrenta los siguientes desafíos:

**Sistemas Actuales:**
- **Sistema POS** en tiendas físicas (sistema propietario legacy)
- **Plataforma e-commerce** (sistema moderno con API)
- **Sistema de inventario** (base de datos SQL con interfaz web antigua)
- **Gateway de pagos** (integración con proveedor externo)
- **Sistema de notificaciones** (emails transaccionales)
- **Herramienta de BI** (informes manuales en Excel)

**Problemática Actual:**
1. Los pedidos del e-commerce se ingresan **manualmente** al sistema de inventario
2. El sistema legacy envía archivos CSV cada noche que deben procesarse manualmente
3. No hay **visibilidad en tiempo real** del stock disponible
4. Las notificaciones a clientes se envían manualmente
5. Los reportes de ventas se generan **semanalmente** de forma manual
6. **Alta tasa de errores** por duplicación de datos y transcripciones manuales

### 3.2 Sistemas Involucrados

```plantuml
@startuml
title Sistemas Actuales

package "SISTEMAS ACTUALES" {
  component "E-Commerce\n(API)" as ecom
  component "Legacy POS\n(CSV)" as legacy
  component "Inventory\n(SQL)" as inventory
}

note bottom of ecom
  INTEGRACIÓN MANUAL
  (Errores, lentitud, sin
  trazabilidad)
end note

ecom -down-> legacy
legacy -down-> inventory
@enduml
```

### 3.3 Necesidad de Integración Order-to-Cash

El flujo **Order-to-Cash** es crítico para la operación:

```
PEDIDO → VALIDACIÓN INVENTARIO → PROCESAMIENTO PAGO → CONFIRMACIÓN → ANALÍTICA
```

**Requisitos del negocio:**
- **Tiempo de procesamiento** < 5 segundos
- **Sincronización automática** entre sistemas
- **Visibilidad en tiempo real** del estado de pedidos
- **Seguridad** en todas las transacciones
- **Métricas** de ventas actualizadas en tiempo real
- **Resiliencia** ante caídas de servicios
- **Notificaciones automáticas** a clientes

### 3.4 Alcance del Proyecto

#### Incluido en el Alcance

- **Microservicios Core**: Auth, Orders, Inventory, Payments, Notifications, Analytics
- **Integración Legacy**: Procesador de archivos CSV con validación
- **Portal de Demostración**: UI web para creación y consulta de pedidos
- **Seguridad**: OAuth2 + JWT con validación de tokens
- **Resiliencia**: Circuit Breaker, Retry, Timeouts, Dead Letter Queues
- **Mensajería**: RabbitMQ con exchanges P2P y Pub/Sub
- **Streaming**: Kafka para eventos de analítica
- **Documentación**: OpenAPI/Swagger + Colección Postman
- **Deployment**: Docker Compose con todos los servicios

#### Fuera del Alcance

- Interfaz móvil (iOS/Android)
- Integración con sistemas de pago reales (se simula)
- Autenticación de usuarios finales (solo OAuth2 client credentials)
- Persistencia de logs centralizados (ELK Stack)
- Monitoreo avanzado (Prometheus + Grafana)
- CI/CD automatizado
- Deployment en cloud (AWS/Azure/GCP)
- Escalado horizontal automático

---

## 4. Objetivos

### 4.1 Objetivo General

Desarrollar una **plataforma de integración empresarial basada en microservicios** que automatice el flujo Order-to-Cash completo, implementando patrones de integración empresarial, garantizando resiliencia, seguridad y trazabilidad end-to-end.

### 4.2 Objetivos Específicos

#### OE1: Arquitectura de Microservicios
Diseñar e implementar **7 microservicios independientes** (Auth, Orders, Inventory, Payments, Notifications, Analytics, Legacy Processor) con APIs REST documentadas.

#### OE2: Patrones de Integración
Implementar **10 patrones de integración** incluyendo Point-to-Point, Pub/Sub, Message Router, Circuit Breaker, Idempotent Consumer, Dead Letter Channel, Content-Based Router, Message Translator, Correlation Identifier y Retry with Backoff.

#### OE3: Comunicación Asíncrona
Establecer **comunicación basada en eventos** mediante RabbitMQ con exchanges de tipo Direct, Topic y Fanout para desacoplar servicios.

#### OE4: Resiliencia
Garantizar **alta disponibilidad** mediante Circuit Breaker (Opossum), reintentos con backoff exponencial, timeouts configurables y Dead Letter Queues.

#### OE5: Seguridad
Implementar **autenticación y autorización** mediante OAuth2 Client Credentials + JWT con validación de tokens en todos los servicios.

#### OE6: Trazabilidad
Asegurar **trazabilidad completa** mediante Correlation IDs en todos los logs y eventos, permitiendo seguimiento end-to-end de cada transacción.

#### OE7: Integración Legacy
Desarrollar **procesador de archivos CSV** que detecte, valide, transforme y cargue archivos del sistema legacy sin modificar el sistema origen.

#### OE8: Analítica en Tiempo Real
Implementar **streaming de eventos** mediante Kafka para alimentar un servicio de analíticas que calcule métricas en tiempo real.

#### OE9: Idempotencia
Prevenir **procesamiento duplicado** mediante cache Redis con Idempotency-Keys en requests y message IDs en consumidores.

#### OE10: Demo Funcional
Crear **portal web** que permita demostrar el flujo completo: creación de pedidos, visualización de estado, system health y trazabilidad.

---

## 5. Arquitectura de la Solución

### 5.1 Descripción General

IntegraHub implementa una **arquitectura de microservicios orientada a eventos** con los siguientes principios:

**Principios Arquitectónicos:**
- **Desacoplamiento**: Servicios independientes que se comunican via eventos
- **Cohesión**: Cada servicio tiene una responsabilidad única y bien definida
- **Escalabilidad**: Servicios stateless que pueden escalar horizontalmente
- **Resiliencia**: Cada servicio maneja sus propios fallos sin afectar a otros
- **Observabilidad**: Logs estructurados, health checks y correlation IDs

**Capas de la Arquitectura:**

```plantuml
@startuml
title Arquitectura en Capas - IntegraHub

package "CAPA DE PRESENTACIÓN" {
  [Portal Web - Nginx:8080]
}

package "API GATEWAY" {
  [Nginx Reverse Proxy]
  note right: Routing, Load Balancing
}

package "CAPA DE SEGURIDAD" {
  [Auth Service]
  note right: OAuth2 + JWT
}

package "CAPA DE APLICACIÓN" {
  [Order Service]
  [Inventory]
  [Payment]
  [Notification]
}

package "CAPA DE INTEGRACIÓN" {
  [Legacy Processor]
  note right: CSV Files
}

package "CAPA DE MENSAJERÍA" {
  [RabbitMQ] 
  [Kafka]
  note bottom: P2P + Pub/Sub | Streaming
}

package "CAPA DE DATOS" {
  database "PostgreSQL" as pg
  database "Redis" as redis
  [Analytics Service]
  note bottom: Persistencia | Cache/Idemp. | Analytics
}

[Portal Web - Nginx:8080] -down-> [Nginx Reverse Proxy]
[Nginx Reverse Proxy] -down-> [Auth Service]
[Nginx Reverse Proxy] -down-> [Order Service]
[Nginx Reverse Proxy] -down-> [Legacy Processor]
[Auth Service] -down-> [RabbitMQ]
[Order Service] -down-> [RabbitMQ]
[Inventory] -down-> [RabbitMQ]
[Payment] -down-> [RabbitMQ]
[Notification] -down-> [RabbitMQ]
[Legacy Processor] -down-> [RabbitMQ]
[RabbitMQ] -down-> pg
[RabbitMQ] -down-> redis
[Kafka] -down-> [Analytics Service]
@enduml
```

### 5.2 Diagrama C4 - Nivel 1: Contexto

```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

Person(retailStaff, "Retail Staff", "Personal de la tienda que usa el portal demo")
Person(ecommerce, "E-Commerce Apps", "Aplicaciones que consumen las APIs REST")
System_Ext(legacy, "Legacy Systems", "Sistemas antiguos que exportan CSV")

System(integrahub, "IntegraHub Platform", "Order-to-Cash Integration\n\nPlataforma que automatiza el flujo\ncompleto desde pedido hasta pago\nintegrando sistemas modernos y\nlegacy de forma resiliente")

Rel(retailStaff, integrahub, "Consulta pedidos, ve estado en portal")
Rel(ecommerce, integrahub, "Crea pedidos vía API, recibe webhooks")
Rel(legacy, integrahub, "Genera archivos CSV cada noche")

@enduml
```

### 5.3 Diagrama C4 - Nivel 2: Contenedores

```plantuml
@startuml
title Diagrama de Contenedores - IntegraHub Platform

package "Frontend" {
  [Portal Web\nNginx:8080] as portal
}

package "Gateway" {
  [API Gateway\nNginx:80] as gateway
}

package "Servicios" {
  [Auth Service\nNode.js:3000] as auth
  [Order Service\nNode.js:3001] as order
  [Inventory Service\nNode.js:3002] as inventory
  [Payment Service\nNode.js:3003] as payment
  [Notification Service\nNode.js:3004] as notification
  [Analytics Service\nNode.js:3005] as analytics
  [Legacy Processor\nNode.js] as legacy
}

package "Infraestructura" {
  database "PostgreSQL\n:5432" as postgres
  queue "RabbitMQ\n:5672/:15672" as rabbitmq
  database "Redis\n:6379" as redis
  queue "Kafka\n:9092" as kafka
}

portal --> gateway
gateway --> auth
gateway --> order
gateway --> inventory
gateway --> payment
gateway --> notification
gateway --> analytics

order --> rabbitmq
auth --> rabbitmq
inventory --> rabbitmq
payment --> rabbitmq
notification --> rabbitmq
legacy --> rabbitmq

order --> postgres
inventory --> postgres
payment --> postgres
auth --> postgres

order --> redis
payment --> redis

legacy --> kafka
analytics --> kafka

note right of postgres
  Orders, Inventory,
  Payments, Users
end note

note right of rabbitmq
  P2P + Pub/Sub
  Message Broker
end note

note right of redis
  Cache e
  Idempotencia
end note

note right of kafka
  Event Streaming
  para Analytics
end note

@enduml
```

**Tecnologías:**
- Node.js 20 LTS - Runtime de servicios
- Express.js - Framework web REST
- PostgreSQL 15 - Base de datos relacional
- RabbitMQ 3.12 - Message Broker (AMQP)
- Kafka - Event Streaming Platform
- Redis 7 - Cache e Idempotencia
- Nginx - Gateway y hosting del portal
- Docker - Containerización

### 5.4 Justificación de Decisiones Técnicas

#### Node.js como Runtime

**Decisión**: Usar Node.js para todos los microservicios

**Justificación**:
- **Event-driven por naturaleza**: Ideal para aplicaciones con I/O intensivo
- **Asíncrono**: Excelente para microservicios que hacen muchas llamadas HTTP/DB
- **Ecosistema rico**: NPM con librerías maduras para RabbitMQ, Kafka, Redis
- **JavaScript end-to-end**: Mismo lenguaje en frontend (portal) y backend

**Trade-offs**:
- No es ideal para procesamiento CPU-intensivo (no aplica en nuestro caso)
- Single-threaded (mitigado con cluster mode)

#### RabbitMQ para Mensajería

**Decisión**: RabbitMQ como message broker principal

**Justificación**:
- **Soporte de múltiples patrones**: Direct, Topic, Fanout, Headers
- **Dead Letter Queues** nativas
- **UI de administración** incluida
- **Garantías de entrega**: Acknowledge, persistencia, confirmaciones

**Trade-offs**:
- Menor throughput que Kafka (no es problema para nuestro volumen)
- Complementamos con Kafka para streaming

#### Kafka para Analytics

**Decisión**: Apache Kafka para eventos de analítica

**Justificación**:
- **Alto throughput**: Maneja millones de eventos/segundo
- **Retención de mensajes**: Los eventos quedan disponibles para reprocessing
- **Stream processing**: Ideal para cálculos en tiempo real

**Trade-offs**:
- Mayor complejidad que RabbitMQ
- Usamos solo para analítica, no para comunicación entre servicios

#### PostgreSQL como Base de Datos

**Decisión**: PostgreSQL para persistencia

**Justificación**:
- **ACID compliant**: Transacciones confiables
- **Relacional**: Ideal para pedidos, inventario, pagos (datos estructurados)
- **Open source** y ampliamente adoptado
- **JSON support**: Flexibilidad cuando se necesita

**Trade-offs**:
- Menos escalable horizontalmente que NoSQL
- Suficiente para el alcance del proyecto

#### Redis para Cache e Idempotencia

**Decisión**: Redis para caché y control de idempotencia

**Justificación**:
- **In-memory**: Acceso ultra-rápido (< 1ms)
- **TTL nativo**: Expiración automática de keys
- **Atomic operations**: Set, Get, Exists en una operación

**Trade-offs**:
- Datos en memoria (volátil)
- Ideal para cache temporal e idempotencia

#### OAuth2 + JWT para Autenticación

**Decisión**: OAuth2 Client Credentials flow + JWT tokens

**Justificación**:
- **Estándar de industria**: RFC 6749
- **Stateless**: No requiere sesión en servidor
- **Self-contained**: Token tiene toda la info necesaria
- **Scope-based**: Control granular de permisos

**Trade-offs**:
- No soporta refresh tokens en client_credentials
- Suficiente para M2M (machine-to-machine)

#### Docker Compose para Deployment

**Decisión**: Docker Compose para orquestación

**Justificación**:
- **Simplicidad**: Un solo comando para levantar todo
- **Reproducibilidad**: Mismo entorno en cualquier máquina
- **Networking**: Red privada entre contenedores
- **Ideal para desarrollo y demo**

**Trade-offs**:
- No apto para producción a gran escala
- Para producción se usaría Kubernetes

---

## 6. Flujos de Integración

### 6.1 Flujo A – Creación y Procesamiento de Pedidos (E2E)

**Descripción**: Flujo completo desde que un cliente crea un pedido hasta la confirmación de pago y notificación.

**Actores**:
- Cliente (via Portal o API)
- Auth Service
- Order Service
- Inventory Service
- Payment Service
- Notification Service
- RabbitMQ

**Diagrama de Secuencia**:

```plantuml
@startuml
title Flujo A - Creación y Procesamiento de Pedidos (E2E)

actor Cliente
participant "API Gateway" as Gateway
participant "Auth Service" as Auth
participant "Order Service" as Order
queue RabbitMQ
participant "Inventory Service" as Inventory
participant "Payment Service" as Payment
participant "Notification Service" as Notification

Cliente -> Gateway: 1. POST /auth/token
Gateway -> Auth: Forward request
Auth --> Gateway: JWT Token
Gateway --> Cliente: JWT Token

Cliente -> Gateway: 2. POST /orders\n+ Bearer Token
Gateway -> Auth: Validate JWT
Auth --> Gateway: Validated
Gateway -> Order: Create order

Order -> Order: 3. Check Idempotency\n(Redis)
Order -> Order: 4. Save to DB\n(PostgreSQL)
Order -> RabbitMQ: 5. Publish Event\norder.created
Order --> Gateway: 201 Created
Gateway --> Cliente: {orderId}

RabbitMQ -> Inventory: 6. Consume\norder.created
Inventory -> Inventory: Reserve Stock
Inventory -> RabbitMQ: 7. Publish\ninventory.reserved

RabbitMQ -> Payment: 8. Consume\ninventory.reserved
Payment -> Payment: Process Payment
Payment -> RabbitMQ: 9. Publish\npayment.completed

RabbitMQ -> Order: 10. Consume\npayment.completed
Order -> Order: Update Order Status

Order -> RabbitMQ: 11. Publish (Fanout)\norder.confirmed
RabbitMQ -> Notification: Forward event
Notification -> Notification: 12. Send Email

Cliente -> Gateway: 13. GET /orders/{id}
Gateway -> Order: Get order
Order --> Gateway: Status: "confirmed"
Gateway --> Cliente: Order details

@enduml
```

**Pasos Detallados**:

1. **Autenticación**: Cliente solicita token OAuth2
2. **Creación de Pedido**: POST /orders con items y datos del cliente
3. **Verificación Idempotencia**: Redis verifica que no sea request duplicado
4. **Persistencia**: Pedido se guarda en PostgreSQL con estado "pending"
5. **Publicación Evento**: `order.created` se publica en RabbitMQ
6. **Reserva de Inventario**: Inventory Service consume evento y reserva stock
7. **Confirmación Inventario**: Publica `inventory.reserved`
8. **Procesamiento de Pago**: Payment Service consume y procesa pago
9. **Confirmación de Pago**: Publica `payment.completed`
10. **Actualización de Estado**: Order Service actualiza estado a "confirmed"
11. **Notificación Fanout**: Se publican eventos a múltiples suscriptores
12. **Envío de Email**: Notification Service envía confirmación al cliente
13. **Consulta de Estado**: Cliente puede consultar estado actualizado

**Patrones Aplicados**:
- **Point-to-Point**: Colas dedicadas para procesamiento secuencial
- **Publish/Subscribe**: Fanout para notificaciones
- **Idempotent Consumer**: Redis previene duplicados
- **Correlation Identifier**: UUID en headers de todos los mensajes
- **Circuit Breaker**: En llamadas a servicios externos

### 6.2 Flujo B – Notificaciones (Pub/Sub)

**Descripción**: Sistema de notificaciones basado en patrón Publisher/Subscriber con RabbitMQ Fanout Exchange.

**Diagrama de Secuencia**:

```plantuml
@startuml
title Flujo B - Notificaciones (Pub/Sub)

participant "Order Service" as Order
participant "RabbitMQ\nFanout Exchange" as RabbitMQ
queue "Email Queue" as EmailQ
queue "Webhook Queue" as WebhookQ
queue "Audit Queue" as AuditQ

Order -> RabbitMQ: 1. Publish\norder.confirmed\n(Fanout)
RabbitMQ -> EmailQ: 2. Route
RabbitMQ -> WebhookQ: 3. Route
RabbitMQ -> AuditQ: 4. Route

note over EmailQ, AuditQ
  5. Notification Service Consumers
end note

EmailQ -> EmailQ: Send Email\nto Customer
WebhookQ -> WebhookQ: Send Webhook\nto Slack/Discord
AuditQ -> AuditQ: Log Audit Event

@enduml
```

**Características**:
- **Fanout Exchange**: Un mensaje se replica a todas las colas bindadas
- **Múltiples Consumidores**: Email, Webhook, Audit logs
- **Desacoplamiento Total**: Publicador no conoce a los suscriptores
- **Fácil Extensión**: Nuevos consumidores sin modificar código existente

**Implementación**:

```javascript
// Publisher (Order Service)
await channel.publish(
  'order.events',           // Exchange
  '',                       // Routing key (vacío en fanout)
  Buffer.from(JSON.stringify({
    event: 'order.confirmed',
    orderId: order.id,
    customerEmail: order.customerEmail,
    timestamp: new Date().toISOString(),
    correlationId: req.headers['x-correlation-id']
  }))
);

// Subscribers (Notification Service)
// Consumer 1: Email
channel.consume('notification.email', async (msg) => {
  const event = JSON.parse(msg.content.toString());
  await sendEmail(event.customerEmail, 'Order Confirmed', event);
  channel.ack(msg);
});

// Consumer 2: Webhook
channel.consume('notification.webhook', async (msg) => {
  const event = JSON.parse(msg.content.toString());
  await sendWebhook('https://hooks.slack.com/...', event);
  channel.ack(msg);
});
```

### 6.3 Flujo C – Integración por Archivos (Legacy)

**Descripción**: Procesamiento automático de archivos CSV generados por sistema legacy.

**Diagrama de Secuencia**:

```plantuml
@startuml
title Flujo C - Integración por Archivos (Legacy)

actor "Legacy System" as Legacy
participant "File System" as FS
participant "Legacy Processor" as LP
participant "Validator" as V
database "PostgreSQL" as DB
queue "RabbitMQ" as MQ

Legacy -> FS: 1. Generate CSV File\n(nightly)
LP -> FS: 2. Watch /inbox folder
FS -> LP: 3. File Detected

LP -> LP: 4. Read CSV
LP -> V: 5. Validate Schema, Data
V -> LP: 6. Valid/Invalid

alt IF VALID
  LP -> LP: 7. Transform CSV → JSON
  LP -> DB: 8. Insert to DB
  LP -> MQ: 9. Publish\nlegacy.imported
  LP -> FS: 10. Move File to /processed
else IF INVALID
  LP -> FS: 11. Move File to /error
end

@enduml
```

**Ejemplo CSV de Entrada**:

```csv
product_id,product_name,quantity,price,date
PRD001,Laptop Dell,50,1200.00,2026-01-20
PRD002,Mouse Logitech,200,25.50,2026-01-20
PRD003,Keyboard Mecánico,75,89.99,2026-01-20
```

**Validaciones Aplicadas**:
- Headers requeridos presentes
- Tipos de datos correctos
- Valores dentro de rangos permitidos
- Duplicados (basado en product_id)

**Transformación (Message Translator)**:

```javascript
// CSV Row
{
  product_id: 'PRD001',
  product_name: 'Laptop Dell',
  quantity: '50',
  price: '1200.00',
  date: '2026-01-20'
}

// Transformed to Internal Model
{
  productId: 'PRD001',
  name: 'Laptop Dell',
  stockQuantity: 50,
  unitPrice: 1200.00,
  lastUpdated: new Date('2026-01-20'),
  source: 'legacy_import',
  importedAt: new Date()
}
```

**Carpetas**:
- `/inbox`: Archivos pendientes de procesar
- `/processed`: Archivos procesados exitosamente
- `/error`: Archivos con errores de validación

### 6.4 Flujo D – Analítica (Streaming con Kafka)

**Descripción**: Procesamiento en tiempo real de eventos para generar métricas de negocio.

**Diagrama de Secuencia**:

```plantuml
@startuml
title Flujo D - Analítica (Streaming con Kafka)

participant "Order Service" as Order
participant "Payment Service" as Payment
queue "Kafka Topic" as Kafka
participant "Analytics Service" as Analytics
database "PostgreSQL" as DB

Order -> Kafka: 1. Publish\norder.created
Payment -> Kafka: 2. Publish\npayment.completed

Kafka <- Analytics: 3. Subscribe\n(Consumer Group)
Kafka -> Analytics: 4. Stream Events\n(Real-time)

Analytics -> Analytics: 5. Calculate Metrics\n• Total Sales\n• Avg Order\n• Orders/hour

Analytics -> DB: 6. Store Aggregates
DB --> Analytics: Confirm

note over Analytics
  7. GET /metrics
  (API Query)
end note

@enduml
```

**Eventos Capturados**:
- `order.created` → Nuevo pedido
- `payment.completed` → Pago exitoso
- `order.cancelled` → Pedido cancelado
- `inventory.updated` → Cambio en stock

**Métricas Calculadas**:

```javascript
{
  "realtime_metrics": {
    "total_orders_today": 156,
    "total_revenue_today": 45678.90,
    "average_order_value": 292.81,
    "orders_last_hour": 12,
    "top_products": [
      { "productId": "PRD001", "sales": 45 },
      { "productId": "PRD002", "sales": 38 }
    ]
  },
  "timestamp": "2026-01-21T16:45:00Z"
}
```

**Ventanas de Tiempo** (Windowing):
- **Tumbling Window**: Cada hora (00:00-01:00, 01:00-02:00)
- **Sliding Window**: Últimos 5 minutos (se recalcula cada minuto)

**Consumer Group**: Permite escalar horizontalmente múltiples instancias del Analytics Service.

---

## 7. Patrones de Integración Implementados

### 7.1 Matriz de Patrones

| # | Patrón | Dónde se Usa | Por Qué se Usa | Trade-offs | Evidencia |
|---|--------|--------------|----------------|------------|-----------|
| 1 | **Point-to-Point Channel** | Cola `order.process`, `payment.process` | Procesamiento secuencial garantizado, un solo consumidor activo | ❌ No escala con múltiples consumers<br>✅ Orden garantizado | [order-service/config/rabbitmq.js](services/order-service/src/config/rabbitmq.js) |
| 2 | **Publish/Subscribe** | Exchange `order.events` (Fanout) | Notificar a múltiples servicios sin acoplamiento | ❌ Todos reciben todo (no hay filtrado)<br>✅ Fácil agregar suscriptores | [notification-service/index.js](services/notification-service/src/index.js) |
| 3 | **Message Router** | Routing keys en Order Service | Dirigir mensajes según tipo de evento | ❌ Requiere conocer routing keys<br>✅ Flexible y escalable | [rabbitmq/definitions.json](infrastructure/rabbitmq/definitions.json) |
| 4 | **Message Translator** | Legacy CSV Processor | Transformar CSV legacy a JSON moderno | ❌ Código específico por formato<br>✅ Independencia de sistemas | [legacy/src/index.js](legacy/src/index.js) |
| 5 | **Dead Letter Channel** | Cola `orders.dlq` | Manejar mensajes que fallan repetidamente | ❌ Requiere monitoreo de DLQ<br>✅ No pierde mensajes | [rabbitmq/definitions.json](infrastructure/rabbitmq/definitions.json) |
| 6 | **Idempotent Consumer** | Redis cache en Order Service | Evitar procesamiento duplicado de pedidos | ❌ Dependencia de Redis<br>✅ Garantiza exactly-once | [order-service/services/idempotency.service.js](services/order-service/src/services/idempotency.service.js) |
| 7 | **Circuit Breaker** | Opossum en Order Service | Proteger contra caídas de servicios externos | ❌ Requiere ajuste de thresholds<br>✅ Previene cascading failures | [order-service/services/resilience.service.js](services/order-service/src/services/resilience.service.js) |
| 8 | **Retry with Backoff** | async-retry en Payment Service | Reintentar operaciones transitorias fallidas | ❌ Aumenta latencia en fallos<br>✅ Tolera errores temporales | [order-service/services/resilience.service.js](services/order-service/src/services/resilience.service.js) |
| 9 | **Correlation Identifier** | Header `x-correlation-id` | Trazar requests end-to-end en logs | ❌ Debe propagarse manualmente<br>✅ Debugging facilitado | Logs de todos los servicios |
| 10 | **Content-Based Router** | RabbitMQ topic exchange | Ruteo basado en routing key patterns | ❌ Complejidad en bindings<br>✅ Filtrado fino de mensajes | [rabbitmq/definitions.json](infrastructure/rabbitmq/definitions.json) |

### 7.2 Detalles de Implementación

#### Circuit Breaker (Opossum)

```javascript
// Configuration
const circuitBreakerOptions = {
  timeout: 5000,                    // 5s timeout
  errorThresholdPercentage: 50,     // Open al 50% de errores
  resetTimeout: 30000,              // 30s en half-open antes de cerrar
  volumeThreshold: 5                // Min 5 requests para evaluar
};

// Estados
CLOSED → Funcionamiento normal
OPEN → Rechaza requests, retorna error inmediato
HALF_OPEN → Prueba si servicio recuperó
```

**Ejemplo Real**:
```javascript
const breaker = new CircuitBreaker(callPaymentGateway, options);

breaker.on('open', () => {
  logger.warn('Circuit OPEN: Payment gateway failing');
  notifyOps('Payment service degraded');
});

breaker.fallback(() => {
  return { status: 'pending', message: 'Payment queued' };
});
```

#### Idempotency con Redis

```javascript
// Check idempotency before processing
async function createOrder(req, res) {
  const idempotencyKey = req.headers['idempotency-key'];
  
  // Check if already processed
  const existing = await redis.get(`idempotency:${idempotencyKey}`);
  if (existing) {
    return res.status(200).json(JSON.parse(existing));
  }
  
  // Process order
  const order = await processOrder(req.body);
  
  // Store result with TTL
  await redis.setEx(
    `idempotency:${idempotencyKey}`,
    86400,  // 24 hours
    JSON.stringify(order)
  );
  
  return res.status(201).json(order);
}
```

**Previene**:
- Pedidos duplicados por retry del cliente
- Re-procesamiento de mensajes en RabbitMQ
- Race conditions en sistemas distribuidos

---

## 8. Resiliencia y Manejo de Errores

### 8.1 Timeouts

**Configuración por Servicio**:

| Servicio | Request Timeout | Connection Timeout | Database Timeout |
|----------|----------------|-------------------|------------------|
| Order Service | 5s | 3s | 10s |
| Payment Service | 10s (pago externo) | 3s | 10s |
| Inventory Service | 5s | 3s | 10s |
| Notification Service | 15s (SMTP) | 5s | 10s |

**Implementación**:

```javascript
// HTTP Request Timeout
const axios = require('axios');
const response = await axios.get(url, {
  timeout: 5000,  // 5 segundos
  headers: { 'X-Correlation-ID': correlationId }
});

// Database Query Timeout
const result = await pool.query({
  text: 'SELECT * FROM orders WHERE id = $1',
  values: [orderId],
  timeout: 10000  // 10 segundos
});
```

### 8.2 Retries y Backoff Exponencial

**Estrategia**:

```
Intento 1: Inmediato
Intento 2: Wait 1s  (2^0 * 1000ms)
Intento 3: Wait 2s  (2^1 * 1000ms)
Intento 4: Wait 4s  (2^2 * 1000ms)
Max: 3 reintentos
```

**Implementación**:

```javascript
const retry = require('async-retry');

await retry(
  async (bail, attemptNumber) => {
    try {
      return await callExternalService();
    } catch (error) {
      // No reintentar errores 4xx (errores del cliente)
      if (error.status >= 400 && error.status < 500) {
        bail(error);  // Cancelar reintentos
        return;
      }
      // Reintentar 5xx y errores de red
      throw error;
    }
  },
  {
    retries: 3,
    factor: 2,           // Exponencial
    minTimeout: 1000,    // 1s inicial
    maxTimeout: 10000,   // 10s máximo
    onRetry: (error, attemptNumber) => {
      logger.warn(`Retry ${attemptNumber}: ${error.message}`);
    }
  }
);
```

**No se Reintentan**:
- Errores 400 (Bad Request)
- Errores 401/403 (Auth)
- Errores 404 (Not Found)
- Validaciones de negocio

**Sí se Reintentan**:
- Errores 5xx (Server Errors)
- Timeouts de red
- Connection refused
- Temporary database errors

### 8.3 Circuit Breaker (Protección en Cascada)

**Estados y Transiciones**:

```plantuml
@startuml
title Estados del Circuit Breaker

state "CLOSED\n(Normal)" as CLOSED
state "OPEN\n(Rechazando)" as OPEN
state "HALF_OPEN\n(Probando)" as HALF_OPEN

[*] --> CLOSED
CLOSED --> OPEN : 50% errors\nthreshold
OPEN --> HALF_OPEN : After 30s\nreset timeout
HALF_OPEN --> CLOSED : Success
HALF_OPEN --> OPEN : Failure

note right of CLOSED
  Funcionamiento normal
  Requests pasan
end note

note right of OPEN
  Rechaza requests
  Retorna error inmediato
end note

note right of HALF_OPEN
  Prueba si servicio
  recuperó
end note

@enduml
```

**Configuración Real**:

```javascript
{
  timeout: 5000,                    // Timeout de request
  errorThresholdPercentage: 50,     // % de errores para abrir
  resetTimeout: 30000,              // Tiempo en OPEN antes de HALF_OPEN
  volumeThreshold: 5                // Mínimo de requests para evaluar
}
```

**Ejemplo de Fallback**:

```javascript
const breaker = new CircuitBreaker(processPayment, options);

// Fallback: Cola el pago para procesamiento posterior
breaker.fallback(() => {
  return {
    status: 'queued',
    message: 'Payment gateway unavailable, queued for processing'
  };
});

// Monitoreo
breaker.on('open', () => {
  logger.error('CIRCUIT OPEN: Payment service down');
  metrics.increment('circuit_breaker_open');
});
```

### 8.4 Dead Letter Queue (DLQ)

**Configuración RabbitMQ**:

```json
{
  "queues": [
    {
      "name": "order.process",
      "durable": true,
      "arguments": {
        "x-dead-letter-exchange": "dlx.exchange",
        "x-dead-letter-routing-key": "orders.dlq",
        "x-message-ttl": 300000
      }
    },
    {
      "name": "orders.dlq",
      "durable": true
    }
  ]
}
```

**Flujo de DLQ**:

```plantuml
@startuml
title Flujo de Dead Letter Queue (DLQ)

queue "order.process\n(Main Queue)" as MainQ
participant "Consumer\n(3 reintentos)" as Consumer
rectangle "Processing\nSuccess" as Success
queue "orders.dlq\n(Dead Letter)" as DLQ
rectangle "Manual Review\n(RabbitMQ UI)" as Manual
rectangle "Automated Retry\n(Scheduled Job)" as Auto

MainQ -> Consumer: Consume message
Consumer -> Success: Processó OK

Consumer -> Consumer: Falló 3 veces
Consumer -> DLQ: Send to DLQ

DLQ --> Manual
DLQ --> Auto

@enduml
```

**Razones para DLQ**:
- Mensaje malformado (JSON inválido)
- Violación de constraints de DB
- Servicio downstream caído permanentemente
- Timeout repetido

### 8.5 Evidencia de Fallos Controlados

**Escenario 1: Service Unavailable**

```bash
# Simular caída de Payment Service
docker-compose stop integrahub-payments

# Crear orden - Circuit Breaker actúa
curl -X POST http://localhost:3001/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "customerId": "test", "items": [...] }'

# Response (Fallback)
{
  "orderId": "ord-123",
  "status": "pending",
  "message": "Order created, payment processing queued"
}

# Logs
[WARN] Circuit breaker OPEN for payment-service
[INFO] Fallback executed: Payment queued for retry
```

**Escenario 2: Mensaje Duplicado**

```bash
# Primera request
curl -X POST http://localhost:3001/api/orders \
  -H "Idempotency-Key: abc-123" \
  -d '{...}'

# Response: 201 Created

# Segunda request (mismo Idempotency-Key)
curl -X POST http://localhost:3001/api/orders \
  -H "Idempotency-Key: abc-123" \
  -d '{...}'

# Response: 200 OK (mismo resultado, no duplicado)

# Logs
[DEBUG] Idempotency hit for key: abc-123
[INFO] Returning cached result
```

**Escenario 3: Dead Letter Queue**

```bash
# Publicar mensaje malformado
{"invalid": "json", "missing": "required_fields"}

# Consumer intenta procesar 3 veces
[ERROR] Attempt 1/3 failed: Missing required field 'orderId'
[ERROR] Attempt 2/3 failed: Missing required field 'orderId'
[ERROR] Attempt 3/3 failed: Missing required field 'orderId'
[WARN] Message sent to DLQ: orders.dlq

# Verificar en RabbitMQ UI
http://localhost:15672 → Queues → orders.dlq
# Mensaje visible para revisión manual
```

---

## 9. Seguridad

### 9.1 Mecanismo de Autenticación OAuth2 + JWT

**Flujo OAuth2 Client Credentials**:

```plantuml
@startuml
title Flujo OAuth2 Client Credentials + JWT

actor Cliente
participant "Auth Service" as Auth
participant "Resource Service\n(Order/Inventory/etc)" as Resource

Cliente -> Auth: 1. POST /token\nclient_id\nclient_secret
Auth -> Auth: 2. Validate Credentials\n(DB)
Auth --> Cliente: 3. access_token (JWT)

Cliente -> Resource: 4. GET /orders\nBearer <JWT>
Resource -> Resource: 5. Verify JWT\n(signature + exp)
Resource -> Resource: 6. Check Redis\n(blacklist)
Resource --> Cliente: 7. Response\n{orders: [...]}

@enduml
```

**Estructura del JWT**:

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "client_id": "integrahub-portal",
    "scopes": ["orders:read", "orders:write", "inventory:read"],
    "iss": "integrahub-auth",
    "iat": 1737486000,
    "exp": 1737489600,
    "jti": "uuid-unique-token-id"
  },
  "signature": "..."
}
```

**Componentes de Seguridad**:

1. **Secret Key**: `JWT_SECRET` en variables de entorno
2. **Issuer**: `integrahub-auth`
3. **TTL**: 3600 segundos (1 hora)
4. **Algoritmo**: HS256 (HMAC-SHA256)

### 9.2 Control de Acceso (Scopes)

**Scopes Disponibles**:

| Scope | Descripción | Servicios Afectados |
|-------|-------------|---------------------|
| `orders:read` | Consultar pedidos | Order Service |
| `orders:write` | Crear/modificar pedidos | Order Service |
| `inventory:read` | Consultar inventario | Inventory Service |
| `inventory:write` | Modificar stock | Inventory Service |
| `payments:read` | Consultar pagos | Payment Service |
| `admin:*` | Acceso total | Todos |

**Implementación de Middleware**:

```javascript
// auth.middleware.js
function requireScopes(...requiredScopes) {
  return (req, res, next) => {
    if (!req.user || !req.user.scopes) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Insufficient permissions'
      });
    }

    const hasScope = requiredScopes.some(
      scope => req.user.scopes.includes(scope)
    );
    
    if (!hasScope) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Required scopes: ${requiredScopes.join(', ')}`
      });
    }

    next();
  };
}

// Uso en rutas
router.post('/orders', 
  authenticateToken,
  requireScopes('orders:write'),
  createOrder
);

router.get('/orders', 
  authenticateToken,
  requireScopes('orders:read'),
  listOrders
);
```

### 9.3 Evidencias: Token Válido vs Inválido

#### ✅ Caso 1: Token Válido

**Request**:
```bash
curl -X GET http://localhost:3001/api/orders \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response**:
```json
{
  "orders": [
    {
      "id": "ord-001",
      "customerId": "cust-001",
      "status": "confirmed",
      "total": 299.99
    }
  ]
}
```

**Logs**:
```
[INFO] JWT verified successfully for client: integrahub-portal
[INFO] User has required scopes: orders:read
[DEBUG] Fetching orders for authenticated client
```

#### ❌ Caso 2: Token Ausente

**Request**:
```bash
curl -X GET http://localhost:3001/api/orders
```

**Response** (401 Unauthorized):
```json
{
  "error": "unauthorized",
  "message": "Missing or invalid authorization header"
}
```

#### ❌ Caso 3: Token Expirado

**Request**:
```bash
curl -X GET http://localhost:3001/api/orders \
  -H "Authorization: Bearer <expired_token>"
```

**Response** (401 Unauthorized):
```json
{
  "error": "unauthorized",
  "message": "jwt expired"
}
```

**Logs**:
```
[WARN] JWT verification failed: jwt expired
[INFO] Rejected request from IP: 192.168.1.100
```

#### ❌ Caso 4: Token Inválido (Firma Incorrecta)

**Request**:
```bash
curl -X GET http://localhost:3001/api/orders \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp..."
```

**Response** (401 Unauthorized):
```json
{
  "error": "unauthorized",
  "message": "invalid signature"
}
```

#### ❌ Caso 5: Scopes Insuficientes

**Request**:
```bash
# Token con scope 'orders:read' intentando escribir
curl -X POST http://localhost:3001/api/orders \
  -H "Authorization: Bearer <token_con_solo_read>" \
  -d '{...}'
```

**Response** (403 Forbidden):
```json
{
  "error": "forbidden",
  "message": "Required scopes: orders:write"
}
```

**Logs**:
```
[WARN] Access denied: Missing required scope 'orders:write'
[INFO] Client 'integrahub-portal' has scopes: ['orders:read']
```

#### ❌ Caso 6: Token Revocado (Blacklist)

**Request**:
```bash
curl -X GET http://localhost:3001/api/orders \
  -H "Authorization: Bearer <revoked_token>"
```

**Response** (401 Unauthorized):
```json
{
  "error": "unauthorized",
  "message": "Token has been revoked"
}
```

**Logs**:
```
[WARN] Token found in blacklist: jti=abc-123-xyz
[INFO] Request rejected: Revoked token
```

---

## 10. Gobierno y Contratos

### 10.1 Documentación OpenAPI / Swagger

Cada servicio expone su documentación OpenAPI 3.0 en el endpoint `/api-docs`.

**URLs de Documentación**:

| Servicio | Swagger UI |
|----------|------------|
| Auth Service | http://localhost:3000/api-docs |
| Order Service | http://localhost:3001/api-docs |
| Inventory Service | http://localhost:3002/api-docs |
| Payment Service | http://localhost:3003/api-docs |
| Notification Service | http://localhost:3004/api-docs |
| Analytics Service | http://localhost:3005/api-docs |

**Ejemplo OpenAPI Spec (Order Service)**:

```yaml
openapi: 3.0.0
info:
  title: IntegraHub Order Service API
  version: 1.0.0
  description: API para gestión de pedidos en IntegraHub

servers:
  - url: http://localhost:3001
    description: Development server

paths:
  /api/orders:
    post:
      summary: Crear nuevo pedido
      tags:
        - Orders
      security:
        - bearerAuth: []
      parameters:
        - in: header
          name: Idempotency-Key
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        '201':
          description: Pedido creado exitosamente
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  schemas:
    CreateOrderRequest:
      type: object
      required:
        - customerId
        - items
      properties:
        customerId:
          type: string
          example: "cust-001"
        customerEmail:
          type: string
          format: email
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
    
    Order:
      type: object
      properties:
        id:
          type: string
        status:
          type: string
          enum: [pending, confirmed, rejected]
        total:
          type: number
        createdAt:
          type: string
          format: date-time

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### 10.2 Colección Postman

**Archivo**: [postman/IntegraHub.postman_collection.json](postman/IntegraHub.postman_collection.json)

**Estructura de la Colección**:

```
IntegraHub API Collection
├── 1. Authentication
│   ├── Get Access Token (Client Credentials)
│   └── Verify Token
├── 2. Orders
│   ├── Create Order
│   ├── Get Order by ID
│   ├── List Orders
│   └── Cancel Order
├── 3. Inventory
│   ├── Get Product Stock
│   ├── Update Stock
│   └── List Low Stock Products
├── 4. Payments
│   ├── Get Payment Status
│   └── List Payments
├── 5. Notifications
│   ├── Get Notification History
│   └── Resend Notification
├── 6. Analytics
│   ├── Get Realtime Metrics
│   └── Get Sales Report
└── 7. Health Checks
    ├── Check All Services
    └── System Status
```

**Variables de Entorno**:

```json
{
  "base_url": "http://localhost",
  "auth_url": "http://localhost:3000",
  "order_url": "http://localhost:3001",
  "inventory_url": "http://localhost:3002",
  "payment_url": "http://localhost:3003",
  "client_id": "integrahub-client",
  "client_secret": "integrahub-secret",
  "access_token": "{{access_token}}"
}
```

**Pre-request Script (Obtener Token Automático)**:

```javascript
// Pre-request script en Collection
if (!pm.environment.get('access_token')) {
  pm.sendRequest({
    url: pm.environment.get('auth_url') + '/auth/token',
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: pm.environment.get('client_id'),
        client_secret: pm.environment.get('client_secret')
      })
    }
  }, (err, res) => {
    pm.environment.set('access_token', res.json().access_token);
  });
}
```

### 10.3 Estrategia de Versionado

**Enfoque**: **URL Path Versioning** (Versionado en la URL)

**Razones**:
- ✅ Claridad: Versión visible en la URL
- ✅ Fácil testeo: Múltiples versiones corriendo simultáneamente
- ✅ Caching: CDNs pueden cachear por versión
- ✅ Documentación: Swagger UI separado por versión

**Estructura de URLs**:

```
http://localhost:3001/api/v1/orders
http://localhost:3001/api/v2/orders  (futuro)
```

**Reglas de Versionado**:

| Cambio | Requiere Nueva Versión | Ejemplo |
|--------|------------------------|---------|
| Agregar campo opcional | ❌ No | Agregar `notes` a Order |
| Agregar endpoint nuevo | ❌ No | POST `/orders/bulk` |
| Cambiar tipo de campo | ✅ Sí | `total: string` → `total: number` |
| Eliminar campo | ✅ Sí | Remover `customerId` |
| Cambiar comportamiento | ✅ Sí | Cambiar lógica de validación |

**Deprecation Policy**:

```
v1 Released → v2 Released → v1 Deprecated → v1 Sunset
    │              │              │              │
    └─────────────┬┘              │              │
               6 months       6 months      EOL
                               warning
```

**Headers de Deprecation**:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 21 Jul 2026 00:00:00 GMT
Link: <http://localhost:3001/api/v2/orders>; rel="successor-version"
```

**Implementación**:

```javascript
// routes/v1/orders.routes.js
const express = require('express');
const router = express.Router();

router.use((req, res, next) => {
  res.set('API-Version', 'v1');
  // res.set('Deprecation', 'true');  // Si está deprecado
  next();
});

router.post('/', createOrder);
router.get('/:id', getOrder);

module.exports = router;

// index.js
app.use('/api/v1/orders', require('./routes/v1/orders.routes'));
app.use('/api/v2/orders', require('./routes/v2/orders.routes'));  // Futuro
```

---

## 11. Demo Portal

### 11.1 Funcionalidades Implementadas

El **Demo Portal** es una aplicación web SPA (Single Page Application) que demuestra el flujo completo de IntegraHub.

**URL**: http://localhost:8080

**Características**:

#### Crear Pedidos
- Formulario para ingresar datos del cliente
- Agregar múltiples productos al carrito
- Cálculo automático de total
- Generación automática de Idempotency-Key
- Visualización de Correlation-ID en respuesta

#### Visualizar Estado de Pedidos
- Lista de pedidos creados
- Estados: `pending`, `confirmed`, `rejected`
- Actualización automática cada 5 segundos
- Detalle de items del pedido

#### Autenticación Automática
- Obtención automática de JWT al cargar la página
- Refresh automático cuando expira
- Indicador visual de estado de autenticación

#### System Health Check
- Dashboard de estado de todos los servicios
- Indicadores verde (healthy) / rojo (down)
- Latencia de cada servicio
- Refresh manual y automático

#### Trazabilidad
- Correlation ID en cada request
- Logs en consola del navegador
- Seguimiento end-to-end en logs del servidor

**Screenshots Simulados**:

```
┌────────────────────────────────────────────────────────────────┐
│                      IntegraHub Portal                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔐 Authenticated as: integrahub-portal                         │
│  🆔 Session Correlation ID: abc-123-xyz                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              CREATE NEW ORDER                             │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ Customer ID:  [cust-001              ]                    │ │
│  │ Email:        [customer@email.com    ]                    │ │
│  │                                                            │ │
│  │ Products:                                                  │ │
│  │ ┌─────────┬───────────┬─────────┬────────┬────────┐       │ │
│  │ │ Product │ Name      │ Qty     │ Price  │ Total  │       │ │
│  │ ├─────────┼───────────┼─────────┼────────┼────────┤       │ │
│  │ │ PRD001  │ Laptop    │    2    │ 999.99 │ 1999.98│       │ │
│  │ │ PRD002  │ Mouse     │    1    │  29.99 │   29.99│       │ │
│  │ └─────────┴───────────┴─────────┴────────┴────────┘       │ │
│  │                                   Total:  $2,029.97        │ │
│  │                                                            │ │
│  │                      [Submit Order]                        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              RECENT ORDERS                                │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ Order ID    Status      Total      Created               │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ ord-001     ✅ confirmed  $2,029.97  2026-01-21 10:30     │ │
│  │ ord-002     ⏳ pending    $  599.99  2026-01-21 10:45     │ │
│  │ ord-003     ❌ rejected   $1,499.00  2026-01-21 11:00     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 11.2 Trazabilidad (Order-ID / Correlation-ID)

**Propagación de Correlation ID**:

```plantuml
@startuml
title Propagación de Correlation ID

participant Browser
participant "API Gateway" as Gateway
participant "Auth Service" as Auth
participant "Order Service" as Order
queue RabbitMQ
participant "Payment Service" as Payment

note over Browser, Payment
  Mismo x-correlation-id: abc-123-xyz en todos los logs
end note

Browser -> Gateway: Request
Gateway -> Auth: Forward
Auth -> Order: Forward
Order -> RabbitMQ: Event
RabbitMQ -> Payment: Consume

@enduml
```

**Ejemplo de Logs Correlacionados**:

```bash
# Portal (Browser Console)
[INFO] Creating order with correlation-id: abc-123-xyz

# API Gateway (Nginx)
192.168.1.100 - [21/Jan/2026] "POST /api/orders" abc-123-xyz

# Order Service
[INFO] [abc-123-xyz] Received create order request
[DEBUG] [abc-123-xyz] Validating order data
[INFO] [abc-123-xyz] Order created: ord-001
[DEBUG] [abc-123-xyz] Publishing event: order.created

# Inventory Service
[INFO] [abc-123-xyz] Consumed event: order.created
[DEBUG] [abc-123-xyz] Reserving stock for ord-001

# Payment Service
[INFO] [abc-123-xyz] Consumed event: inventory.reserved
[DEBUG] [abc-123-xyz] Processing payment for ord-001
[INFO] [abc-123-xyz] Payment completed successfully

# Notification Service
[INFO] [abc-123-xyz] Sending confirmation email for ord-001
```

**Beneficios de Trazabilidad**:
- 🔍 **Debugging**: Seguir una transacción específica en todos los servicios
- 📊 **Métricas**: Medir latencia end-to-end
- 🐛 **Troubleshooting**: Identificar dónde falló una transacción
- 📈 **Auditoría**: Compliance y seguimiento regulatorio

### 11.3 System Status / Health Check

**Dashboard de Health**:

```
┌─────────────────────────────────────────────────────────────┐
│                  SYSTEM HEALTH STATUS                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Service              Status    Latency    Last Check       │
│  ───────────────────  ────────  ─────────  ────────────     │
│  🟢 Auth Service       Healthy    12ms     10:45:30         │
│  🟢 Order Service      Healthy    45ms     10:45:30         │
│  🟢 Inventory Service  Healthy    38ms     10:45:30         │
│  🟢 Payment Service    Healthy    102ms    10:45:30         │
│  🟢 Notification Svc   Healthy    25ms     10:45:30         │
│  🟢 Analytics Service  Healthy    67ms     10:45:30         │
│  ───────────────────────────────────────────────────────    │
│  🟢 PostgreSQL         Healthy    8ms      10:45:30         │
│  🟢 RabbitMQ           Healthy    15ms     10:45:30         │
│  🟢 Redis              Healthy    2ms      10:45:30         │
│  🟢 Kafka              Healthy    22ms     10:45:30         │
│                                                              │
│  Overall Status: 🟢 ALL SYSTEMS OPERATIONAL                 │
│                                                              │
│  [Refresh]                     Auto-refresh: ON (30s)       │
└─────────────────────────────────────────────────────────────┘
```

**Endpoint de Health Check**:

```javascript
// GET /health
{
  "status": "healthy",
  "service": "order-service",
  "version": "1.0.0",
  "uptime": 3600,
  "timestamp": "2026-01-21T10:45:30Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 8
    },
    "rabbitmq": {
      "status": "healthy",
      "latency": 15
    },
    "redis": {
      "status": "healthy",
      "latency": 2
    }
  }
}
```

---

## 12. Despliegue

### 12.1 Docker Compose

**Archivo**: [docker-compose.yml](docker-compose.yml)

**Servicios Definidos**:

```yaml
version: '3.8'

services:
  # Infrastructure
  postgres:          # PostgreSQL Database
  redis:             # Cache & Idempotency
  rabbitmq:          # Message Broker
  zookeeper:         # Kafka dependency
  kafka:             # Event Streaming
  
  # Application Services
  auth-service:      # OAuth2 + JWT
  order-service:     # Order Management
  inventory-service: # Stock Control
  payment-service:   # Payment Processing
  notification-service: # Notifications
  analytics-service: # Analytics & ETL
  legacy-processor:  # CSV File Processor
  
  # Frontend & Gateway
  api-gateway:       # Nginx Reverse Proxy
  portal:            # Web Portal
  
  # Monitoring
  kafka-ui:          # Kafka Management UI
```

**Volúmenes Persistentes**:

```yaml
volumes:
  postgres_data:     # Datos de PostgreSQL
  rabbitmq_data:     # Configuración y mensajes RabbitMQ
  redis_data:        # Snapshots de Redis
```

**Red Privada**:

```yaml
networks:
  integrahub-network:
    driver: bridge
```

### 12.2 Variables de Entorno

**Archivo**: `.env.example` (copiar a `.env`)

```bash
# ========================================
# DATABASE
# ========================================
POSTGRES_USER=integrahub
POSTGRES_PASSWORD=integrahub123
POSTGRES_DB=integrahub
DATABASE_URL=postgresql://integrahub:integrahub123@postgres:5432/integrahub

# ========================================
# MESSAGE BROKER
# ========================================
RABBITMQ_USER=admin
RABBITMQ_PASS=admin123
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672

# ========================================
# CACHE
# ========================================
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379

# ========================================
# STREAMING
# ========================================
KAFKA_BROKER=kafka:9092

# ========================================
# SECURITY
# ========================================
JWT_SECRET=supersecretkey123!
JWT_EXPIRATION=3600

# ========================================
# SERVICES
# ========================================
AUTH_SERVICE_URL=http://auth-service:3000
ORDER_SERVICE_URL=http://order-service:3001
INVENTORY_SERVICE_URL=http://inventory-service:3002
PAYMENT_SERVICE_URL=http://payment-service:3003

# ========================================
# RESILIENCE
# ========================================
REQUEST_TIMEOUT=5000
RETRY_ATTEMPTS=3
RETRY_DELAY=1000
CIRCUIT_BREAKER_THRESHOLD=50
CIRCUIT_BREAKER_TIMEOUT=30000

# ========================================
# LOGGING
# ========================================
LOG_LEVEL=debug
NODE_ENV=development
```

### 12.3 Pasos para Levantar el Sistema

#### ✅ Prerequisitos

1. **Docker Desktop** instalado y corriendo
   ```bash
   docker --version
   # Docker version 24.0.x o superior
   ```

2. **Docker Compose** instalado
   ```bash
   docker-compose --version
   # Docker Compose version v2.x o superior
   ```

3. **Recursos mínimos**:
   - RAM: 8GB disponible
   - Disk: 10GB libre
   - CPU: 4 cores recomendado

#### 📋 Instalación Paso a Paso

**Paso 1: Clonar el Repositorio**

```bash
git clone https://github.com/your-org/integrahub.git
cd integrahub
```

**Paso 2: Configurar Variables de Entorno**

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env

# Editar .env si es necesario
notepad .env  # Windows
nano .env     # Linux/Mac
```

**Paso 3: Levantar Infraestructura**

```bash
docker-compose up -d
```

**Salida Esperada**:

```
[+] Running 19/19
 ✔ Network integrahub_integrahub-network   Created
 ✔ Volume integrahub_postgres_data         Created
 ✔ Volume integrahub_rabbitmq_data         Created
 ✔ Volume integrahub_redis_data            Created
 ✔ Container integrahub-postgres           Healthy
 ✔ Container integrahub-redis              Healthy
 ✔ Container integrahub-rabbitmq           Healthy
 ✔ Container integrahub-zookeeper          Started
 ✔ Container integrahub-kafka              Healthy
 ✔ Container integrahub-auth               Healthy
 ✔ Container integrahub-inventory          Healthy
 ✔ Container integrahub-payments           Healthy
 ✔ Container integrahub-notifications      Healthy
 ✔ Container integrahub-orders             Healthy
 ✔ Container integrahub-analytics          Healthy
 ✔ Container integrahub-legacy             Started
 ✔ Container integrahub-kafka-ui           Started
 ✔ Container integrahub-gateway            Started
 ✔ Container integrahub-portal             Started
```

**Paso 4: Verificar Estado**

```bash
docker-compose ps
```

Todos los servicios deben mostrar estado `Up` o `Healthy`.

**Paso 5: Verificar Health Checks**

```bash
# PowerShell
curl http://localhost:3000/health  # Auth
curl http://localhost:3001/health  # Orders
curl http://localhost:3002/health  # Inventory

# O abrir en navegador
start http://localhost:8080
```

**Paso 6: Ver Logs (Opcional)**

```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f order-service

# Últimas 100 líneas
docker-compose logs --tail=100 order-service
```

#### 🛑 Detener el Sistema

```bash
# Detener sin eliminar datos
docker-compose stop

# Detener y eliminar contenedores (datos persisten)
docker-compose down

# Detener y eliminar TODO (incluye volúmenes)
docker-compose down -v
```

#### 🔄 Reiniciar un Servicio

```bash
# Reiniciar servicio específico
docker-compose restart order-service

# Reconstruir imagen y reiniciar
docker-compose up -d --build order-service
```

#### 🐛 Troubleshooting

**Problema: Puerto en Uso**

```bash
# Ver qué proceso usa el puerto
netstat -ano | findstr :3000

# O en PowerShell
Get-NetTCPConnection -LocalPort 3000

# Solución: Cambiar puerto en docker-compose.yml
ports:
  - "3010:3000"  # Puerto externo:Puerto interno
```

**Problema: Servicios No Inician**

```bash
# Ver logs completos
docker-compose logs order-service

# Verificar recursos
docker stats

# Reiniciar Docker Desktop
# Restart Docker Desktop application
```

**Problema: Kafka No Conecta**

```bash
# Esperar 30-60 segundos después de docker-compose up
# Verificar Zookeeper está corriendo
docker-compose logs zookeeper

# Reiniciar Kafka
docker-compose restart kafka
```

---

## 13. Evidencias

### 13.1 Capturas de UI

#### Portal Principal

```
┌────────────────────────────────────────────────────────────────┐
│  IntegraHub - Order-to-Cash Platform                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [New Order]  [View Orders]  [System Status]  [Analytics]     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  CREATE ORDER                                             │ │
│  │  Customer: John Doe                                       │ │
│  │  Email: john@example.com                                  │ │
│  │  Items: 3 products                                        │ │
│  │  Total: $1,249.97                                         │ │
│  │                                                            │ │
│  │  [Submit Order]                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Recent Orders:                                                │
│  • ord-001 - Confirmed - $1,249.97 - 10:30 AM                 │
│  • ord-002 - Pending - $599.99 - 10:45 AM                     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### RabbitMQ Management UI

**URL**: http://localhost:15672  
**Credenciales**: admin / admin123

```
Queues:
  order.process         3 messages ready    1 consumer
  payment.process       0 messages ready    1 consumer
  notification.email    1 message ready     1 consumer
  orders.dlq           0 messages ready     0 consumers

Exchanges:
  order.events (topic)       Bindings: 3
  notification.fanout        Bindings: 2
```

#### Kafka UI

**URL**: http://localhost:8090

```
Topics:
  order-events          Partitions: 3    Messages: 1,234
  payment-events        Partitions: 3    Messages: 897
  
Consumer Groups:
  analytics-group       Lag: 0           Status: Active
```

### 13.2 Logs Relevantes

#### Log de Creación de Pedido Exitoso

```log
[2026-01-21 10:45:23] INFO  [abc-123-xyz] [order-service] Received POST /api/orders
[2026-01-21 10:45:23] DEBUG [abc-123-xyz] [order-service] Validating JWT token
[2026-01-21 10:45:23] INFO  [abc-123-xyz] [order-service] Token valid for client: integrahub-portal
[2026-01-21 10:45:23] DEBUG [abc-123-xyz] [order-service] Checking idempotency key: key-456
[2026-01-21 10:45:23] DEBUG [abc-123-xyz] [order-service] Idempotency check: PASS (not duplicate)
[2026-01-21 10:45:23] INFO  [abc-123-xyz] [order-service] Creating order for customer: cust-001
[2026-01-21 10:45:23] DEBUG [abc-123-xyz] [order-service] Inserting order into PostgreSQL
[2026-01-21 10:45:23] INFO  [abc-123-xyz] [order-service] Order created: ord-001
[2026-01-21 10:45:23] DEBUG [abc-123-xyz] [order-service] Publishing event: order.created to RabbitMQ
[2026-01-21 10:45:23] INFO  [abc-123-xyz] [order-service] Event published successfully
[2026-01-21 10:45:23] INFO  [abc-123-xyz] [order-service] Storing idempotency result in Redis
[2026-01-21 10:45:23] INFO  [abc-123-xyz] [order-service] Response 201: Order ord-001 created

[2026-01-21 10:45:24] INFO  [abc-123-xyz] [inventory-service] Consumed event: order.created
[2026-01-21 10:45:24] DEBUG [abc-123-xyz] [inventory-service] Checking stock for 3 items
[2026-01-21 10:45:24] INFO  [abc-123-xyz] [inventory-service] Stock available for all items
[2026-01-21 10:45:24] DEBUG [abc-123-xyz] [inventory-service] Reserving stock for order ord-001
[2026-01-21 10:45:24] INFO  [abc-123-xyz] [inventory-service] Stock reserved successfully
[2026-01-21 10:45:24] DEBUG [abc-123-xyz] [inventory-service] Publishing event: inventory.reserved

[2026-01-21 10:45:25] INFO  [abc-123-xyz] [payment-service] Consumed event: inventory.reserved
[2026-01-21 10:45:25] DEBUG [abc-123-xyz] [payment-service] Processing payment for order ord-001
[2026-01-21 10:45:25] INFO  [abc-123-xyz] [payment-service] Payment gateway called (simulated)
[2026-01-21 10:45:27] INFO  [abc-123-xyz] [payment-service] Payment completed: txn-789
[2026-01-21 10:45:27] DEBUG [abc-123-xyz] [payment-service] Publishing event: payment.completed

[2026-01-21 10:45:28] INFO  [abc-123-xyz] [notification-service] Consumed event: payment.completed
[2026-01-21 10:45:28] DEBUG [abc-123-xyz] [notification-service] Sending email to: customer@example.com
[2026-01-21 10:45:29] INFO  [abc-123-xyz] [notification-service] Email sent successfully
```

#### Log de Circuit Breaker Activado

```log
[2026-01-21 11:15:00] WARN  [def-456-uvw] [order-service] Payment service timeout (5000ms exceeded)
[2026-01-21 11:15:05] WARN  [ghi-789-xyz] [order-service] Payment service timeout (5000ms exceeded)
[2026-01-21 11:15:10] ERROR [jkl-012-abc] [order-service] Circuit breaker threshold reached (50%)
[2026-01-21 11:15:10] ERROR [jkl-012-abc] [order-service] Circuit breaker state: CLOSED → OPEN
[2026-01-21 11:15:10] WARN  [jkl-012-abc] [order-service] Rejecting requests to payment-service
[2026-01-21 11:15:10] INFO  [jkl-012-abc] [order-service] Fallback executed: Payment queued
[2026-01-21 11:15:40] INFO  [mno-345-def] [order-service] Circuit breaker state: OPEN → HALF_OPEN
[2026-01-21 11:15:41] INFO  [mno-345-def] [order-service] Test request to payment-service: SUCCESS
[2026-01-21 11:15:41] INFO  [mno-345-def] [order-service] Circuit breaker state: HALF_OPEN → CLOSED
```

#### Log de Mensaje Enviado a DLQ

```log
[2026-01-21 12:00:00] INFO  [pqr-678-stu] [inventory-service] Consumed message: msg-001
[2026-01-21 12:00:00] ERROR [pqr-678-stu] [inventory-service] Invalid message format: Missing field 'orderId'
[2026-01-21 12:00:00] WARN  [pqr-678-stu] [inventory-service] Retry attempt 1/3
[2026-01-21 12:00:01] ERROR [pqr-678-stu] [inventory-service] Invalid message format: Missing field 'orderId'
[2026-01-21 12:00:01] WARN  [pqr-678-stu] [inventory-service] Retry attempt 2/3
[2026-01-21 12:00:03] ERROR [pqr-678-stu] [inventory-service] Invalid message format: Missing field 'orderId'
[2026-01-21 12:00:03] WARN  [pqr-678-stu] [inventory-service] Retry attempt 3/3
[2026-01-21 12:00:03] ERROR [pqr-678-stu] [inventory-service] Max retries exceeded
[2026-01-21 12:00:03] WARN  [pqr-678-stu] [inventory-service] Sending message to DLQ: inventory.dlq
```

### 13.3 UI de Mensajería

#### RabbitMQ - Cola de Pedidos

```
Queue: order.process
Messages: 5
Consumers: 1
Message rate: 2.3/s

Recent Messages:
┌────────────┬─────────────────────────┬──────────┬───────────────┐
│ Message ID │ Routing Key             │ Size     │ Timestamp     │
├────────────┼─────────────────────────┼──────────┼───────────────┤
│ msg-001    │ order.created           │ 512 B    │ 10:45:23      │
│ msg-002    │ inventory.reserved      │ 324 B    │ 10:45:24      │
│ msg-003    │ payment.completed       │ 456 B    │ 10:45:27      │
└────────────┴─────────────────────────┴──────────┴───────────────┘
```

#### Kafka - Topic de Analítica

```
Topic: order-events
Partitions: 3
Replication Factor: 1
Total Messages: 1,234

Partition 0: 412 messages (offset: 0-411)
Partition 1: 398 messages (offset: 0-397)
Partition 2: 424 messages (offset: 0-423)

Consumer Group: analytics-group
  Status: Active
  Lag: 0 messages
  Members: 1 consumer
```

### 13.4 Analítica Visible

#### Dashboard de Métricas

```json
{
  "realtime_metrics": {
    "timestamp": "2026-01-21T16:45:00Z",
    "orders": {
      "total_today": 156,
      "confirmed": 142,
      "pending": 12,
      "rejected": 2,
      "last_hour": 18
    },
    "revenue": {
      "total_today": 45678.90,
      "average_order_value": 292.81,
      "last_hour": 5234.50
    },
    "products": {
      "top_selling": [
        { "id": "PRD001", "name": "Laptop Dell", "quantity": 45 },
        { "id": "PRD002", "name": "Mouse Logitech", "quantity": 38 },
        { "id": "PRD003", "name": "Keyboard", "quantity": 29 }
      ],
      "low_stock": [
        { "id": "PRD010", "name": "Monitor", "stock": 5 }
      ]
    },
    "performance": {
      "avg_processing_time_ms": 342,
      "success_rate": 98.7,
      "payment_success_rate": 99.1
    }
  }
}
```

**Visualización**:

```
┌──────────────────────────────────────────────────────────────┐
│              REAL-TIME ANALYTICS DASHBOARD                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 Orders Today: 156        💰 Revenue: $45,678.90          │
│  ✅ Success Rate: 98.7%      ⏱️  Avg Time: 342ms             │
│                                                               │
│  Top Products (Today):                                       │
│  1. Laptop Dell       - 45 units                             │
│  2. Mouse Logitech    - 38 units                             │
│  3. Keyboard Mecánico - 29 units                             │
│                                                               │
│  🔴 Low Stock Alert:                                         │
│  • Monitor Samsung - Only 5 units left                       │
│                                                               │
│  Orders per Hour (Last 6h):                                  │
│  11AM ▓▓▓▓▓▓▓▓▓▓ 15                                          │
│  12PM ▓▓▓▓▓▓▓▓▓▓▓▓▓ 22                                       │
│  1PM  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 28                                     │
│  2PM  ▓▓▓▓▓▓▓▓▓▓▓▓ 20                                        │
│  3PM  ▓▓▓▓▓▓▓▓ 12                                            │
│  4PM  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 18                                   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 14. Conclusiones y Lecciones Aprendidas

### 14.1 Qué Funcionó Bien

#### Arquitectura de Microservicios

**Logro**: Servicios completamente independientes que pueden desplegarse, escalarse y fallar de forma aislada.

**Evidencia**:
- Cada servicio tiene su propia base de datos (Database per Service)
- Circuit breakers previenen cascading failures
- Un servicio caído no afecta a otros (degradación graceful)

**Beneficio**: Facilita mantenimiento, testing y deployment independiente.

#### Comunicación Asíncrona con RabbitMQ

**Logro**: Desacoplamiento total entre servicios mediante eventos.

**Evidencia**:
- Order Service no conoce directamente a Payment Service
- Fácil agregar nuevos suscriptores sin modificar código
- Mensajes persistentes previenen pérdida de datos

**Beneficio**: Escalabilidad y tolerancia a fallos.

#### Resiliencia (Circuit Breaker + Retry + DLQ)

**Logro**: Sistema sigue funcionando parcialmente incluso con servicios caídos.

**Evidencia**:
- Circuit breaker protege contra timeouts repetidos
- Reintentos automáticos recuperan de fallos transitorios
- DLQ captura mensajes problemáticos para análisis

**Beneficio**: Mayor disponibilidad y mejor experiencia de usuario.

#### Idempotencia con Redis

**Logro**: Prevención efectiva de procesamiento duplicado.

**Evidencia**:
- Requests duplicados retornan el mismo resultado (200 OK)
- No se crean pedidos duplicados en caso de retry del cliente
- Mensajes RabbitMQ no se reprocesar

**Beneficio**: Integridad de datos garantizada.

#### Trazabilidad con Correlation IDs

**Logro**: Debugging simplificado mediante seguimiento end-to-end.

**Evidencia**:
- Un solo grep en logs con correlation-id muestra todo el flujo
- Identificación rápida de cuellos de botella
- Métricas de latencia por servicio

**Beneficio**: Reducción dramática en tiempo de troubleshooting.

#### Docker Compose para Deployment

**Logro**: Sistema completo levantado con un solo comando.

**Evidencia**:
- `docker-compose up -d` levanta 15 contenedores
- Entorno reproducible en cualquier máquina
- Networking automático entre servicios

**Beneficio**: Onboarding rápido de nuevos desarrolladores.

### 14.2 Dificultades Encontradas

#### Complejidad de RabbitMQ

**Problema**: Configurar exchanges, queues y bindings correctamente fue desafiante.

**Obstáculo**:
- Diferencias entre Direct, Topic, Fanout y Headers exchanges
- Errores silenciosos en routing keys mal configurados
- Mensajes que se pierden sin error visible

**Solución Aplicada**:
- Usar archivo `definitions.json` para configuración declarativa
- Pruebas exhaustivas con RabbitMQ Management UI
- Logging detallado de publicación y consumo

**Lección**: Usar herramientas visuales (Management UI) para validar configuración.

#### Timing de Inicialización

**Problema**: Servicios intentaban conectar a DB/RabbitMQ antes de que estuvieran listos.

**Obstáculo**:
- PostgreSQL toma 10-15 segundos en iniciar
- RabbitMQ toma 20-30 segundos
- Servicios fallaban al arrancar

**Solución Aplicada**:
```yaml
depends_on:
  postgres:
    condition: service_healthy
healthcheck:
  test: ["CMD-SHELL", "pg_isready"]
  interval: 10s
```

**Lección**: Usar `depends_on` con `healthcheck` en Docker Compose.

#### Kafka Complejidad

**Problema**: Kafka requiere Zookeeper y configuración avanzada.

**Obstáculo**:
- Advertised listeners confusos (interno vs externo)
- Zookeeper como dependencia adicional
- Mayor footprint de recursos

**Solución Aplicada**:
- Limitar uso de Kafka solo a analítica (no mensajería general)
- Documentación clara de configuración

**Lección**: Kafka es overkill para comunicación entre servicios; RabbitMQ es más simple.

#### Manejo de Errores en Streams

**Problema**: Errores en consumers asíncronos son difíciles de debuggear.

**Obstáculo**:
- Excepciones no capturadas crashean el consumer
- No hay stack trace visible
- Mensajes se pierden silenciosamente

**Solución Aplicada**:
```javascript
channel.consume('queue', async (msg) => {
  try {
    await processMessage(msg);
    channel.ack(msg);
  } catch (error) {
    logger.error('Consumer error:', error);
    channel.nack(msg, false, true);  // Requeue
  }
});
```

**Lección**: Siempre envolver consumers en try/catch y usar `nack` con requeue.

#### Testing de Escenarios de Fallo

**Problema**: Difícil simular fallos de red, timeouts, etc.

**Obstáculo**:
- No hay herramienta simple para inyectar latencia
- Detener servicios manualmente es tedioso
- Timing preciso es difícil de reproducir

**Solución Aplicada**:
```javascript
// Middleware de simulación de fallo
if (process.env.SIMULATE_FAILURE === 'true') {
  await new Promise(resolve => setTimeout(resolve, 10000));
  throw new Error('Simulated failure');
}
```

**Lección**: Incluir flags de simulación de fallos en código para testing.

### 14.3 Aprendizajes Clave

#### 🎓 Patrones de Integración Son Esenciales

**Aprendizaje**: Los patrones no son teoría abstracta, resuelven problemas reales.

**Aplicación**:
- **Idempotent Consumer** previno duplicados en producción
- **Circuit Breaker** salvó el sistema de cascading failures
- **Dead Letter Queue** capturó errores para análisis posterior

**Takeaway**: Estudiar y aplicar patrones desde el inicio, no como afterthought.

#### 🎓 Observabilidad > Funcionalidad

**Aprendizaje**: Un sistema sin logs/métricas es imposible de operar.

**Aplicación**:
- Correlation IDs fueron críticos para debugging
- Health checks permitieron detectar problemas proactivamente
- Logs estructurados facilitaron análisis

**Takeaway**: Invertir en observabilidad desde día 1.

#### 🎓 Simplicidad > Perfección

**Aprendizaje**: Una solución simple que funciona > solución perfecta que no termina.

**Aplicación**:
- Docker Compose suficiente (no necesitamos Kubernetes aún)
- Node.js para todo (evitamos complejidad de polyglot)
- PostgreSQL única DB (evitamos complejidad de múltiples engines)

**Takeaway**: Start simple, scale when needed.

#### 🎓 Async es Poder, pero con Cuidado

**Aprendizaje**: Mensajería asíncrona desacopla, pero complica debugging.

**Aplicación**:
- Beneficios claros: escalabilidad, tolerancia a fallos
- Costos: debugging más difícil, eventual consistency

**Takeaway**: Usar async para integraciones, sync para queries.

#### 🎓 Documentación Vive con Código

**Aprendizaje**: Documentación separada se desactualiza.

**Aplicación**:
- OpenAPI generado desde código
- Colección Postman como tests ejecutables
- README con instrucciones exactas

**Takeaway**: Automatizar documentación siempre que sea posible.

#### 🎓 Seguridad No es Opcional

**Aprendizaje**: Autenticación/autorización debe estar desde el inicio.

**Aplicación**:
- OAuth2/JWT en todos los servicios
- Validación de scopes
- Tokens con expiración

**Takeaway**: Security by design, no como add-on.

#### 🎓 Testing de Integración > Unit Tests

**Aprendizaje**: En sistemas distribuidos, las integraciones son donde fallan.

**Aplicación**:
- Colección Postman prueba flujo end-to-end
- Tests de health checks validan conectividad
- Simulación de fallos valida resiliencia

**Takeaway**: Priorizar tests que validen integraciones reales.

---

## 📚 Referencias

### Tecnologías Utilizadas

- **Node.js**: https://nodejs.org/
- **Express.js**: https://expressjs.com/
- **RabbitMQ**: https://www.rabbitmq.com/
- **Apache Kafka**: https://kafka.apache.org/
- **PostgreSQL**: https://www.postgresql.org/
- **Redis**: https://redis.io/
- **Docker**: https://www.docker.com/
- **Nginx**: https://nginx.org/

### Patrones y Arquitectura

- **Enterprise Integration Patterns**: Hohpe, G., & Woolf, B. (2003)
- **Microservices Patterns**: Richardson, C. (2018)
- **Building Microservices**: Newman, S. (2015)
- **C4 Model**: https://c4model.com/

### Herramientas

- **Opossum Circuit Breaker**: https://nodeshift.dev/opossum/
- **Postman**: https://www.postman.com/
- **Swagger/OpenAPI**: https://swagger.io/

---

## 📝 Metadatos del Proyecto

| Campo | Valor |
|-------|-------|
| **Proyecto** | IntegraHub - Order-to-Cash Platform |
| **Curso** | Integración de Sistemas |
| **Período** | 202610 |
| **Fecha** | Enero 2026 |
| **Arquitectura** | Microservicios + Event-Driven |
| **Servicios** | 7 microservicios + 4 infraestructura |
| **Lenguaje** | JavaScript (Node.js) |
| **Deployment** | Docker Compose |
| **LOC** | ~5,000 líneas de código |

---

**FIN DEL INFORME**

---

*Este informe documenta la implementación completa de IntegraHub, una plataforma de integración Order-to-Cash que demuestra la aplicación práctica de patrones de integración empresarial, arquitecturas de microservicios y mejores prácticas de desarrollo de software.*
