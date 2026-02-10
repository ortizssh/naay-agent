# 🤖 Naay Chat Widget - Manual Installation Guide

Since the Theme App Extension isn't appearing in the theme editor, here's how to install the widget manually:

## 📋 Step-by-Step Installation

### Option 1: Snippet Installation (Recommended)

1. **Copy the widget code:**
   - Open `theme-snippet/naay-chat-snippet.liquid`
   - Copy ALL the code in that file

2. **Access theme editor:**
   - Go to Shopify Admin: `admin.shopify.com/store/naay-test`
   - Navigate to **Online Store → Themes**
   - Click **"Actions" → "Edit code"** on your active theme

3. **Create the snippet:**
   - In the left sidebar, find **"Snippets"** folder
   - Click **"Add a new snippet"**
   - Name it: `naay-chat-widget`
   - Paste the copied code
   - Click **"Save"**

4. **Add to theme:**
   - In the left sidebar, find **"Layout"** folder  
   - Click on **"theme.liquid"**
   - Scroll to the bottom and find `</body>`
   - **Right before** `</body>`, add this line:
   ```liquid
   {% render 'naay-chat-widget' %}
   ```
   - Click **"Save"**

5. **Test the widget:**
   - Visit: `https://naay-test.myshopify.com/`
   - Look for the chat widget in bottom-right corner
   - Click to test functionality

### Option 2: Direct Theme Integration

1. **Access theme editor:**
   - Same as above - go to **Actions → Edit code**

2. **Edit theme.liquid directly:**
   - In **"Layout"** folder, click **"theme.liquid"**
   - Scroll to the bottom, right before `</body>`
   - Paste this complete code:

```liquid
<div id="naay-chat-container" data-shop="{{ shop.permanent_domain }}" style="display: none;"></div>

<script>
  window.NaayConfig = {
    shopDomain: '{{ shop.permanent_domain }}',
    apiEndpoint: 'https://app.heykova.io',
    position: 'bottom-right',
    primaryColor: '#008060',
    greeting: '¡Hola! 👋 Soy tu asistente virtual. ¿En qué puedo ayudarte?',
    placeholder: 'Escribe tu mensaje...',
    theme: 'auto',
    avatar: '🤖',
    language: 'es',
    context: {
      customerLoggedIn: {% if customer %}true{% else %}false{% endif %},
      customerId: {% if customer %}'{{ customer.id }}'{% else %}null{% endif %},
      customerEmail: {% if customer %}'{{ customer.email | escape }}'{% else %}null{% endif %},
      currency: '{{ cart.currency.iso_code }}',
      shopName: '{{ shop.name | escape }}',
      cartToken: {{ cart.token | json }},
      cartId: {% if cart.id %}'gid://shopify/Cart/{{ cart.id }}'{% else %}null{% endif %},
      pageType: '{{ request.page_type }}',
      productId: {% if product %}'gid://shopify/Product/{{ product.id }}'{% else %}null{% endif %},
      collectionId: {% if collection %}'gid://shopify/Collection/{{ collection.id }}'{% else %}null{% endif %}
    }
  };
  
  (function() {
    if (window.location.hostname.includes('admin') || window.location.pathname.includes('/checkouts/')) {
      return;
    }
    
    var script = document.createElement('script');
    script.src = 'https://app.heykova.io/static/naay-widget.js';
    script.async = true;
    script.onload = function() {
      if (window.NaayWidget && window.NaayConfig) {
        try {
          new window.NaayWidget(window.NaayConfig);
          document.getElementById('naay-chat-container').style.display = 'block';
        } catch (error) {
          console.error('Failed to initialize Naay Widget:', error);
        }
      }
    };
    script.onerror = function() {
      console.error('Failed to load Naay Widget script');
    };
    document.head.appendChild(script);
  })();
</script>

<style>
  #naay-chat-container {
    position: relative;
    z-index: 9999;
  }
  
  .shopify-section-header #naay-chat-container,
  .admin #naay-chat-container {
    display: none !important;
  }
</style>
```

3. **Save the changes**

## 🎯 What the widget includes:

- ✅ **Responsive design** - Works on mobile and desktop
- ✅ **Dark/light theme** - Adapts to user's system preference
- ✅ **Shopify integration** - Knows customer info, cart, products
- ✅ **Persistent chat** - Remembers conversation in browser
- ✅ **Spanish interface** - Optimized for Spanish-speaking customers
- ✅ **Customizable** - Colors, position, messages via admin panel

## 🔧 Customization:

The widget loads settings from your admin panel:
- Visit: `admin.shopify.com/store/naay-test/apps/naay-test`
- Use "Configuración del Chat" section to customize:
  - Welcome message
  - Chat position
  - Colors
  - Features

## 🐛 Troubleshooting:

If widget doesn't appear:
1. Check browser console for errors (F12 → Console tab)
2. Verify the script loads: `https://app.heykova.io/static/naay-widget.js`
3. Ensure you're not in admin preview mode
4. Clear browser cache and refresh

## 📞 Widget Features:

- **AI-powered responses** using OpenAI GPT-4
- **Product search** and recommendations
- **Order tracking** capabilities  
- **Customer context** awareness
- **Conversation history** persistence
- **Mobile-optimized** interface

---

**Ready to test!** After installation, visit `https://naay-test.myshopify.com/` and look for the chat widget in the bottom-right corner.