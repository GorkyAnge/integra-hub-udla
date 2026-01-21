-- ===========================================
-- IntegraHub - Database Initialization Script
-- ===========================================

-- Create schemas
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS auth;

-- ===========================================
-- AUTH SCHEMA
-- ===========================================

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(100) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['read', 'write'],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default OAuth2 client
INSERT INTO auth.clients (client_id, client_secret, name, scopes)
VALUES ('integrahub-client', '$2b$10$rICHphZ5H3bU7ue8Z5Gx3OE8k1WxKp7kqRG5tNJlJFH1VkQ2K3K7S', 'IntegraHub Demo Client', ARRAY['read', 'write', 'admin'])
ON CONFLICT (client_id) DO NOTHING;

-- Insert demo user
INSERT INTO auth.users (username, email, password_hash, role)
VALUES ('admin', 'admin@integrahub.local', '$2b$10$rICHphZ5H3bU7ue8Z5Gx3OE8k1WxKp7kqRG5tNJlJFH1VkQ2K3K7S', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ===========================================
-- ORDERS SCHEMA
-- ===========================================

CREATE TABLE IF NOT EXISTS orders.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING',
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    shipping_address JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders.order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders.orders(id) ON DELETE CASCADE,
    correlation_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Idempotency table for message deduplication
CREATE TABLE IF NOT EXISTS orders.processed_messages (
    message_id UUID PRIMARY KEY,
    order_id UUID,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_orders_correlation ON orders.orders(correlation_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_events_correlation ON orders.order_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_processed_messages_expires ON orders.processed_messages(expires_at);

-- ===========================================
-- INVENTORY SCHEMA
-- ===========================================

CREATE TABLE IF NOT EXISTS inventory.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    quantity_available INTEGER DEFAULT 0,
    quantity_reserved INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    product_id UUID REFERENCES inventory.products(id),
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'RESERVED',
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES inventory.products(id),
    movement_type VARCHAR(50) NOT NULL, -- IN, OUT, RESERVE, RELEASE
    quantity INTEGER NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON inventory.products(sku);
CREATE INDEX IF NOT EXISTS idx_reservations_order ON inventory.reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON inventory.stock_movements(product_id);

-- Insert sample products
INSERT INTO inventory.products (sku, name, description, category, price, quantity_available)
VALUES 
    ('LAPTOP-001', 'Laptop Pro 15"', 'Professional laptop with 16GB RAM', 'Electronics', 1299.99, 50),
    ('PHONE-001', 'SmartPhone X', 'Latest smartphone with 5G', 'Electronics', 899.99, 100),
    ('TABLET-001', 'Tablet Ultra', '10-inch tablet with stylus', 'Electronics', 599.99, 75),
    ('HEADPHONES-001', 'Wireless Headphones', 'Noise-cancelling headphones', 'Accessories', 299.99, 200),
    ('CHARGER-001', 'Fast Charger 65W', 'Universal fast charger', 'Accessories', 49.99, 500),
    ('CASE-001', 'Protective Case', 'Shockproof phone case', 'Accessories', 29.99, 1000),
    ('KEYBOARD-001', 'Mechanical Keyboard', 'RGB gaming keyboard', 'Peripherals', 149.99, 150),
    ('MOUSE-001', 'Wireless Mouse', 'Ergonomic wireless mouse', 'Peripherals', 79.99, 300),
    ('MONITOR-001', 'Monitor 27" 4K', 'Ultra HD monitor', 'Electronics', 449.99, 40),
    ('WEBCAM-001', 'HD Webcam', '1080p webcam with mic', 'Peripherals', 89.99, 250)
ON CONFLICT (sku) DO NOTHING;

-- ===========================================
-- PAYMENTS SCHEMA
-- ===========================================

CREATE TABLE IF NOT EXISTS payments.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    gateway_reference VARCHAR(255),
    gateway_response JSONB,
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES payments.transactions(id),
    amount DECIMAL(12, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'PENDING',
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_order ON payments.transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_correlation ON payments.transactions(correlation_id);

-- ===========================================
-- NOTIFICATIONS SCHEMA
-- ===========================================

CREATE TABLE IF NOT EXISTS notifications.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL, -- EMAIL, SMS, WEBHOOK, PUSH
    subject VARCHAR(255),
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    sent_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    channel VARCHAR(50) NOT NULL,
    subject VARCHAR(255),
    content TEXT NOT NULL,
    variables JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_correlation ON notifications.notifications(correlation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications.notifications(status);

-- Insert notification templates
INSERT INTO notifications.templates (name, channel, subject, content, variables)
VALUES 
    ('order_created', 'EMAIL', 'Order Confirmation - {{order_id}}', 'Your order {{order_id}} has been received. Total: {{total}}', '{"order_id": "string", "total": "number"}'),
    ('order_confirmed', 'EMAIL', 'Order Confirmed - {{order_id}}', 'Your order {{order_id}} has been confirmed and is being processed.', '{"order_id": "string"}'),
    ('order_rejected', 'EMAIL', 'Order Issue - {{order_id}}', 'Unfortunately, there was an issue with your order {{order_id}}. Reason: {{reason}}', '{"order_id": "string", "reason": "string"}'),
    ('payment_success', 'EMAIL', 'Payment Received - {{order_id}}', 'Payment of {{amount}} for order {{order_id}} was successful.', '{"order_id": "string", "amount": "number"}'),
    ('ops_notification', 'WEBHOOK', 'Operations Alert', '{"event": "{{event_type}}", "order_id": "{{order_id}}", "timestamp": "{{timestamp}}"}', '{"event_type": "string", "order_id": "string", "timestamp": "string"}')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- ANALYTICS SCHEMA
-- ===========================================

CREATE TABLE IF NOT EXISTS analytics.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    source_service VARCHAR(100) NOT NULL,
    correlation_id UUID,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics.order_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    hour INTEGER,
    total_orders INTEGER DEFAULT 0,
    confirmed_orders INTEGER DEFAULT 0,
    rejected_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(14, 2) DEFAULT 0,
    avg_order_value DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, hour)
);

CREATE TABLE IF NOT EXISTS analytics.inventory_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    product_id UUID,
    product_sku VARCHAR(100),
    units_sold INTEGER DEFAULT 0,
    units_reserved INTEGER DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics.events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics.events(created_at);
CREATE INDEX IF NOT EXISTS idx_order_metrics_date ON analytics.order_metrics(date);

-- ===========================================
-- LEGACY INTEGRATION SCHEMA
-- ===========================================

CREATE TABLE IF NOT EXISTS inventory.csv_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- CLEANUP FUNCTION FOR EXPIRED MESSAGES
-- ===========================================

CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM orders.processed_messages WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create extension for scheduling (optional)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
