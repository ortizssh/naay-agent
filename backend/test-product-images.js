// Test script to verify the product images fix
const fetch = require('node-fetch');

async function testProductImagesFix() {
  try {
    console.log('🚀 Testing product images fix...\n');

    // Start a simple server test
    const testUrl = 'http://localhost:3000/api/admin-bypass/analytics/top-recommended-products?shop=test-shop.myshopify.com';
    
    console.log('📡 Testing API endpoint:', testUrl);
    
    const response = await fetch(testUrl);
    const data = await response.json();
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 Response Data:\n', JSON.stringify(data, null, 2));
    
    // Validate response structure
    const validations = [
      { test: 'success field exists', result: 'success' in data },
      { test: 'data field exists', result: 'data' in data },
      { test: 'data is array', result: Array.isArray(data.data) },
      { test: 'products have required fields', result: data.data.length > 0 && data.data[0].title && 'image' in data.data[0] && 'price' in data.data[0] },
      { test: 'response has message', result: 'message' in data },
    ];
    
    console.log('\n🔍 Validation Results:');
    validations.forEach(v => {
      console.log(`${v.result ? '✅' : '❌'} ${v.test}: ${v.result}`);
    });
    
    // Test SVG placeholder accessibility
    console.log('\n🖼️ Testing SVG placeholder...');
    const svgUrl = 'http://localhost:3000/static/placeholder-product.svg';
    const svgResponse = await fetch(svgUrl);
    const svgContent = await svgResponse.text();
    
    console.log('✅ SVG Status:', svgResponse.status);
    console.log('✅ SVG Content Type:', svgResponse.headers.get('content-type') || 'unknown');
    console.log('✅ SVG Contains valid content:', svgContent.includes('<svg') && svgContent.includes('</svg>'));
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('💡 Make sure the server is running with: npm run dev');
  }
}

// Run the test
testProductImagesFix();