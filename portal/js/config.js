/**
 * IntegraHub Portal - Configuration
 */

const CONFIG = {
    // API Base URLs
    API_GATEWAY: 'http://localhost:80',
    AUTH_SERVICE: 'http://localhost:3000',
    ORDER_SERVICE: 'http://localhost:3001',
    INVENTORY_SERVICE: 'http://localhost:3002',
    PAYMENT_SERVICE: 'http://localhost:3003',
    NOTIFICATION_SERVICE: 'http://localhost:3004',
    ANALYTICS_SERVICE: 'http://localhost:3005',

    // OAuth2 Credentials
    CLIENT_ID: 'integrahub-client',
    CLIENT_SECRET: 'integrahub-secret',

    // Refresh intervals (ms)
    STATUS_REFRESH_INTERVAL: 10000,
    ORDERS_REFRESH_INTERVAL: 5000,
    ANALYTICS_REFRESH_INTERVAL: 15000,
    NOTIFICATIONS_REFRESH_INTERVAL: 5000,

    // Services to monitor
    SERVICES: [
        { name: 'Auth Service', url: 'http://localhost:3000/health', icon: '🔐' },
        { name: 'Order Service', url: 'http://localhost:3001/health', icon: '📦' },
        { name: 'Inventory Service', url: 'http://localhost:3002/health', icon: '📊' },
        { name: 'Payment Service', url: 'http://localhost:3003/health', icon: '💳' },
        { name: 'Notification Service', url: 'http://localhost:3004/health', icon: '📧' },
        { name: 'Analytics Service', url: 'http://localhost:3005/health', icon: '📈' }
    ]
};

// Token storage
let accessToken = null;
let tokenExpiry = null;
