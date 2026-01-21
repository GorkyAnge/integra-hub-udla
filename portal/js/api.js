/**
 * IntegraHub Portal - API Client
 */

/**
 * Get OAuth2 access token
 */
async function getAccessToken() {
    // Return cached token if still valid
    if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
        return accessToken;
    }

    try {
        const response = await fetch(`${CONFIG.AUTH_SERVICE}/auth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: CONFIG.CLIENT_ID,
                client_secret: CONFIG.CLIENT_SECRET
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get access token');
        }

        const data = await response.json();
        accessToken = data.access_token;
        tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000); // 1 min buffer

        return accessToken;
    } catch (error) {
        console.error('Token error:', error);
        throw error;
    }
}

/**
 * Make authenticated API request
 */
async function apiRequest(url, options = {}) {
    try {
        const token = await getAccessToken();
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Correlation-ID': generateUUID(),
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

/**
 * Check service health
 */
async function checkServiceHealth(serviceUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(serviceUrl, {
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
            return await response.json();
        }
        return { status: 'unhealthy' };
    } catch (error) {
        return { status: 'unreachable', error: error.message };
    }
}

/**
 * Get all products
 */
async function getProducts() {
    return await apiRequest(`${CONFIG.INVENTORY_SERVICE}/api/products`);
}

/**
 * Create order
 */
async function createOrder(orderData) {
    const idempotencyKey = generateUUID();
    
    return await apiRequest(`${CONFIG.ORDER_SERVICE}/api/orders`, {
        method: 'POST',
        headers: {
            'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(orderData)
    });
}

/**
 * Get orders
 */
async function getOrders(status = '') {
    const url = status 
        ? `${CONFIG.ORDER_SERVICE}/api/orders?status=${status}`
        : `${CONFIG.ORDER_SERVICE}/api/orders`;
    
    return await apiRequest(url);
}

/**
 * Get order by ID
 */
async function getOrderById(orderId) {
    return await apiRequest(`${CONFIG.ORDER_SERVICE}/api/orders/${orderId}`);
}

/**
 * Get order by Correlation ID
 */
async function getOrderByCorrelation(correlationId) {
    return await apiRequest(`${CONFIG.ORDER_SERVICE}/api/orders/correlation/${correlationId}`);
}

/**
 * Get real-time analytics
 */
async function getRealtimeAnalytics() {
    try {
        const response = await fetch(`${CONFIG.ANALYTICS_SERVICE}/api/analytics/realtime`);
        return await response.json();
    } catch (error) {
        console.error('Analytics error:', error);
        return null;
    }
}

/**
 * Get analytics summary
 */
async function getAnalyticsSummary() {
    try {
        const response = await fetch(`${CONFIG.ANALYTICS_SERVICE}/api/analytics/metrics/summary`);
        return await response.json();
    } catch (error) {
        console.error('Analytics summary error:', error);
        return null;
    }
}

/**
 * Get recent notifications
 */
async function getRecentNotifications() {
    try {
        const response = await fetch(`${CONFIG.NOTIFICATION_SERVICE}/api/notifications/recent`);
        return await response.json();
    } catch (error) {
        console.error('Notifications error:', error);
        return { notifications: [] };
    }
}

/**
 * Generate UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
