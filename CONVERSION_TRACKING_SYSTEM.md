# Naay Agent Conversion Tracking System

## Overview

The Conversion Tracking System provides comprehensive attribution and analytics for AI assistant recommendations, tracking the full customer journey from AI recommendation through cart addition to completed purchases. This system enables merchants to understand the direct impact of their AI assistant on sales and revenue.

## System Architecture

### Database Schema

The system uses five core tables to track the conversion funnel:

1. **`ai_recommendation_events`** - Every product recommendation made by the AI
2. **`cart_addition_events`** - Products added to cart (from any source)
3. **`order_completion_events`** - Completed orders with financial data
4. **`order_line_items`** - Individual products within orders
5. **`attribution_events`** - Links recommendations to conversions with attribution logic

### Data Flow

```
AI Recommendation → Cart Addition → Order Completion
       ↓                ↓              ↓
   Tracked in        Tracked in     Tracked in
 recommendation     cart_addition  order_completion
    events            events         events
       ↓                ↓              ↓
             ↘    Attribution Logic   ↙
                  attribution_events
```

## Key Features

### 1. Real-time Recommendation Tracking

- Automatically extracts product recommendations from AI responses
- Tracks recommendation context (search query, intent, type)
- Records position and confidence scores
- Links to chat sessions and customer data

### 2. Multi-Source Cart Attribution

- Tracks cart additions from AI widget, direct adds, search, and browsing
- Links cart events to specific AI recommendations when applicable
- Handles multiple attribution windows (default: 30 days)

### 3. Purchase Attribution

- Tracks completed orders via Shopify webhooks
- Calculates attributed revenue for AI recommendations
- Handles multi-touch attribution scenarios
- Normalizes over-attribution automatically

### 4. Time-Window Attribution

- Configurable attribution windows (default: 720 hours / 30 days)
- Tracks time-to-conversion metrics
- Supports both direct and assisted conversions

### 5. Analytics & Reporting

- Comprehensive conversion funnel metrics
- Product performance analysis
- Recommendation type effectiveness
- Cohort analysis and time-based trends
- Export capabilities for external analysis

## Implementation Details

### AI Agent Integration

The `AIAgentService` automatically tracks recommendations:

```typescript
// Tracks recommendations from agent responses
await this.conversionTrackingService.trackAIRecommendations(
  sessionId,
  shop,
  response,
  messageId,
  customerId,
  cartId
);
```

### Cart Service Integration

Cart additions include conversion tracking context:

```typescript
// Enhanced cart addition with attribution
await cartService.addToCart(
  shop, 
  cartId, 
  lineItems,
  sessionId,      // For linking to AI recommendations
  customerId,     // For cross-session attribution
  'ai_recommendation'  // Source tracking
);
```

### Webhook Integration

Order webhooks automatically track conversions:

- `orders/create` - Tracks new orders
- `orders/paid` - Updates payment status
- `orders/updated` - Tracks fulfillment changes

## API Endpoints

### Public Analytics API (`/api/analytics/conversion/`)

- `GET /metrics` - Comprehensive conversion metrics
- `GET /funnel` - Step-by-step conversion funnel
- `GET /top-products` - Top converting products
- `GET /recommendation-types` - Performance by recommendation type
- `GET /time-to-conversion` - Time-based conversion metrics
- `GET /cohort-analysis` - Cohort conversion analysis
- `GET /session-funnel/:sessionId` - Session-specific metrics

### Admin Analytics API (`/api/admin/analytics/conversion/`)

- `GET /dashboard` - Complete dashboard data
- `GET /performance-summary` - Key performance indicators
- `GET /detailed-breakdown` - Detailed analytics breakdown
- `GET /ai-impact` - AI impact and ROI analysis
- `POST /export` - Export analytics data

### Management API

- `POST /calculate-attribution` - Manual attribution calculation
- `POST /generate-snapshot` - Generate analytics snapshots
- `DELETE /cleanup/:shop` - Data retention cleanup

