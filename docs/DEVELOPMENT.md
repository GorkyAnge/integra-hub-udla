# IntegraHub - Guía de Desarrollo

## 🚀 Quick Start

### Prerrequisitos
- Docker Desktop 4.x+
- Docker Compose v2+
- Git

### Levantar todo el sistema

```bash
# Clonar repositorio
git clone <repo-url>
cd IntegraHub

# Copiar variables de entorno
cp .env.example .env

# Levantar infraestructura
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Verificar que todo está corriendo

```bash
# Ver estado de contenedores
docker-compose ps

# Probar health checks
curl http://localhost:3000/health  # Auth
curl http://localhost:3001/health  # Orders
curl http://localhost:3002/health  # Inventory
curl http://localhost:3003/health  # Payments
curl http://localhost:3004/health  # Notifications
curl http://localhost:3005/health  # Analytics
```

---

## 📁 Estructura del Proyecto

```
IntegraHub/
├── docker-compose.yml          # Orquestación de servicios
├── .env.example                # Variables de entorno
├── README.md                   # Documentación principal
│
├── infrastructure/             # Configuración de infraestructura
│   ├── init-db.sql            # Schema inicial PostgreSQL
│   ├── nginx.conf             # Config API Gateway
│   └── rabbitmq/              # Config RabbitMQ
│       ├── rabbitmq.conf
│       └── definitions.json   # Exchanges, queues, bindings
│
├── services/                   # Microservicios
│   ├── auth-service/          # OAuth2 + JWT
│   ├── order-service/         # Gestión de pedidos
│   ├── inventory-service/     # Control de inventario
│   ├── payment-service/       # Procesamiento de pagos
│   └── notification-service/  # Notificaciones pub/sub
│
├── legacy/                     # Procesador de archivos legacy
│   └── csv-processor/         # File watcher para CSV
│       ├── inbox/             # Carpeta de entrada
│       ├── processed/         # Archivos procesados
│       └── error/             # Archivos con error
│
├── analytics/                  # Servicio de analíticas
│                              # Consumer Kafka + ETL
│
├── portal/                     # Demo Portal (HTML/JS)
│   ├── index.html
│   ├── css/
│   └── js/
│
├── postman/                    # Colección Postman
│   └── IntegraHub.postman_collection.json
│
└── docs/                       # Documentación
    ├── PATTERNS.md            # Patrones de integración
    ├── C4-DIAGRAMS.md         # Diagramas de arquitectura
    └── DEVELOPMENT.md         # Esta guía
```

---

## 🔧 Desarrollo Local

### Desarrollo de un servicio individual

```bash
# Entrar al directorio del servicio
cd services/order-service

# Instalar dependencias
npm install

# Variables de entorno locales
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/integrahub
export RABBITMQ_URL=amqp://admin:admin@localhost:5672
export REDIS_URL=redis://localhost:6379
export AUTH_SERVICE_URL=http://localhost:3000

# Ejecutar en modo desarrollo
npm run dev
```

### Hot Reload con Docker

Para desarrollo con hot-reload, puedes montar volúmenes:

```yaml
# En docker-compose.override.yml
services:
  order-service:
    volumes:
      - ./services/order-service/src:/app/src
    command: npm run dev
```

---

## 🧪 Testing

### Ejecutar Postman Collection

```bash
# Instalar Newman (CLI de Postman)
npm install -g newman

# Ejecutar colección completa
newman run postman/IntegraHub.postman_collection.json

# Con reporter HTML
newman run postman/IntegraHub.postman_collection.json -r htmlextra
```

### Tests manuales con curl

```bash
# 1. Obtener token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"integrahub-client","client_secret":"integrahub-secret"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# 2. Crear orden
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "customerId": "cust-001",
    "customerEmail": "test@test.com",
    "customerName": "Test Customer",
    "items": [
      {"productId": "prod-001", "productName": "Test", "quantity": 1, "unitPrice": 99.99}
    ]
  }'

# 3. Ver órdenes
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/orders
```

---

## 📊 Monitoreo

### UIs Disponibles

| Herramienta | URL | Credenciales |
|-------------|-----|--------------|
| RabbitMQ Management | http://localhost:15672 | admin / admin |
| Kafka UI | http://localhost:8090 | - |
| Demo Portal | http://localhost:8080 | - |

### Ver logs de un servicio

```bash
# Logs en tiempo real
docker-compose logs -f order-service

# Últimas 100 líneas
docker-compose logs --tail=100 order-service
```

### Verificar mensajes en RabbitMQ

1. Ir a http://localhost:15672
2. Login: admin / admin
3. Tab "Queues" para ver mensajes en cola
4. Tab "Exchanges" para ver bindings

---

## 🔄 Flujo de Trabajo Git

```bash
# Feature branch
git checkout -b feature/nueva-funcionalidad

# Commits pequeños y descriptivos
git commit -m "feat(order-service): add retry with backoff"

# Push y PR
git push origin feature/nueva-funcionalidad
```

### Convención de Commits

```
feat:     Nueva funcionalidad
fix:      Corrección de bug
docs:     Documentación
refactor: Refactorización
test:     Tests
chore:    Mantenimiento
```

---

## 🐛 Troubleshooting

### Puerto ya en uso

```bash
# Ver qué proceso usa el puerto
netstat -tulpn | grep :3001

# O en Windows
netstat -ano | findstr :3001
```

### RabbitMQ no conecta

```bash
# Verificar que RabbitMQ está healthy
docker-compose ps rabbitmq

# Ver logs
docker-compose logs rabbitmq

# Reiniciar
docker-compose restart rabbitmq
```

### Base de datos vacía

```bash
# Reiniciar PostgreSQL con init script
docker-compose down -v
docker-compose up -d postgres

# Esperar inicialización
sleep 10
docker-compose up -d
```

### Limpiar todo y empezar de cero

```bash
# Parar y eliminar todo (incluye volúmenes)
docker-compose down -v

# Eliminar imágenes locales
docker-compose down --rmi local

# Reconstruir todo
docker-compose up -d --build
```

---

## 📝 Agregar un nuevo servicio

1. Crear directorio en `services/`
2. Crear `package.json`, `Dockerfile`, `src/index.js`
3. Agregar al `docker-compose.yml`
4. Actualizar `nginx.conf` si necesita ruta
5. Documentar en `README.md`

### Template de servicio

```javascript
// src/index.js
const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'my-service' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
});
```

---

## 🎓 Recursos de Aprendizaje

- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
