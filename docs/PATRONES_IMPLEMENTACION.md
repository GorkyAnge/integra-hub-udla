# 📋 Patrones de Integración - Implementación Detallada

## IntegraHub - Documentación de Patrones de Mensajería

Este documento detalla la implementación de cada patrón de integración empresarial en el sistema IntegraHub, incluyendo ubicación en el código, funcionamiento, flujo de datos y herramientas involucradas.

---

## 1. Point-to-Point Channel (Canal Punto a Punto)

### 📍 Dónde se Usa

- **Cola**: `order.process` 
  - **Ubicación**: `infrastructure/rabbitmq/definitions.json` (líneas 25-34)
  - **Consumidor**: `services/order-service/src/config/rabbitmq.js` (líneas 106-151)
  
- **Cola**: `payment.process`
  - **Ubicación**: `infrastructure/rabbitmq/definitions.json` (líneas 60-68)
  - **Consumidor**: `services/payment-service/src/config/rabbitmq.js` (líneas 51-71)

### 🔧 Cómo Funciona

El patrón Point-to-Point garantiza que cada mensaje sea procesado por **un solo consumidor**. En IntegraHub:

1. Los mensajes se envían a una cola dedicada
2. RabbitMQ entrega cada mensaje a exactamente un consumidor
3. El consumidor procesa el mensaje y envía un ACK (acknowledgment)
4. Si el procesamiento falla, el mensaje puede ser reencolado o enviado a DLQ

### 📊 Flujo de Datos

```
Productor (Order Service)
    ↓
[order.process Queue]
    ↓
Consumidor (Order Service) → Procesa pedido → ACK/NACK
```

**Ejemplo de código productor**:
```javascript
// services/order-service/src/config/rabbitmq.js (línea 81-104)
await publishToQueue('order.process', {
  messageId: uuidv4(),
  orderId: order.id,
  correlationId: correlationId,
  items: orderItems
});
```

**Ejemplo de código consumidor**:
```javascript
// services/order-service/src/config/rabbitmq.js (líneas 109-120)
await channel.consume('order.process', async (msg) => {
  if (msg) {
    try {
      const content = JSON.parse(msg.content.toString());
      await processOrder(content);
      channel.ack(msg); // Confirma procesamiento exitoso
    } catch (error) {
      // Lógica de reintento o envío a DLQ
      channel.nack(msg, false, false);
    }
  }
}, { noAck: false });
```

### 🛠️ Herramientas Involucradas

- **RabbitMQ**: Broker de mensajes (puerto 5672)
- **amqplib**: Librería cliente de Node.js para AMQP
- **Node.js Express**: Framework para servicios
- **PostgreSQL**: Almacenamiento persistente de pedidos

### ✅ Por Qué se Usa

- **Procesamiento secuencial garantizado**: Cada pedido se procesa en orden
- **Un solo consumidor activo**: Evita procesamiento duplicado
- **Escalabilidad vertical**: Se pueden agregar más instancias del consumidor, pero cada mensaje va a uno solo

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Orden garantizado | ❌ Load balancing básico (round-robin) |
| ✅ Sin duplicados | ❌ Throughput limitado |
| ✅ Procesamiento consistente | ❌ Single point of failure si hay un solo consumidor |

---

## 2. Publish/Subscribe (Publicar/Suscribir)

### 📍 Dónde se Usa

- **Exchange**: `notification.fanout`
  - **Ubicación**: `infrastructure/rabbitmq/definitions.json` (líneas 102-109)
  - **Tipo**: Fanout
  - **Publicador**: `services/payment-service/src/index.js` (líneas 113-121, 175-182)
  - **Suscriptores**: 
    - `notification.customer` (línea 78-82 en definitions.json)
    - `notification.operations` (línea 84-89 en definitions.json)

### 🔧 Cómo Funciona

El patrón Publish/Subscribe permite que **múltiples suscriptores** reciban el mismo mensaje:

1. Un evento se publica al exchange `notification.fanout`
2. El exchange de tipo **fanout** copia el mensaje a TODAS las colas enlazadas
3. Cada suscriptor recibe su propia copia del mensaje
4. Los suscriptores procesan el mensaje de forma independiente

### 📊 Flujo de Datos

```
Payment Service (publica OrderConfirmed/OrderRejected)
    ↓
[notification.fanout Exchange]
    ├─→ [notification.customer Queue] → Notifica al cliente
    └─→ [notification.operations Queue] → Notifica a operaciones
```

**Ejemplo de código publicador**:
```javascript
// services/payment-service/src/index.js (líneas 113-121)
await publishEvent('notification.fanout', '', {
  messageId: uuidv4(),
  eventType: 'OrderConfirmed',
  orderId,
  correlationId,
  totalAmount,
  transactionId: transactionResult.rows[0].id,
  timestamp: new Date().toISOString()
});
```

**Configuración de bindings**:
```json
// infrastructure/rabbitmq/definitions.json (líneas 155-169)
{
  "source": "notification.fanout",
  "destination": "notification.customer",
  "destination_type": "queue",
  "routing_key": ""
},
{
  "source": "notification.fanout",
  "destination": "notification.operations",
  "destination_type": "queue",
  "routing_key": ""
}
```

