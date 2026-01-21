/**
 * IntegraHub Portal - Main Application
 */

// Global state
let products = [];
let selectedProducts = {};

/**
 * Initialize application
 */
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    // Setup form handler
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);

    // Initial data load
    await refreshAll();

    // Start polling for updates
    setInterval(checkServicesHealth, CONFIG.STATUS_REFRESH_INTERVAL);
    setInterval(loadOrders, CONFIG.ORDERS_REFRESH_INTERVAL);
    setInterval(loadAnalytics, CONFIG.ANALYTICS_REFRESH_INTERVAL);
    setInterval(loadNotifications, CONFIG.NOTIFICATIONS_REFRESH_INTERVAL);
}

/**
 * Refresh all data
 */
async function refreshAll() {
    await Promise.all([
        checkServicesHealth(),
        loadProducts(),
        loadOrders(),
        loadAnalytics(),
        loadNotifications()
    ]);
    
    document.getElementById('lastUpdated').textContent = 
        `Last updated: ${new Date().toLocaleTimeString()}`;
}

/**
 * Check all services health
 */
async function checkServicesHealth() {
    const statusGrid = document.getElementById('serviceStatus');
    const connectionStatus = document.getElementById('connectionStatus');
    
    const healthChecks = await Promise.all(
        CONFIG.SERVICES.map(async (service) => {
            const health = await checkServiceHealth(service.url);
            return { ...service, ...health };
        })
    );

    let allHealthy = true;
    let anyReachable = false;

    statusGrid.innerHTML = healthChecks.map(service => {
        const statusClass = service.status === 'healthy' ? 'healthy' : 
                           service.status === 'degraded' ? 'degraded' : 'unhealthy';
        
        if (service.status === 'healthy') anyReachable = true;
        if (service.status !== 'healthy') allHealthy = false;

        return `
            <div class="status-card ${statusClass}">
                <div class="status-icon">${service.icon}</div>
                <div class="status-info">
                    <span class="status-name">${service.name}</span>
                    <span class="status-state">${service.status.toUpperCase()}</span>
                </div>
            </div>
        `;
    }).join('');

    // Update connection status
    if (allHealthy) {
        connectionStatus.className = 'status-indicator connected';
        connectionStatus.innerHTML = '<span class="dot"></span> All Systems Operational';
    } else if (anyReachable) {
        connectionStatus.className = 'status-indicator';
        connectionStatus.innerHTML = '<span class="dot"></span> Partial Service';
    } else {
        connectionStatus.className = 'status-indicator disconnected';
        connectionStatus.innerHTML = '<span class="dot"></span> Services Unavailable';
    }
}

/**
 * Load products for order form
 */
async function loadProducts() {
    try {
        const data = await getProducts();
        products = data.products || [];
        renderProducts();
    } catch (error) {
        console.error('Failed to load products:', error);
        document.getElementById('productList').innerHTML = 
            '<p class="error">Failed to load products. Check if Inventory Service is running.</p>';
    }
}

/**
 * Render product list
 */
function renderProducts() {
    const productList = document.getElementById('productList');
    
    productList.innerHTML = products.map(product => {
        const price = parseFloat(product.price) || 0;
        const stock = product.available_stock || product.quantity_available || 0;
        return `
        <div class="product-item ${selectedProducts[product.id] ? 'selected' : ''}" 
             onclick="toggleProduct('${product.id}')">
            <div class="product-name">${product.name}</div>
            <div class="product-price">$${price.toFixed(2)}</div>
            <div class="product-stock">Stock: ${stock}</div>
            ${selectedProducts[product.id] ? `
                <div class="product-qty" onclick="event.stopPropagation()">
                    <label>Qty:</label>
                    <input type="number" id="qty_${product.id}" value="${selectedProducts[product.id]}" 
                           min="1" max="${stock || 99}" 
                           onchange="updateQuantity('${product.id}', this.value)">
                </div>
            ` : ''}
        </div>
    `}).join('');
}

/**
 * Toggle product selection
 */
function toggleProduct(productId) {
    if (selectedProducts[productId]) {
        delete selectedProducts[productId];
    } else {
        selectedProducts[productId] = 1;
    }
    renderProducts();
}

/**
 * Update product quantity
 */
function updateQuantity(productId, quantity) {
    selectedProducts[productId] = parseInt(quantity) || 1;
}

/**
 * Handle order form submission
 */
