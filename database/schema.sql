-- =============================================
-- POS Restaurant System - Database Schema
-- Supabase PostgreSQL
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS TABLE
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'cashier')),
    pin_code VARCHAR(6) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for PIN lookup during login
CREATE INDEX idx_users_pin ON users(pin_code) WHERE is_active = true;

-- =============================================
-- 2. MENUS TABLE
-- =============================================
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for category filtering
CREATE INDEX idx_menus_category ON menus(category) WHERE is_active = true;
CREATE INDEX idx_menus_active ON menus(is_active);

-- =============================================
-- 3. DAILY MENU STOCKS TABLE
-- Tracks daily stock per menu item
-- stock_remaining CAN be negative (Force Order feature)
-- =============================================
CREATE TABLE daily_menu_stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    stock_start INTEGER NOT NULL DEFAULT 0,
    stock_sold INTEGER NOT NULL DEFAULT 0,
    -- stock_remaining is computed: stock_start - stock_sold
    -- It CAN be negative when "Force Order" is used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per menu per day
    UNIQUE(date, menu_id)
);

-- Index for daily lookups
CREATE INDEX idx_daily_stocks_date ON daily_menu_stocks(date);
CREATE INDEX idx_daily_stocks_menu ON daily_menu_stocks(menu_id);

-- =============================================
-- 4. TRANSACTIONS TABLE
-- =============================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
    payment_method VARCHAR(50), -- NULL until paid: 'cash', 'edc_bca', 'edc_mandiri', 'qris', 'transfer'
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(12, 2) DEFAULT 0,
    change_amount DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    cashier_id UUID REFERENCES users(id),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for open bills lookup
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_table ON transactions(table_number) WHERE status = 'open';
CREATE INDEX idx_transactions_date ON transactions(created_at);
CREATE INDEX idx_transactions_paid_date ON transactions(paid_at) WHERE status = 'paid';

-- =============================================
-- 5. TRANSACTION ITEMS TABLE
-- =============================================
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    menu_id UUID NOT NULL REFERENCES menus(id),
    menu_name VARCHAR(150) NOT NULL, -- Denormalized for historical accuracy
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_time DECIMAL(12, 2) NOT NULL, -- Price snapshot at order time
    subtotal DECIMAL(12, 2) NOT NULL, -- quantity * price_at_time
    notes TEXT, -- Special requests: "Pedas level 3", "Tanpa bawang"
    is_force_order BOOLEAN DEFAULT false, -- True if ordered when stock was <= 0
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for transaction lookups
CREATE INDEX idx_transaction_items_tx ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_menu ON transaction_items(menu_id);

-- =============================================
-- 6. SETTLEMENTS TABLE (End of Day Reconciliation)
-- =============================================
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    cashier_id UUID NOT NULL REFERENCES users(id),
    
    -- System calculated totals
    system_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
    system_edc DECIMAL(12, 2) NOT NULL DEFAULT 0,
    system_transfer DECIMAL(12, 2) NOT NULL DEFAULT 0,
    system_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Actual physical count input
    actual_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
    actual_edc DECIMAL(12, 2) NOT NULL DEFAULT 0,
    actual_transfer DECIMAL(12, 2) NOT NULL DEFAULT 0,
    actual_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Variance
    variance_cash DECIMAL(12, 2) GENERATED ALWAYS AS (actual_cash - system_cash) STORED,
    variance_edc DECIMAL(12, 2) GENERATED ALWAYS AS (actual_edc - system_edc) STORED,
    variance_total DECIMAL(12, 2) GENERATED ALWAYS AS (actual_total - system_total) STORED,
    variance_reason TEXT, -- Required if variance != 0
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'reviewed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for date lookups
CREATE INDEX idx_settlements_date ON settlements(date);

-- =============================================
-- VIEWS
-- =============================================

-- View: Daily stock with remaining calculation
CREATE OR REPLACE VIEW v_daily_menu_stocks AS
SELECT 
    dms.id,
    dms.date,
    dms.menu_id,
    m.name AS menu_name,
    m.category,
    m.price,
    dms.stock_start,
    dms.stock_sold,
    (dms.stock_start - dms.stock_sold) AS stock_remaining,
    m.is_active,
    dms.created_at,
    dms.updated_at
FROM daily_menu_stocks dms
JOIN menus m ON m.id = dms.menu_id;

-- View: Open transactions by table
CREATE OR REPLACE VIEW v_open_tables AS
SELECT 
    t.id AS transaction_id,
    t.table_number,
    t.total_amount,
    t.created_at,
    t.notes,
    COUNT(ti.id) AS item_count,
    u.name AS cashier_name
FROM transactions t
LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
LEFT JOIN users u ON u.id = t.cashier_id
WHERE t.status = 'open'
GROUP BY t.id, t.table_number, t.total_amount, t.created_at, t.notes, u.name;

-- View: Daily sales summary
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT 
    DATE(paid_at) AS sale_date,
    COUNT(*) AS total_transactions,
    SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END) AS cash_total,
    SUM(CASE WHEN payment_method LIKE 'edc%' THEN total_amount ELSE 0 END) AS edc_total,
    SUM(CASE WHEN payment_method = 'qris' THEN total_amount ELSE 0 END) AS qris_total,
    SUM(CASE WHEN payment_method = 'transfer' THEN total_amount ELSE 0 END) AS transfer_total,
    SUM(total_amount) AS grand_total
