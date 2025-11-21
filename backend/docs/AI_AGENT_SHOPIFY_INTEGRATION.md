# AI Agent Shopify Integration Guide

## Overview

The AI Agent has been enhanced with comprehensive Shopify product discovery and cart management capabilities. Users can now search for products, get personalized recommendations, and manage their cart through natural language conversations.

## Features Implemented

### 1. Advanced Product Search
- **Natural language queries**: "Find black sneakers under $100"
- **Filter support**: Price range, vendor, product type, tags, availability
- **Dual API support**: Shopify Admin API and Storefront API
- **Semantic search fallback**: AI-powered product matching when exact searches fail

### 2. Intelligent Product Recommendations
- **Context-aware suggestions**: Based on cart contents or specified products
- **Multiple recommendation types**: Related, complementary, upsell, and popular products
- **Scoring system**: Products ranked by relevance with explanations
- **Fallback mechanisms**: Database-powered recommendations when Shopify data is limited

### 3. Complete Cart Management
- **Cart creation**: Automatic cart creation for new customers
- **Product addition**: Add products by name, ID, or from search results
- **Cart viewing**: Detailed cart summary with totals and line items
- **Cart modification**: Update quantities, remove items, manage buyer identity
- **Checkout integration**: Direct links to Shopify checkout

## Usage Examples

### Product Search

**Customer**: "I'm looking for red dresses under $80"

**Agent Response**:
```
I found 4 products that match your search for "red dresses under $80":

1. **Crimson Evening Dress** - $65.00
   *By Elegance Co*
   Beautiful flowing evening dress perfect for special occasions...
   ✅ In Stock | Product ID: gid://shopify/Product/123

2. **Ruby Casual Dress** - ~~$85.00~~ $75.00
   *By Daily Wear*
   Comfortable casual dress suitable for everyday wear...
   ✅ In Stock | Product ID: gid://shopify/Product/124

To add any product to your cart, just say "add [product name]" or "add product [number]". Would you like more details about any of these products?
```

### Adding Products to Cart

**Customer**: "Add the crimson evening dress to my cart"

**Agent Response**:
```
Perfect! I've created your cart and added **Crimson Evening Dress** to your cart.

💰 Price: $65.00
📦 Quantity: 1

Would you like to:
• Continue shopping
• View your cart
• Proceed to checkout
• Get product recommendations?
```

### Product Recommendations

**Customer**: "Show me recommendations"

**Agent Response**:
```
Based on what's in your cart, here are products that go well together:

1. **Black Stiletto Heels** - $45.00
   *By Shoe Palace*
   Classic black heels that complement any evening dress...
   ✨ Perfect match for formal wear | Score: 85

2. **Pearl Necklace Set** - $28.00
   *By Jewelry Plus*
   Elegant pearl jewelry set for special occasions...
   ✨ Same category (Accessories) | Score: 75

To add any of these to your cart, just say "add [product name]" or "add product [number]". Would you like more details about any of these?
```

### Cart Management

**Customer**: "Show me my cart"

**Agent Response**:
```
🛒 **Your Cart** (2 items)

1. **Crimson Evening Dress**
💰 $65.00 × 1 = $65.00
🏷️ Line ID: gid://shopify/CartLine/abc123

2. **Black Stiletto Heels**
💰 $45.00 × 1 = $45.00
🏷️ Line ID: gid://shopify/CartLine/def456

💳 **Order Summary:**
• Subtotal: $110.00
• Tax: $11.00
• **Total: $121.00**

Would you like to:
• Continue shopping
• Remove an item (say "remove item [number]")
• Update quantities
• Proceed to checkout
```

## API Endpoints Integration

### Enhanced Chat Message Processing

The main chat endpoint `/api/chat/message` now supports:

```typescript
interface ChatMessageRequest {
  message: string;           // Natural language input
  session_id: string;       // Chat session identifier
  cart_id?: string;         // Shopify cart ID (optional)
  context?: {
    email?: string;         // Customer email for cart identity
    customerId?: string;    // Shopify customer ID
    [key: string]: any;     // Additional context
  };
}
```