### 🛠️ Herramientas Involucradas

- **RabbitMQ Fanout Exchange**: Distribuye mensajes a todas las colas
- **amqplib**: Cliente AMQP
- **Payment Service**: Publicador principal
- **Notification Service**: Consumidor de notificaciones

### ✅ Por Qué se Usa

- **Notificar a múltiples servicios**: Un evento puede activar múltiples acciones
- **Desacoplamiento**: Los publicadores no conocen a los suscriptores
- **Extensibilidad**: Fácil agregar nuevos suscriptores sin modificar publicadores

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Fácil agregar suscriptores | ❌ Todos reciben todo (no hay filtrado) |
| ✅ Desacoplamiento total | ❌ Mayor carga en el broker |
| ✅ Broadcast eficiente | ❌ Dificultad para rastrear quién consume qué |

---

## 3. Message Router (Enrutador de Mensajes)

### 📍 Dónde se Usa

- **Exchange**: `order.events`
  - **Ubicación**: `infrastructure/rabbitmq/definitions.json` (líneas 92-100)
  - **Tipo**: Topic
  - **Routing Keys**:
    - `order.created` → `order.process` y `inventory.reserve`
    - `inventory.reserved` → `payment.process`
  - **Publicador**: `services/order-service/src/config/rabbitmq.js` (líneas 53-79)

### 🔧 Cómo Funciona

El Message Router dirige mensajes a diferentes destinos basándose en **routing keys**:

1. Los mensajes se publican con una routing key específica
2. El exchange de tipo **topic** evalúa la routing key
3. Los mensajes se enrutan solo a las colas con bindings coincidentes
4. Permite patrones como `order.*` o `inventory.#`

### 📊 Flujo de Datos

```
Order Service → publishEvent('order.events', 'order.created', {...})
                        ↓
            [order.events Topic Exchange]
                        ↓
        Evalúa routing key = 'order.created'
                        ↓
        ├─→ [order.process Queue] (binding: 'order.created')
        └─→ [inventory.reserve Queue] (binding: 'order.created')

Inventory Service → publishEvent('order.events', 'inventory.reserved', {...})
                        ↓
            [order.events Topic Exchange]
                        ↓
        Evalúa routing key = 'inventory.reserved'
                        ↓
        └─→ [payment.process Queue] (binding: 'inventory.reserved')
```

**Ejemplo de código**:
```javascript
// services/order-service/src/config/rabbitmq.js (líneas 53-79)
async function publishEvent(exchange, routingKey, message) {
  await channel.publish(exchange, routingKey, messageBuffer, {
    persistent: true,
    contentType: 'application/json',
    messageId: message.messageId,
    correlationId: message.correlationId,
    headers: {
      'x-event-type': message.eventType,
      'x-retry-count': 0
    }
  });
}
```

**Bindings en RabbitMQ**:
```json
// infrastructure/rabbitmq/definitions.json (líneas 130-153)
{
  "source": "order.events",
  "destination": "order.process",
  "routing_key": "order.created"
},
{
  "source": "order.events",
  "destination": "inventory.reserve",
  "routing_key": "order.created"
},
{
  "source": "order.events",
  "destination": "payment.process",
  "routing_key": "inventory.reserved"
}
```

### 🛠️ Herramientas Involucradas

- **RabbitMQ Topic Exchange**: Enrutamiento basado en patrones
- **Routing Keys**: `order.created`, `inventory.reserved`, `order.confirmed`
- **Order Service**: Publicador principal
- **Inventory Service**: Publicador secundario
- **Payment Service**: Consumidor final

### ✅ Por Qué se Usa

- **Enrutamiento inteligente**: Mensajes van solo a destinos relevantes
- **Filtrado dinámico**: Usa patrones de routing keys
- **Orquestación de flujo**: Controla el flujo de pedidos

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Flexible y escalable | ❌ Requiere conocer routing keys |
| ✅ Filtrado eficiente | ❌ Configuración más compleja |
| ✅ Múltiples destinos selectivos | ❌ Coupling a través de routing keys |

---

## 4. Message Translator (Traductor de Mensajes)

### 📍 Dónde se Usa

- **Servicio**: Legacy CSV Processor
  - **Ubicación**: `legacy/src/index.js`
  - **Función principal**: `processRecord()` (líneas 136-184)
  - **Transformación**: CSV → JSON → PostgreSQL

### 🔧 Cómo Funciona

El Message Translator convierte mensajes de un formato a otro:

1. Lee archivos CSV del directorio `legacy/inbox`
2. Parsea cada línea del CSV
3. **Transforma** el formato CSV a un modelo de datos JSON
4. Inserta/actualiza en PostgreSQL con el formato interno
5. Publica eventos en formato JSON a RabbitMQ

### 📊 Flujo de Datos

```
Archivo CSV en /inbox
    ↓
[Legacy Processor detecta archivo]
    ↓
Parse CSV → {sku, name, description, category, price, quantity}
    ↓
[Message Translator - processRecord()]
    ↓
Transforma a modelo interno:
{
  id: UUID,
  sku: string,
  name: string,
  description: string,
  category: string,
  price: decimal,
  quantity_available: integer,
  created_at: timestamp,
  updated_at: timestamp
}
    ↓
INSERT/UPDATE PostgreSQL (inventory.products)
    ↓
Publica evento CSVImportCompleted en JSON
    ↓
Mueve archivo a /processed o /error
```