## Configuration

### Attribution Settings

```typescript
// Default attribution window: 30 days
const ATTRIBUTION_WINDOW_HOURS = 720;

// Default data retention: 1 year
const RETENTION_DAYS = 365;
```

### Data Retention Policy

- **Recommendation events**: 1 year retention (configurable)
- **Cart events**: 1 year retention (configurable)
- **Order events**: Permanent (for accounting compliance)
- **Attribution events**: Cleaned up with recommendations

## Analytics Capabilities

### Conversion Funnel Analysis

Track the complete journey:
1. **AI Recommendations Made** - Total recommendations by the AI
2. **Products Added to Cart** - Conversions to cart additions
3. **Completed Purchases** - Final conversions to sales

### Key Performance Indicators (KPIs)

- **Total Attributed Revenue** - Revenue directly attributed to AI recommendations
- **Conversion Rate** - Percentage of recommendations that convert to purchases
- **Average Order Value** - Average purchase value from AI recommendations
- **Time to Conversion** - Average time from recommendation to purchase
- **Return on AI Investment** - ROI calculation for the AI system

### Product Performance Analysis

- **Top Converting Products** - Products with highest conversion rates from AI recommendations
- **Revenue per Product** - Total attributed revenue by product
- **Recommendation Effectiveness** - Conversion rate by recommendation type

### Recommendation Type Performance

Track effectiveness by recommendation strategy:
- `search_result` - Products shown in search results
- `related_product` - Products suggested as related items
- `complementary` - Products that complement cart items
- `upsell` - Higher-value product suggestions
- `popular` - Generally popular products
- `semantic_match` - AI-powered semantic matches

## Database Functions

### Attribution Calculation

```sql
-- Calculate attribution for a shop
SELECT calculate_attribution(
  'shop-domain.myshopify.com',  -- Shop domain
  720,                          -- Attribution window (hours)
  30                           -- Lookback days
);
```

### Analytics Snapshots

```sql
-- Generate daily analytics snapshot
SELECT generate_conversion_snapshot(
  'shop-domain.myshopify.com',  -- Shop domain
  '2024-01-01',                 -- Start date
  '2024-01-31',                 -- End date
  'daily'                       -- Snapshot type
);
```

### Performance Queries

```sql
-- Get top converting products
SELECT * FROM get_top_converting_products(
  'shop-domain.myshopify.com',
  '2024-01-01',
  '2024-01-31',
  10  -- Limit
);

-- Get time to conversion metrics
SELECT * FROM get_time_to_conversion_metrics(
  'shop-domain.myshopify.com',
  '2024-01-01',
  '2024-01-31'
);
```

## Privacy and Compliance

### Data Privacy

- No personally identifiable information (PII) stored in recommendation events
- Customer IDs are Shopify's encrypted customer IDs
- Email addresses only stored if provided explicitly for cart attribution

### GDPR Compliance

- Data retention policies configurable by merchant
- Automatic cleanup of old tracking data
- Customer data deletion when store is uninstalled

### Data Retention

```typescript
// Clean up data older than specified retention period
await conversionTrackingService.cleanupOldData(
  shopDomain, 
  365  // Retention days
);
```

## Monitoring and Maintenance

### Health Checks

- Attribution conflict detection
- Data quality monitoring
- Revenue attribution normalization

### Maintenance Tasks

1. **Daily**: Run attribution calculation for active shops
2. **Weekly**: Generate analytics snapshots
3. **Monthly**: Clean up old data based on retention policies
4. **Quarterly**: Normalize attribution weights for over-attributed orders

### Performance Optimization

- Indexed queries for fast analytics retrieval
- Pre-computed daily snapshots for dashboard performance
- Batch processing for attribution calculations

## Usage Examples

### Track AI Recommendation