async function handleOrderSubmit(e) {
    e.preventDefault();

    const customerName = document.getElementById('customerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const notes = document.getElementById('orderNotes').value;

    if (Object.keys(selectedProducts).length === 0) {
        showToast('Please select at least one product', 'warning');
        return;
    }

    const items = Object.entries(selectedProducts).map(([productId, quantity]) => {
        const product = products.find(p => p.id === productId);
        return {
            productId,
            productName: product?.name || 'Unknown',
            quantity,
            unitPrice: product?.price || 0
        };
    });

    try {
        const result = await createOrder({
            customerId: generateUUID(),
            customerEmail,
            customerName,
            items,
            notes
        });

        // Show result
        document.getElementById('resultOrderId').textContent = result.order.id;
        document.getElementById('resultCorrelationId').textContent = result.order.correlationId || result.correlationId;
        document.getElementById('resultStatus').textContent = result.order.status;
        document.getElementById('resultStatus').className = `detail-value status-badge ${result.order.status}`;
        document.getElementById('orderResult').classList.remove('hidden');

        showToast('Order created successfully!', 'success');

        // Clear selection
        selectedProducts = {};
        renderProducts();

        // Refresh orders
        loadOrders();

    } catch (error) {
        showToast(`Failed to create order: ${error.message}`, 'error');
    }
}

/**
 * Create demo order (quick button)
 */
async function createDemoOrder() {
    if (products.length === 0) {
        showToast('No products available', 'warning');
        return;
    }

    // Select random products
    const randomProducts = products.slice(0, Math.min(3, products.length));
    const items = randomProducts.map(p => ({
        productId: p.id,
        productName: p.name,
        quantity: Math.floor(Math.random() * 3) + 1,
        unitPrice: p.price
    }));

    try {
        const result = await createOrder({
            customerId: generateUUID(),
            customerEmail: 'demo@integrahub.test',
            customerName: 'Demo Customer',
            items,
            notes: 'Auto-generated demo order'
        });

        document.getElementById('resultOrderId').textContent = result.order.id;
        document.getElementById('resultCorrelationId').textContent = result.order.correlationId || result.correlationId;
        document.getElementById('resultStatus').textContent = result.order.status;
        document.getElementById('resultStatus').className = `detail-value status-badge ${result.order.status}`;
        document.getElementById('orderResult').classList.remove('hidden');

        showToast('Demo order created!', 'success');
        loadOrders();

    } catch (error) {
        showToast(`Failed to create demo order: ${error.message}`, 'error');
    }
}

/**
 * Load orders list
 */
async function loadOrders() {
    try {
        const status = document.getElementById('statusFilter').value;
        const data = await getOrders(status);
        renderOrders(data.orders || []);
    } catch (error) {
        console.error('Failed to load orders:', error);
        document.getElementById('ordersTableBody').innerHTML = 
            '<tr><td colspan="7" class="loading-row">Failed to load orders</td></tr>';
    }
}

/**
 * Render orders table
 */
function renderOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td><code>${order.id.substring(0, 8)}...</code></td>
            <td><code>${order.correlation_id.substring(0, 8)}...</code></td>
            <td>${order.customer_name || 'N/A'}</td>
            <td>$${parseFloat(order.total_amount).toFixed(2)}</td>
            <td><span class="status-badge ${order.status}">${order.status}</span></td>
            <td>${new Date(order.created_at).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="viewOrderDetails('${order.id}')">
                    View
                </button>
                <button class="btn btn-sm btn-link" onclick="trackOrder('${order.correlation_id}')">
                    Track
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Track order from input
 */
function trackOrderFromInput() {
    const input = document.getElementById('trackingInput').value.trim();
    if (input) {
        trackOrder(input);
    }
}

/**
 * Track order by ID or Correlation ID
 */
async function trackOrder(id) {
    const resultDiv = document.getElementById('trackingResult');
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = '<p>Loading...</p>';

    try {
        let data;
        
        // Try correlation ID first, then order ID
        try {
            data = await getOrderByCorrelation(id);
        } catch (e) {
            data = await getOrderById(id);
            data = { order: data, eventTimeline: data.events || [] };
        }

        const order = data.order;
        const events = data.eventTimeline || [];

        resultDiv.innerHTML = `
            <div class="tracking-header">
                <h3>Order: ${order.id}</h3>
                <span class="status-badge ${order.status}">${order.status}</span>
            </div>
            <div class="tracking-info">
                <p><strong>Correlation ID:</strong> <code>${order.correlation_id}</code></p>
                <p><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>
                <p><strong>Total:</strong> $${parseFloat(order.total_amount).toFixed(2)}</p>
                <p><strong>Created:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            </div>
            <h4>Event Timeline</h4>
            <div class="timeline">
                ${events.length > 0 ? events.map(event => `
                    <div class="timeline-item">
                        <div class="event-type">${event.eventType || event.event_type}</div>
                        <div class="event-time">${new Date(event.timestamp || event.created_at).toLocaleString()}</div>
                    </div>
                `).join('') : '<p>No events recorded yet</p>'}
            </div>
        `;

        // Fill tracking input
        document.getElementById('trackingInput').value = id;

    } catch (error) {
        resultDiv.innerHTML = `<p class="error">Order not found: ${error.message}</p>`;
    }
}

/**
 * View order details in modal
 */
async function viewOrderDetails(orderId) {
    const modal = document.getElementById('orderModal');
    const modalBody = document.getElementById('modalBody');

    modal.classList.remove('hidden');
    modalBody.innerHTML = '<p>Loading...</p>';

    try {
        const order = await getOrderById(orderId);

        modalBody.innerHTML = `
            <div class="order-details">
                <div class="detail-section">
                    <h4>Order Information</h4>
                    <p><strong>Order ID:</strong> <code>${order.id}</code></p>
                    <p><strong>Correlation ID:</strong> <code>${order.correlation_id}</code></p>
                    <p><strong>Status:</strong> <span class="status-badge ${order.status}">${order.status}</span></p>
                    <p><strong>Created:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div class="detail-section">
                    <h4>Customer</h4>
                    <p><strong>Name:</strong> ${order.customer_name || 'N/A'}</p>
                    <p><strong>Email:</strong> ${order.customer_email || 'N/A'}</p>
                </div>
                <div class="detail-section">
                    <h4>Items</h4>
                    ${order.items && order.items.length > 0 ? `
                        <table class="items-table">
                            <tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
                            ${order.items.map(item => `
                                <tr>
                                    <td>${item.product_name}</td>
                                    <td>${item.quantity}</td>
                                    <td>$${parseFloat(item.unit_price).toFixed(2)}</td>
                                    <td>$${parseFloat(item.subtotal).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </table>
                    ` : '<p>No items</p>'}
                </div>
                <div class="detail-section">
                    <h4>Total: $${parseFloat(order.total_amount).toFixed(2)}</h4>
                </div>
            </div>
        `;

    } catch (error) {
        modalBody.innerHTML = `<p class="error">Failed to load order: ${error.message}</p>`;
    }
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('orderModal').classList.add('hidden');
}

/**
 * Load analytics data
 */
async function loadAnalytics() {
    try {
        const [realtime, summary] = await Promise.all([
            getRealtimeAnalytics(),
            getAnalyticsSummary()
        ]);

        // Update metrics
        if (summary && summary.allTime) {
            document.getElementById('metricTotalOrders').textContent = summary.allTime.total_orders || 0;
            document.getElementById('metricConfirmed').textContent = summary.allTime.confirmed_orders || 0;
            document.getElementById('metricRejected').textContent = summary.allTime.rejected_orders || 0;
            document.getElementById('metricRevenue').textContent = 
                `$${parseFloat(summary.allTime.total_revenue || 0).toFixed(2)}`;
        } else if (realtime) {
            document.getElementById('metricTotalOrders').textContent = realtime.ordersCreated || 0;
            document.getElementById('metricConfirmed').textContent = realtime.ordersConfirmed || 0;
            document.getElementById('metricRejected').textContent = realtime.ordersRejected || 0;
            document.getElementById('metricRevenue').textContent = 
                `$${parseFloat(realtime.totalRevenue || 0).toFixed(2)}`;
        }

        // Update recent events
        if (realtime && realtime.recentEvents) {
            renderRecentEvents(realtime.recentEvents);
        }

    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

/**
 * Render recent events
 */
function renderRecentEvents(events) {
    const eventsList = document.getElementById('recentEventsList');

    if (!events || events.length === 0) {
        eventsList.innerHTML = '<div class="event-item">No recent events</div>';
        return;
    }

    eventsList.innerHTML = events.slice(0, 10).map(event => `
        <div class="event-item">
            <div class="event-info">
                <span class="event-type">${event.eventType}</span>
                <span class="event-order">${event.orderId?.substring(0, 8)}...</span>
            </div>
            <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
        </div>
    `).join('');
}

/**
 * Load notifications
 */
async function loadNotifications() {
    try {
        const data = await getRecentNotifications();
        renderNotifications(data.notifications || []);
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

/**
 * Render notifications
 */
function renderNotifications(notifications) {
    const list = document.getElementById('notificationsList');

    if (!notifications || notifications.length === 0) {
        list.innerHTML = '<div class="notification-item">No recent notifications</div>';
        return;
    }

    list.innerHTML = notifications.slice(0, 20).map(notif => `
        <div class="notification-item ${notif.type}">
            <div class="notification-header">
                <span class="notification-type">${notif.eventType} (${notif.type})</span>
                <span class="notification-time">${new Date(notif.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="notification-content">
                Order: ${notif.orderId?.substring(0, 8)}... | ${notif.subject || notif.content || ''}
            </div>
        </div>
    `).join('');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Handle ESC key for modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});