**Ejemplo de código CSV a JSON**:
```javascript
// legacy/src/index.js (líneas 136-184)
async function processRecord(record, lineNumber) {
  // INPUT: CSV record
  // {sku: 'ABC123', name: 'Product', price: '29.99', quantity: '10'}
  
  // VALIDATION & TRANSFORMATION
  const sku = String(record.sku).trim();
  const name = String(record.name).trim();
  const price = parseFloat(record.price) || 0;
  const quantity = parseInt(record.quantity) || 0;
  
  // OUTPUT: Database model (JSON)
  await pool.query(
    `INSERT INTO inventory.products 
     (sku, name, description, category, price, quantity_available, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (sku) DO UPDATE SET ...`,
    [sku, name, description, category, price, quantity]
  );
}
```

**Formato CSV esperado**:
```csv
sku,name,description,category,price,quantity
PROD001,Laptop Dell XPS 13,High-performance laptop,Electronics,1299.99,50
PROD002,Mouse Logitech MX,Wireless mouse,Accessories,79.99,200
```

**Formato JSON generado**:
```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "CSVImportCompleted",
  "importId": "abc-def-ghi",
  "filename": "products_2024.csv",
  "status": "COMPLETED",
  "totalRecords": 100,
  "processedRecords": 98,
  "failedRecords": 2,
  "timestamp": "2024-01-22T10:30:00Z"
}
```

### 🛠️ Herramientas Involucradas

- **csv-parse**: Parser de archivos CSV
- **chokidar**: File system watcher
- **PostgreSQL**: Base de datos de destino
- **RabbitMQ**: Publicación de eventos post-transformación
- **Node.js fs**: Sistema de archivos

### ✅ Por Qué se Usa

- **Integración con sistemas legacy**: Importa datos de sistemas antiguos (CSV)
- **Normalización de datos**: Convierte formatos legacy a modernos
- **Independencia de sistemas**: El sistema legacy no necesita cambiar

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Independencia de sistemas | ❌ Código específico por formato |
| ✅ Validación centralizada | ❌ Performance limitada por I/O |
| ✅ Conversión automática | ❌ Requiere mantenimiento cuando cambian formatos |

---

## 5. Dead Letter Channel (Canal de Mensajes Muertos)

### 📍 Dónde se Usa

- **DLQ**: `order.process.dlq`
  - **Ubicación**: `infrastructure/rabbitmq/definitions.json` (líneas 36-41)
  - **Exchange DLX**: `dlx.exchange` (líneas 111-118)
  - **Configuración**: Colas principales tienen `x-dead-letter-exchange` configurado

- **DLQ**: `payment.process.dlq`
  - **Ubicación**: `infrastructure/rabbitmq/definitions.json` (líneas 70-75)

- **DLQ**: `inventory.reserve.dlq`
  - **Ubicación**: `infrastructure/rabbitmq/definitions.json` (líneas 53-58)

### 🔧 Cómo Funciona

El Dead Letter Channel captura mensajes que no pueden ser procesados:

1. Un mensaje falla en procesarse
2. El consumer hace NACK con requeue=false
3. Si la cola tiene configurado `x-dead-letter-exchange`, el mensaje se reenvía
4. El mensaje llega al Dead Letter Exchange (DLX)
5. El DLX enruta el mensaje a la cola DLQ correspondiente
6. Los mensajes en DLQ pueden ser monitoreados y reprocesados manualmente

### 📊 Flujo de Datos

```
[order.process Queue]
    ↓
Consumer intenta procesar
    ↓
❌ Falla 3 veces (max retries)
    ↓
channel.nack(msg, false, false) // No requeue
    ↓
x-dead-letter-exchange: dlx.exchange
x-dead-letter-routing-key: order.process.dlq
    ↓
[dlx.exchange]
    ↓
[order.process.dlq] → Almacena mensaje fallido
    ↓
🔔 Alerta para investigación manual
```

**Configuración de cola con DLX**:
```json
// infrastructure/rabbitmq/definitions.json (líneas 25-34)
{
  "name": "order.process",
  "durable": true,
  "arguments": {
    "x-dead-letter-exchange": "dlx.exchange",
    "x-dead-letter-routing-key": "order.process.dlq"
  }
}
```

**Código de manejo de fallos**:
```javascript
// services/order-service/src/config/rabbitmq.js (líneas 121-146)
try {
  await processOrder(content);
  channel.ack(msg);
} catch (error) {
  const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
  
  if (retryCount <= 3) {
    // Reintentar: reencolar con contador incrementado
    await channel.publish('order.direct', 'order.process', msg.content, {
      ...msg.properties,
      headers: {
        ...msg.properties.headers,
        'x-retry-count': retryCount
      }
    });
    channel.ack(msg);
  } else {
    // Enviar a DLQ después de max retries
    channel.nack(msg, false, false);
  }
}
```

### 🛠️ Herramientas Involucradas

- **RabbitMQ DLX (Dead Letter Exchange)**: Exchange especial para mensajes fallidos
- **DLQ (Dead Letter Queues)**: Colas de almacenamiento de mensajes fallidos
- **x-retry-count header**: Contador de reintentos
- **RabbitMQ Management UI**: Monitoreo de DLQs (http://localhost:15672)

### ✅ Por Qué se Usa

- **No pierde mensajes**: Todos los mensajes fallidos se preservan
- **Análisis de fallos**: Permite investigar por qué fallaron
- **Reprocesamiento**: Los mensajes pueden ser reenviados manualmente

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ No pierde mensajes | ❌ Requiere monitoreo de DLQ |
| ✅ Debugging facilitado | ❌ DLQ puede crecer indefinidamente |
| ✅ Reprocesamiento posible | ❌ Necesita proceso manual de limpieza |

---

## 6. Idempotent Consumer (Consumidor Idempotente)

### 📍 Dónde se Usa

- **Servicio**: Order Service
  - **Ubicación**: `services/order-service/src/services/idempotency.service.js`
  - **Funciones**: 
    - `checkIdempotency()` (líneas 15-30)
    - `markAsProcessed()` (líneas 38-52)
    - `isMessageProcessed()` (líneas 59-67)
    - `markMessageProcessed()` (líneas 74-82)
  - **Storage**: Redis con prefijo `idempotency:` o `msg:`

### 🔧 Cómo Funciona

El Idempotent Consumer evita procesamiento duplicado usando Redis:

1. Antes de procesar un mensaje, se verifica su `messageId` en Redis
2. Si existe → el mensaje ya fue procesado → devolver resultado cacheado
3. Si NO existe → procesar mensaje → almacenar resultado en Redis
4. Redis TTL de 24 horas limpia automáticamente entradas antiguas

### 📊 Flujo de Datos

```
Mensaje llega con messageId: '123-abc'
    ↓
[checkIdempotency('123-abc')]
    ↓
Redis GET 'idempotency:123-abc'
    ↓
¿Existe en Redis?
    ├─ SÍ → Devolver resultado cacheado (sin procesar)
    └─ NO → Continuar procesamiento
           ↓
       Procesar pedido
           ↓
       [markAsProcessed('123-abc', resultado)]
           ↓
       Redis SETEX 'idempotency:123-abc' 86400 '{resultado}'
           ↓
       Devolver resultado
```

**Ejemplo de código**:
```javascript
// services/order-service/src/services/idempotency.service.js

// 1. Verificar si ya fue procesado
async function checkIdempotency(idempotencyKey) {
  const existing = await redisClient.get(`idempotency:${idempotencyKey}`);
  
  if (existing) {
    logger.debug(`Idempotency hit for key: ${idempotencyKey}`);
    return JSON.parse(existing); // ✅ Retorna resultado anterior
  }
  
  return null; // ❌ No procesado antes
}

// 2. Marcar como procesado
async function markAsProcessed(idempotencyKey, result, ttl = 86400) {
  await redisClient.setEx(
    `idempotency:${idempotencyKey}`,
    ttl,
    JSON.stringify(result)
  );
}

// 3. Uso en consumidor de mensajes RabbitMQ
await channel.consume('order.process', async (msg) => {
  if (msg) {
    const content = JSON.parse(msg.content.toString());
    const messageId = msg.properties.messageId;
    
    // Verificar si ya fue procesado
    const alreadyProcessed = await isMessageProcessed(messageId);
    if (alreadyProcessed) {
      logger.info(`Message ${messageId} already processed, skipping`);
      channel.ack(msg);
      return;
    }
    
    // Procesar mensaje
    const result = await processOrder(content);
    
    // Marcar como procesado
    await markMessageProcessed(messageId);
    
    channel.ack(msg);
  }
}, { noAck: false });
```

**Ejemplo de mensaje duplicado en RabbitMQ**:
```
MESSAGE 1: RabbitMQ message with messageId: abc-123
  → Redis: NO existe 'msg:abc-123'
  → Procesa pedido
  → Redis SET 'msg:abc-123' = '1' (TTL 24h)
  → ACK message

MESSAGE 2: Mismo mensaje reenviado (messageId: abc-123) [DUPLICADO]
  → Redis: SÍ existe 'msg:abc-123'
  → NO procesa (idempotency hit)
  → ACK message (evita reprocessamiento)
```

### 🛠️ Herramientas Involucradas

- **Redis**: Cache distribuido para tracking de mensajes procesados
- **redis library (Node.js)**: Cliente de Redis
- **UUID**: Generación de IDs únicos
- **TTL (Time To Live)**: Expiración automática de keys (24 horas)

### ✅ Por Qué se Usa

- **Evitar procesamiento duplicado**: Pedidos no se crean dos veces
- **Garantía exactly-once**: Semántica de entrega única
- **Seguridad**: Protege contra reintentos de red

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Garantiza exactly-once | ❌ Dependencia de Redis |
| ✅ Performance (cache hit) | ❌ Overhead de escritura en Redis |
| ✅ Previene duplicados | ❌ TTL debe ser ajustado correctamente |

---

## 7. Circuit Breaker (Cortocircuito)

### 📍 Dónde se Usa

- **Servicio**: Order Service
  - **Ubicación**: `services/order-service/src/services/resilience.service.js`
  - **Librería**: Opossum (líneas 5-49)
  - **Función**: `callWithCircuitBreaker()` (líneas 55-68)
  - **Package**: `services/order-service/package.json` (línea 27)

### 🔧 Cómo Funciona

El Circuit Breaker protege el sistema de fallos en cascada:

**Estados del Circuit Breaker**:

1. **CLOSED** (Normal): Las peticiones pasan normalmente
   - Si falla > 50% de peticiones → Abre circuito
   
2. **OPEN** (Abierto): Rechaza peticiones inmediatamente
   - Espera 30 segundos (resetTimeout)
   - Después → Pasa a HALF-OPEN
   
3. **HALF-OPEN** (Semi-abierto): Prueba con 1 petición
   - Si OK → Vuelve a CLOSED
   - Si FALLA → Vuelve a OPEN

### 📊 Flujo de Datos

```
Request a servicio externo (ej: Payment Gateway)
    ↓
[Circuit Breaker - Estado: CLOSED]
    ↓
5 peticiones consecutivas FALLAN
    ↓
❌ Threshold alcanzado (50% error rate)
    ↓
[Circuit Breaker - Estado: OPEN]
    ↓
Peticiones subsecuentes → Rechazadas inmediatamente
    ↓
Espera 30 segundos (resetTimeout)
    ↓
[Circuit Breaker - Estado: HALF-OPEN]
    ↓
Intenta 1 petición de prueba
    ├─ ✅ OK → [Estado: CLOSED]
    └─ ❌ FALLA → [Estado: OPEN]
```

**Configuración**:
```javascript
// services/order-service/src/services/resilience.service.js (líneas 10-15)
const circuitBreakerOptions = {
  timeout: 5000,                    // 5 segundos timeout
  errorThresholdPercentage: 50,     // 50% error rate para abrir
  resetTimeout: 30000,              // 30 segundos antes de HALF-OPEN
  volumeThreshold: 5                // Mínimo 5 peticiones antes de evaluar
};
```

**Ejemplo de uso**:
```javascript
// Proteger llamada a servicio externo
const breaker = getCircuitBreaker('payment-gateway', async () => {
  return await axios.post('https://payment-api.com/charge', paymentData, {
    timeout: 5000
  });
});

breaker.on('open', () => {
  logger.warn('Circuit breaker OPENED for payment-gateway');
  // Enviar alerta a equipo de operaciones
});

breaker.on('halfOpen', () => {
  logger.info('Circuit breaker HALF-OPEN for payment-gateway');
});

breaker.on('close', () => {
  logger.info('Circuit breaker CLOSED for payment-gateway');
});

// Ejecutar con fallback
breaker.fallback(() => {
  // Respuesta alternativa cuando circuito está abierto
  return { status: 'pending', message: 'Payment service unavailable' };
});

try {
  const result = await breaker.fire();
  return result;
} catch (error) {
  // Circuito abierto o fallo real
  logger.error(`Payment failed: ${error.message}`);
  throw error;
}
```

**Monitoreo del estado**:
```javascript
// services/order-service/src/services/resilience.service.js (líneas 122-131)
function getCircuitBreakerStatus() {
  const status = {};
  for (const [name, breaker] of circuitBreakers) {
    status[name] = {
      state: breaker.opened ? 'OPEN' : (breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED'),
      stats: breaker.stats
    };
  }
  return status;
}
```

### 🛠️ Herramientas Involucradas

- **Opossum**: Librería de Circuit Breaker para Node.js
- **Winston**: Logging de eventos del circuit breaker
- **Axios**: Cliente HTTP (protegido por circuit breaker)
- **Express**: Framework para exponer status endpoint

### ✅ Por Qué se Usa

- **Previene cascading failures**: Un servicio caído no tumba todo el sistema
- **Fast fail**: Rechaza peticiones rápidamente en vez de esperar timeout
- **Auto-recuperación**: Intenta reconectar automáticamente (HALF-OPEN)

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Previene cascading failures | ❌ Requiere ajuste de thresholds |
| ✅ Auto-recuperación | ❌ Falsos positivos posibles |
| ✅ Fast fail | ❌ Complejidad adicional |

---

## 8. Retry with Backoff (Reintento con Retroceso Exponencial)

### 📍 Dónde se Usa

- **Servicio**: Order Service (principalmente)
  - **Ubicación**: `services/order-service/src/services/resilience.service.js`
  - **Función**: `retryWithBackoff()` (líneas 73-105)
  - **Librería**: async-retry
  
- **Implementación en Payment Service**:
  - **Ubicación**: `services/payment-service/src/config/rabbitmq.js` (líneas 61-64)
  - **Reintentos**: 3 intentos con requeue

### 🔧 Cómo Funciona

Retry with Backoff reintenta operaciones fallidas con delays incrementales:

1. Primera falla → Espera 1 segundo → Reintenta
2. Segunda falla → Espera 2 segundos → Reintenta
3. Tercera falla → Espera 4 segundos → Reintenta
4. Después de max retries → Lanza excepción o envía a DLQ

**Backoff exponencial**: `delay = initialDelay * (factor ^ attemptNumber)`

### 📊 Flujo de Datos

```
Llamada a servicio externo (ej: conectar a RabbitMQ)
    ↓
❌ FALLA (intento 1)
    ↓
Espera 1 segundo
    ↓
❌ FALLA (intento 2)
    ↓
Espera 2 segundos (1 * 2^1)
    ↓
❌ FALLA (intento 3)
    ↓
Espera 4 segundos (1 * 2^2)
    ↓
✅ ÉXITO → Continúa
    ↓
(O después de max retries → Error final)
```

**Implementación con async-retry**:
```javascript
// services/order-service/src/services/resilience.service.js (líneas 73-105)
async function retryWithBackoff(asyncFunction, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2
  } = options;

  return await retry(
    async (bail, attemptNumber) => {
      try {
        logger.debug(`Retry attempt ${attemptNumber}`);
        return await asyncFunction();
      } catch (error) {
        // No reintentar errores de cliente (4xx)
        if (error.status === 400 || error.status === 401 || error.status === 404) {
          bail(error); // Aborta reintentos
          return;
        }
        throw error; // Reintenta
      }
    },
    {
      retries: maxRetries,
      factor,
      minTimeout: initialDelay,
      maxTimeout: maxDelay,
      onRetry: (error, attemptNumber) => {
        logger.warn(`Retry attempt ${attemptNumber} after error: ${error.message}`);
      }
    }
  );
}
```

**Uso en conexión a RabbitMQ**:
```javascript
// services/order-service/src/config/rabbitmq.js (líneas 16-21)
connection = await retryWithBackoff(
  async () => await amqp.connect(RABBITMQ_URL),
  { maxRetries: 5, initialDelay: 1000, maxDelay: 10000 }
);
```

**Retry en consumidor de mensajes**:
```javascript
// services/payment-service/src/config/rabbitmq.js (líneas 60-64)
const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;

if (retryCount <= 3) {
  channel.nack(msg, false, true); // Requeue con delay
} else {
  channel.nack(msg, false, false); // Enviar a DLQ
}
```

### 🛠️ Herramientas Involucradas

- **async-retry**: Librería para retry lógico con backoff
- **x-retry-count header**: Contador de reintentos en mensajes RabbitMQ
- **RabbitMQ nack**: Requeue de mensajes con reintento
- **Winston logger**: Logging de reintentos

### ✅ Por Qué se Usa

- **Tolera errores temporales**: Network glitches, servicios reiniciando
- **Evita sobrecargar servicios**: El delay da tiempo de recuperación
- **Auto-recuperación**: Sistema se recupera automáticamente

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Tolera errores temporales | ❌ Aumenta latencia en fallos |
| ✅ Auto-recuperación | ❌ Puede ocultar problemas reales |
| ✅ Configurable | ❌ Complejidad en debugging |

---

## 9. Correlation Identifier (Identificador de Correlación)

### 📍 Dónde se Usa

- **Header**: `x-correlation-id`
  - **Order Service**: `services/order-service/src/index.js` (línea 62)
  - **Payment Service**: `services/payment-service/src/index.js` (línea 40)
  - **Inventory Service**: `services/inventory-service/src/index.js`
  
- **Propagación en mensajes**:
  - RabbitMQ properties: `correlationId` field
  - Headers HTTP: `X-Correlation-ID`

### 🔧 Cómo Funciona

El Correlation Identifier rastrea requests end-to-end:

1. Cliente envía request (con o sin correlation ID)
2. API Gateway/Service genera UUID si no existe
3. El correlation ID se propaga en:
   - Headers HTTP: `X-Correlation-ID`
   - Mensajes RabbitMQ: `correlationId` property
   - Logs: Incluido en cada log entry
4. Todos los servicios incluyen el mismo ID en sus logs
5. Permite rastrear toda la transacción en logs agregados

### 📊 Flujo de Datos

```
Cliente → POST /api/orders
          Header: X-Correlation-ID: abc-123
    ↓
[Order Service]
  req.correlationId = 'abc-123'
  res.setHeader('X-Correlation-ID', 'abc-123')
  logger.info('Creating order', { correlationId: 'abc-123' })
    ↓
Publica a RabbitMQ:
  {
    messageId: 'xyz',
    correlationId: 'abc-123',
    orderId: 'order-456'
  }
    ↓
[Inventory Service]
  Recibe mensaje con correlationId: 'abc-123'
  logger.info('Reserving inventory', { correlationId: 'abc-123' })
    ↓
[Payment Service]
  Recibe mensaje con correlationId: 'abc-123'
  logger.info('Processing payment', { correlationId: 'abc-123' })
    ↓
Logs agregados:
  [Order Service] Creating order | correlationId=abc-123
  [Inventory Service] Reserving inventory | correlationId=abc-123
  [Payment Service] Processing payment | correlationId=abc-123
```

**Middleware HTTP**:
```javascript
// services/order-service/src/index.js (líneas 61-65)
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || require('uuid').v4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});
```

**Propagación en mensajes RabbitMQ**:
```javascript
// services/order-service/src/config/rabbitmq.js (líneas 59-72)
await channel.publish(exchange, routingKey, messageBuffer, {
  persistent: true,
  contentType: 'application/json',
  messageId: message.messageId,
  correlationId: message.correlationId, // ✅ Propaga correlation ID
  timestamp: Date.now(),
  headers: {
    'x-event-type': message.eventType,
    'x-retry-count': 0
  }
});
```

**Logging con correlation ID**:
```javascript
// services/payment-service/src/index.js (líneas 54-55)
logger.info(`Processing payment for order: ${orderId}`, {
  correlationId: correlationId,
  orderId: orderId,
  amount: totalAmount
});
```

**Búsqueda en logs**:
```bash
# Buscar todos los logs de una transacción específica
docker logs integrahub-order-service | grep "abc-123"
docker logs integrahub-inventory-service | grep "abc-123"
docker logs integrahub-payment-service | grep "abc-123"

# Output:
# [Order Service] 2024-01-22 10:30:01 | Creating order | correlationId=abc-123
# [Inventory Service] 2024-01-22 10:30:02 | Reserving inventory | correlationId=abc-123
# [Payment Service] 2024-01-22 10:30:05 | Processing payment | correlationId=abc-123
```

### 🛠️ Herramientas Involucradas

- **UUID (uuid library)**: Generación de IDs únicos
- **Express middleware**: Inyección de correlation ID en requests
- **Winston logger**: Logging estructurado con correlation ID
- **RabbitMQ properties**: Campo `correlationId` en mensajes
- **ELK Stack (opcional)**: Aggregación y búsqueda de logs

### ✅ Por Qué se Usa

- **Tracing end-to-end**: Rastrea requests a través de múltiples servicios
- **Debugging facilitado**: Encuentra todos los logs de una transacción
- **Monitoreo**: Detecta cuellos de botella y latencias

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Debugging facilitado | ❌ Debe propagarse manualmente |
| ✅ Tracing completo | ❌ Overhead mínimo en headers |
| ✅ Análisis de performance | ❌ Requiere disciplina en implementación |

---

## 10. Content-Based Router (Enrutador Basado en Contenido)

### 📍 Dónde se Usa

- **Exchange**: `order.events` (Topic Exchange)
  - **Ubicación**: `infrastructure/rabbitmq/definitions.json` (líneas 92-100)
  - **Tipo**: Topic
  - **Patrones de routing**:
    - `order.created` → Múltiples destinos
    - `order.confirmed` → Analytics
    - `inventory.reserved` → Payment processing
    - `inventory.#` → Cualquier evento de inventario

### 🔧 Cómo Funciona

El Content-Based Router enruta mensajes basándose en patrones de routing keys:

1. Mensajes se publican con routing key específica
2. Topic exchange evalúa patrones en bindings
3. Patrones soportados:
   - `*` (asterisco): Coincide exactamente con 1 palabra
   - `#` (hash): Coincide con 0 o más palabras
4. Mensajes se enrutan solo a colas con bindings coincidentes

### 📊 Flujo de Datos

```
Order Service → Publica evento con routing key
    ↓
order.events (Topic Exchange)
    ↓
Evalúa routing key contra bindings
    ↓
Routing Key: "order.created"
    ├─→ Binding: "order.created" → [order.process Queue] ✅ Match
    ├─→ Binding: "order.*" → [analytics Queue] ✅ Match
    ├─→ Binding: "order.#" → [audit Queue] ✅ Match
    ├─→ Binding: "inventory.*" → [inventory Queue] ❌ No match
    └─→ Binding: "#" → [all-events Queue] ✅ Match (wildcard)
```

**Patrones de routing keys**:
```javascript
// Ejemplos de routing keys usadas
'order.created'          // Pedido creado
'order.confirmed'        // Pedido confirmado
'order.rejected'         // Pedido rechazado
'inventory.reserved'     // Inventario reservado
'inventory.released'     // Inventario liberado
'payment.completed'      // Pago completado
'payment.failed'         // Pago fallido
```

**Configuración de bindings con patrones**:
```json
// infrastructure/rabbitmq/definitions.json
{
  "source": "order.events",
  "destination": "order.process",
  "routing_key": "order.created"  // Exacto
},
{
  "source": "order.events",
  "destination": "analytics.queue",
  "routing_key": "order.*"  // Cualquier evento de order
},
{
  "source": "order.events",
  "destination": "audit.queue",
  "routing_key": "#"  // Todos los eventos
}
```

**Publicación con routing key**:
```javascript
// services/order-service/src/config/rabbitmq.js
await publishEvent('order.events', 'order.created', {
  messageId: uuidv4(),
  eventType: 'OrderCreated',
  orderId: order.id,
  correlationId: correlationId,
  items: orderItems,
  timestamp: new Date().toISOString()
});

// Este mensaje llegará a TODAS las colas con bindings que coincidan:
// - "order.created" (exact match)
// - "order.*" (wildcard)
// - "#" (catch all)
```

**Ejemplo de filtrado avanzado**:
```javascript
// Solo eventos de inventario críticos
routing_key: "inventory.critical.*"

// Todos los eventos de pedidos
routing_key: "order.#"

// Todos los eventos de pagos
routing_key: "payment.#"

// Eventos de confirmación de cualquier tipo
routing_key: "*.confirmed"
```

### 🛠️ Herramientas Involucradas

- **RabbitMQ Topic Exchange**: Engine de pattern matching
- **Routing Keys**: Identificadores jerárquicos (ej: `order.created`)
- **Bindings**: Reglas de enrutamiento
- **Wildcards**: `*` (una palabra), `#` (0+ palabras)

### ✅ Por Qué se Usa

- **Filtrado fino de mensajes**: Solo recibe eventos relevantes
- **Flexibilidad**: Fácil agregar nuevos patrones sin modificar publicadores
- **Escalabilidad**: Múltiples consumidores pueden filtrar independientemente

### ⚖️ Trade-offs

| Ventaja | Desventaja |
|---------|------------|
| ✅ Filtrado fino de mensajes | ❌ Complejidad en bindings |
| ✅ Flexible y extensible | ❌ Debugging más difícil |
| ✅ Desacoplamiento | ❌ Performance overhead del pattern matching |

---

## 📊 Resumen de Patrones y Herramientas

| Patrón | Herramienta Principal | Ubicación Clave | Propósito |
|--------|----------------------|-----------------|-----------|
| Point-to-Point | RabbitMQ Queues | `infrastructure/rabbitmq/definitions.json` | Procesamiento secuencial 1:1 |
| Publish/Subscribe | RabbitMQ Fanout Exchange | `notification.fanout` | Broadcast a múltiples suscriptores |
| Message Router | RabbitMQ Topic Exchange | `order.events` | Enrutamiento basado en tipo |
| Message Translator | Legacy CSV Processor | `legacy/src/index.js` | Transformación CSV → JSON |
| Dead Letter Channel | RabbitMQ DLX + DLQ | `dlx.exchange` + `*.dlq` queues | Manejo de mensajes fallidos |
| Idempotent Consumer | Redis Cache | `services/order-service/src/services/idempotency.service.js` | Prevenir duplicados |
| Circuit Breaker | Opossum Library | `services/order-service/src/services/resilience.service.js` | Protección contra fallos |
| Retry with Backoff | async-retry Library | `services/order-service/src/services/resilience.service.js` | Reintentos inteligentes |
| Correlation Identifier | UUID + Headers | Middleware en todos los servicios | Tracing end-to-end |
| Content-Based Router | RabbitMQ Topic Patterns | Bindings con `*` y `#` | Filtrado avanzado |

---

## 🔗 Referencias Cruzadas

### Flujo Completo de un Pedido (E2E)

```
1. Cliente → POST /api/orders
   ├─ Patrón: Correlation Identifier (genera UUID)
   └─ Patrón: Idempotent Consumer (verifica en Redis)

2. Order Service → Crea pedido en DB
   ├─ Patrón: Retry with Backoff (conexión DB)
   └─ Patrón: Circuit Breaker (protege DB)

3. Order Service → Publica 'order.created'
   ├─ Patrón: Message Router (topic exchange)
   └─ Patrón: Content-Based Router (routing key)

4. Inventory Service → Recibe de 'inventory.reserve'
   ├─ Patrón: Point-to-Point (cola dedicada)
   ├─ Patrón: Idempotent Consumer (verifica messageId)
   └─ Patrón: Dead Letter Channel (si falla)

5. Payment Service → Recibe de 'payment.process'
   ├─ Patrón: Point-to-Point (cola dedicada)
   ├─ Patrón: Retry with Backoff (reintentos)
   └─ Patrón: Circuit Breaker (gateway externo)

6. Payment Service → Publica resultado
   ├─ Patrón: Publish/Subscribe (fanout)
   └─ Patrón: Correlation Identifier (propaga UUID)

7. Notification Service → Recibe notificaciones
   └─ Patrón: Publish/Subscribe (múltiples suscriptores)

8. Legacy Processor → Importa CSV
   └─ Patrón: Message Translator (CSV → JSON)
```

---

## 🎯 Conclusiones

### Fortalezas del Sistema

1. **Resiliencia**: Circuit Breaker + Retry protegen contra fallos
2. **No pierde datos**: DLQ + Idempotency garantizan integridad
3. **Trazabilidad**: Correlation ID permite debugging completo
4. **Escalabilidad**: Point-to-Point + Pub/Sub permiten escalar independientemente
5. **Integración Legacy**: Message Translator mantiene compatibilidad

### Áreas de Mejora

1. **Monitoreo**: Agregar dashboards para DLQs y Circuit Breaker states
2. **Métricas**: Implementar Prometheus/Grafana para observabilidad
3. **Testing**: Agregar tests de resiliencia (chaos engineering)
4. **Documentación**: Diagramas de secuencia para cada patrón

---

## 📚 Recursos Adicionales

- **Enterprise Integration Patterns**: https://www.enterpriseintegrationpatterns.com/
- **RabbitMQ Patterns**: https://www.rabbitmq.com/tutorials/tutorial-topics.html
- **Opossum Circuit Breaker**: https://nodeshift.dev/opossum/
- **async-retry**: https://www.npmjs.com/package/async-retry
- **Redis Idempotency**: https://redis.io/docs/manual/patterns/distributed-locks/

---

**Autor**: IntegraHub Team  
**Fecha**: Enero 2024  
**Versión**: 1.0