```typescript
// Automatic tracking in AI Agent Service
const recommendations = await conversionTrackingService.trackAIRecommendations(
  sessionId,
  shopDomain,
  agentResponse,
  messageId,
  customerId,
  cartId
);
```

### Track Cart Addition

```typescript
// Track cart addition with AI attribution
await conversionTrackingService.trackCartAddition({
  shopDomain: 'shop.myshopify.com',
  cartId: 'cart123',
  customerId: 'customer456',
  productId: 'product789',
  variantId: 'variant101',
  quantity: 2,
  unitPrice: 29.99,
  source: 'ai_recommendation',
  sessionId: 'session123'
});
```

### Track Order Completion

```typescript
// Automatic tracking via order webhooks
await conversionTrackingService.trackOrderCompletion({
  shopDomain: 'shop.myshopify.com',
  orderId: 'order123',
  customerId: 'customer456',
  totalAmount: 89.97,
  orderCreatedAt: new Date(),
  lineItems: [...]
});
```

### Get Conversion Metrics

```typescript
// Get comprehensive conversion metrics
const metrics = await conversionTrackingService.getConversionMetrics(
  'shop.myshopify.com',
  new Date('2024-01-01'),  // From date
  new Date('2024-01-31'),  // To date
  true                     // Include breakdowns
);
```

## Integration Guide

### Frontend Widget Integration

Update cart addition calls to include tracking context:

```javascript
// Add session and source context to cart additions
await addToCart({
  shop: 'shop.myshopify.com',
  variantId: '12345',
  quantity: 1,
  sessionId: chatSessionId,      // From chat widget
  source: 'ai_recommendation',   // Specify source
  customerId: customerInfo?.id   // If available
});
```

### Admin Dashboard Integration

Use admin analytics endpoints for dashboard displays:

```javascript
// Fetch dashboard data
const dashboardData = await fetch('/api/admin/analytics/conversion/dashboard?shop=shop.myshopify.com&period=30d');

// Display conversion funnel
const funnelData = await fetch('/api/admin/analytics/conversion/funnel?shop=shop.myshopify.com');
```

## Shopify Best Practices

### Webhook Configuration

Ensure the following webhooks are configured in your Shopify app:

- `orders/create` - For tracking new orders
- `orders/paid` - For payment status updates
- `orders/updated` - For order status changes

### Rate Limiting

- Attribution calculations are batched to respect Shopify API limits
- Real-time tracking uses efficient database operations
- Background jobs handle heavy processing

### Data Accuracy

- Webhook verification ensures data integrity
- Duplicate detection prevents double-counting
- Attribution normalization handles conflicts

## Troubleshooting

### Common Issues

1. **Missing Attributions**: Check attribution window settings and ensure webhooks are properly configured
2. **Over-Attribution**: Run attribution normalization to fix revenue discrepancies
3. **Performance Issues**: Ensure analytics snapshots are being generated regularly

### Debug Endpoints

- `GET /api/analytics/conversion/session-funnel/:sessionId` - Debug specific session tracking
- `POST /api/analytics/conversion/calculate-attribution` - Manual attribution recalculation
- Database function `detect_attribution_conflicts()` - Find attribution issues

## Future Enhancements

### Planned Features

1. **Machine Learning Attribution** - AI-powered attribution modeling
2. **Cross-Channel Tracking** - Integration with email and social media
3. **A/B Testing Framework** - Test different recommendation strategies
4. **Real-time Alerts** - Notifications for conversion anomalies
5. **Advanced Segmentation** - Customer behavior analysis

### Extensibility

The system is designed to be extended with:
- Custom attribution models
- Additional conversion events
- External analytics integrations
- Advanced reporting features

## Conclusion

The Conversion Tracking System provides comprehensive visibility into AI assistant performance, enabling merchants to optimize their AI-powered shopping experience and maximize ROI. The system balances detailed tracking with privacy compliance, offering both real-time insights and historical analysis capabilities.