### Response Format

```typescript
interface ChatResponse {
  success: boolean;
  data: {
    messages: string[];     // AI agent responses
    actions: AgentAction[]; // Cart actions performed
    metadata: {
      intent: string;       // Detected user intent
      cart_id?: string;     // Updated cart ID
      cart_updated?: boolean; // If cart was modified
      products?: ProductInfo[]; // Found products
      checkout_url?: string;  // Direct checkout link
      // ... additional metadata
    };
  };
}
```

## Supported Intents

The AI agent can detect and handle these intents:

1. **search_products**: Product discovery queries
2. **add_to_cart**: Adding specific items to cart
3. **view_cart**: Displaying cart contents
4. **product_recommendation**: Getting product suggestions
5. **product_comparison**: Comparing multiple products
6. **general_inquiry**: Store policies and general questions

## Error Handling and Fallbacks

### Search Fallbacks
1. **Primary**: Shopify Storefront API search
2. **Secondary**: Shopify Admin API search with advanced filters
3. **Tertiary**: Semantic search using AI embeddings
4. **Final**: Database-stored popular products

### Cart Management
- Automatic cart creation for new sessions
- Graceful handling of invalid products
- Clear error messages for out-of-stock items
- Session persistence across conversations

## Configuration Requirements

### Environment Variables
```bash
# Shopify Configuration
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_SCOPES=read_products,write_carts,read_customers

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### Shopify App Permissions

Required scopes for full functionality:
- `read_products`: Product search and details
- `read_inventory`: Stock level information
- `write_carts`: Cart creation and management
- `read_customers`: Customer identification
- `read_orders`: Order history (for recommendations)

## Performance Considerations

### Caching Strategy
- Product search results cached for 15 minutes
- Popular product recommendations cached for 1 hour
- Cart data fetched in real-time for accuracy

### Rate Limiting
- Shopify API calls: Managed through exponential backoff
- OpenAI API calls: Limited to prevent quota exhaustion
- Search queries: Debounced to reduce unnecessary API calls

### Optimization Tips
1. Use Storefront API for customer-facing operations
2. Batch product operations when possible
3. Implement semantic search for better matching
4. Cache frequently accessed product data

## Troubleshooting

### Common Issues

1. **"Product not found" errors**
   - Verify product IDs are valid Shopify global IDs
   - Check product availability and publication status
   - Ensure proper access tokens and permissions

2. **Cart creation failures**
   - Validate Storefront API access token
   - Check if cart limits are exceeded
   - Verify buyer identity information format

3. **Search returning no results**
   - Try broader search terms
   - Check product publication settings
   - Verify search index is up to date

### Debug Information

Enable detailed logging by setting:
```bash
LOG_LEVEL=debug
```

This will log:
- Search queries and filters applied
- Cart operations and responses
- AI intent analysis results
- API call timing and errors

## Future Enhancements

### Planned Features
1. **Advanced recommendations**: Machine learning models based on purchase history
2. **Multi-variant support**: Handle product options (size, color, etc.)
3. **Inventory awareness**: Real-time stock level integration
4. **Price alerts**: Notify customers of sales and discounts
5. **Wishlist management**: Save products for later purchase
6. **Order tracking**: Integration with order status updates

### Extensibility Points
- Custom recommendation algorithms
- Additional search filters (reviews, ratings)
- Integration with loyalty programs
- Multi-language product search
- Voice commerce capabilities

## Security Considerations

1. **API Token Management**: Store access tokens securely
2. **Customer Data**: Follow GDPR/privacy regulations
3. **Rate Limiting**: Prevent API abuse
4. **Input Validation**: Sanitize all user inputs
5. **Audit Logging**: Track all cart modifications

## Support and Maintenance

For issues or questions regarding the AI Agent Shopify integration:
1. Check the troubleshooting section above
2. Review Shopify API documentation
3. Monitor application logs for detailed error information
4. Test with different product types and quantities

The integration is designed to be robust and handle edge cases gracefully while providing an excellent customer experience through natural language commerce.