FROM transactions
WHERE status = 'paid'
GROUP BY DATE(paid_at);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function: Update transaction total
CREATE OR REPLACE FUNCTION fn_update_transaction_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE transactions 
    SET 
        subtotal = (
            SELECT COALESCE(SUM(subtotal), 0) 
            FROM transaction_items 
            WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
        ),
        total_amount = (
            SELECT COALESCE(SUM(subtotal), 0) 
            FROM transaction_items 
            WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
        ) - COALESCE(discount_amount, 0),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update transaction total on item changes
CREATE TRIGGER trg_update_transaction_total
AFTER INSERT OR UPDATE OR DELETE ON transaction_items
FOR EACH ROW EXECUTE FUNCTION fn_update_transaction_total();

-- Function: Update stock sold when item is added
CREATE OR REPLACE FUNCTION fn_update_stock_on_order()
RETURNS TRIGGER AS $$
DECLARE
    today DATE := CURRENT_DATE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment stock_sold
        UPDATE daily_menu_stocks 
        SET 
            stock_sold = stock_sold + NEW.quantity,
            updated_at = NOW()
        WHERE menu_id = NEW.menu_id AND date = today;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement stock_sold (for voided items)
        UPDATE daily_menu_stocks 
        SET 
            stock_sold = stock_sold - OLD.quantity,
            updated_at = NOW()
        WHERE menu_id = OLD.menu_id AND date = today;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Adjust stock_sold based on quantity change
        UPDATE daily_menu_stocks 
        SET 
            stock_sold = stock_sold - OLD.quantity + NEW.quantity,
            updated_at = NOW()
        WHERE menu_id = NEW.menu_id AND date = today;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update stock on order
CREATE TRIGGER trg_update_stock_on_order
AFTER INSERT OR UPDATE OR DELETE ON transaction_items
FOR EACH ROW EXECUTE FUNCTION fn_update_stock_on_order();

-- Function: Update timestamps
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers: Auto-update timestamps
CREATE TRIGGER trg_users_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_menus_timestamp BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_daily_stocks_timestamp BEFORE UPDATE ON daily_menu_stocks FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_transactions_timestamp BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_settlements_timestamp BEFORE UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- =============================================
-- SEED DATA (Sample)
-- =============================================

-- Sample Users
INSERT INTO users (name, role, pin_code) VALUES
('Pak Budi', 'owner', '123456'),
('Siti', 'cashier', '111111'),
('Dewi', 'cashier', '222222');

-- Sample Menu Categories & Items
INSERT INTO menus (name, price, category, description) VALUES
-- Makanan Utama
('Nasi Goreng Spesial', 25000, 'Makanan Utama', 'Nasi goreng dengan telur, ayam, dan kerupuk'),
('Mie Goreng', 22000, 'Makanan Utama', 'Mie goreng dengan sayuran dan telur'),
('Nasi Ayam Bakar', 30000, 'Makanan Utama', 'Nasi dengan ayam bakar bumbu kecap'),
('Nasi Ayam Goreng', 28000, 'Makanan Utama', 'Nasi dengan ayam goreng crispy'),
('Nasi Campur', 32000, 'Makanan Utama', 'Nasi dengan berbagai lauk'),
('Soto Ayam', 20000, 'Makanan Utama', 'Soto ayam dengan kuah bening'),
('Bakso', 18000, 'Makanan Utama', 'Bakso sapi dengan mie dan tahu'),

-- Minuman
('Es Teh Manis', 5000, 'Minuman', 'Teh manis dingin'),
('Es Jeruk', 7000, 'Minuman', 'Jeruk peras dingin'),
('Kopi Hitam', 6000, 'Minuman', 'Kopi tubruk'),
('Es Campur', 12000, 'Minuman', 'Es campur dengan berbagai topping'),
('Jus Alpukat', 15000, 'Minuman', 'Jus alpukat segar'),
('Air Mineral', 4000, 'Minuman', 'Air mineral botol'),
('Teh Hangat', 4000, 'Minuman', 'Teh manis hangat'),

-- Snack / Tambahan
('Kerupuk', 3000, 'Snack', 'Kerupuk udang'),
('Tahu Goreng', 8000, 'Snack', 'Tahu goreng crispy 5 pcs'),
('Tempe Goreng', 8000, 'Snack', 'Tempe goreng 5 pcs'),
('Pisang Goreng', 10000, 'Snack', 'Pisang goreng 4 pcs'),
('Gorengan Campur', 12000, 'Snack', 'Berbagai gorengan');

-- Sample Daily Stock (for today)
INSERT INTO daily_menu_stocks (date, menu_id, stock_start, stock_sold)
SELECT 
    CURRENT_DATE,
    id,
    CASE 
        WHEN category = 'Makanan Utama' THEN 30
        WHEN category = 'Minuman' THEN 50
        ELSE 20
    END,
    0
FROM menus;

-- =============================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- =============================================

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_menu_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

-- Policies: Allow all for authenticated users (adjust as needed)
CREATE POLICY "Allow all for authenticated" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON menus FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON daily_menu_stocks FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON transaction_items FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON settlements FOR ALL USING (true);
