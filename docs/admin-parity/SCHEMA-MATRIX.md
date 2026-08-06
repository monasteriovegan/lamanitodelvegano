# Matriz de Esquema de Base de Datos (Makangru vs La Manito del Vegano)

| Tabla Fuente | Tabla Destino | Campos Principales | RLS | Estado |
|---|---|---|---|---|
| `categories` | `categories` | `id, name, slug, description, image_url, icon, is_active, sort_order` | Habilitado | COMPLETO |
| `products` | `productos` | `id, category_id, name, slug, tagline, description, story, price, compare_price, cost_price, sku, stock, low_stock_alert, weight_grams, images, ingredients, allergens, is_active, is_featured, is_new, tags` | Habilitado | COMPLETO |
| `customers` | `customers` | `id, user_id, email, first_name, last_name, full_name, phone, whatsapp, address_line1, city, region, postal_code, total_orders, total_spent, stage, tags, notes` | Habilitado | COMPLETO |
| `coupons` | `coupons` | `id, code, description, type, value, min_order_amount, max_discount, usage_limit, usage_count, is_active, expires_at` | Habilitado | COMPLETO |
| `orders` | `orders` | `id, order_number, legacy_order_id, customer_id, status, payment_status, source, subtotal, discount_amount, shipping_amount, total, payment_method, tracking_number, shipping_address, delivery_date, customer_email, customer_phone, customer_name, notes, admin_notes, paid_at, shipped_at, delivered_at` | Habilitado | COMPLETO |
| `order_items` | `order_items` | `id, order_id, product_id, product_name, product_sku, product_image, unit_price, quantity, subtotal` | Habilitado | COMPLETO |
| `N/A` | `order_status_history` | `id, order_id, status, payment_status, notes, created_by, created_at` | Habilitado | COMPLETO |
| `shipping_zones` | `shipping_zones` | `id, name, regions, price, free_above, min_days, max_days, is_active` | Habilitado | COMPLETO |
| `delivery_settings` | `delivery_settings` | `id, enabled_weekdays, min_advance_days, max_advance_days, cutoff_hour, delivery_message` | Habilitado | COMPLETO |
| `blocked_delivery_dates` | `blocked_delivery_dates` | `id, date, reason` | Habilitado | COMPLETO |
| `site_settings` | `site_settings` | `id, site_name, site_tagline, logo_url, whatsapp_number, transfer_bank_name, mp_public_key, meta_title` | Habilitado | COMPLETO |
| `blog_posts` | `blog_posts` | `id, title, slug, excerpt, content, cover_image, author_name, category, tags, is_published` | Habilitado | COMPLETO |
| `contact_messages` | `contact_messages` | `id, name, email, phone, subject, message, is_read` | Habilitado | COMPLETO |
| `ingredients` | `ingredients` | `id, name, category, unit, cost_per_unit, supplier, is_allergen, allergens, calories_per_100g` | Habilitado | COMPLETO |
| `recipes` | `recipes` | `id, name, product_id, yield_units, labor_minutes, overhead_percent, selling_price` | Habilitado | COMPLETO |
| `recipe_ingredients` | `recipe_ingredients` | `id, recipe_id, ingredient_id, quantity, unit` | Habilitado | COMPLETO |
| `store_reservations` | `store_reservations` | `id, customer_name, customer_email, customer_phone, reservation_date, reservation_time, status, type` | Habilitado | COMPLETO |
| `seasons` | `seasons` | `id, name, slug, description, starts_at, ends_at, color_start, color_end, is_active, banner_image` | Habilitado | COMPLETO |
| `season_products` | `season_products` | `id, season_id, product_id` | Habilitado | COMPLETO |

**Cobertura de Esquema: 100%**
