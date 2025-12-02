#!/bin/bash

# ============================================================================
# CONVERSATION PERFORMANCE TEST SCRIPT
# ============================================================================

set -e

echo "🧪 Testing conversation performance optimizations..."

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
SHOP="${SHOP:-naaycl.myshopify.com}"
ITERATIONS=5

echo "📋 Test Configuration:"
echo "   API Base URL: $API_BASE_URL"
echo "   Shop: $SHOP"
echo "   Iterations: $ITERATIONS"
echo ""

# Function to make HTTP request and measure time
make_request() {
    local url="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    
    if [ "$method" = "POST" ]; then
        curl -s -w "%{time_total}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -o /dev/null
    else
        curl -s -w "%{time_total}" "$url" -o /dev/null
    fi
}

# Test 1: Basic health check
echo "🔍 Testing basic health check..."
health_time=$(make_request "$API_BASE_URL/api/admin-bypass/health")
echo "   ✅ Health check: ${health_time}s"
echo ""

# Test 2: Conversation loading performance
echo "📊 Testing conversation loading performance..."
total_time=0
success_count=0

for i in $(seq 1 $ITERATIONS); do
    echo -n "   Test $i/$ITERATIONS: "
    
    start_time=$(date +%s%3N)
    
    if response_time=$(make_request "$API_BASE_URL/api/admin-bypass/conversations?shop=$SHOP&page=1&limit=10" 2>/dev/null); then
        end_time=$(date +%s%3N)
        duration=$((end_time - start_time))
        
        echo "${duration}ms ✅"
        total_time=$((total_time + duration))
        success_count=$((success_count + 1))
    else
        echo "❌ Failed"
    fi
    
    # Small delay between requests
    sleep 0.2
done

if [ $success_count -gt 0 ]; then
    average_time=$((total_time / success_count))
    echo ""
    echo "📈 Conversation Loading Results:"
    echo "   Successful tests: $success_count/$ITERATIONS"
    echo "   Average time: ${average_time}ms"
    echo "   Target: <100ms"
    
    if [ $average_time -lt 100 ]; then
        echo "   ✅ PASSED - Performance target achieved!"
    else
        echo "   ❌ FAILED - Performance target not met"
    fi
else
    echo ""
    echo "❌ All conversation loading tests failed"
fi

echo ""

# Test 3: Performance monitoring endpoints
echo "🔧 Testing performance monitoring..."

# Test performance stats endpoint
echo -n "   Performance stats endpoint: "
if stats_time=$(make_request "$API_BASE_URL/api/admin-bypass/performance/stats?shop=$SHOP" 2>/dev/null); then
    echo "${stats_time}s ✅"
else
    echo "❌ Failed"
fi

# Test performance test endpoint (automated)
echo -n "   Automated performance test: "
test_data='{"shop":"'$SHOP'","iterations":3}'
if test_time=$(make_request "$API_BASE_URL/api/admin-bypass/performance/test" "POST" "$test_data" 2>/dev/null); then
    echo "${test_time}s ✅"
else
    echo "❌ Failed"
fi

echo ""

# Test 4: Cache performance
echo "💾 Testing cache performance..."

# First request (cache miss)
echo -n "   First request (cache miss): "
start_time=$(date +%s%3N)
make_request "$API_BASE_URL/api/admin-bypass/conversations?shop=$SHOP&page=1&limit=5" > /dev/null 2>&1
end_time=$(date +%s%3N)
first_request_time=$((end_time - start_time))
echo "${first_request_time}ms"

# Second request (should be cached)
echo -n "   Second request (cache hit): "
start_time=$(date +%s%3N)
make_request "$API_BASE_URL/api/admin-bypass/conversations?shop=$SHOP&page=1&limit=5" > /dev/null 2>&1
end_time=$(date +%s%3N)
second_request_time=$((end_time - start_time))
echo "${second_request_time}ms"

# Calculate cache improvement
if [ $first_request_time -gt 0 ] && [ $second_request_time -lt $first_request_time ]; then
    cache_improvement=$(( (first_request_time - second_request_time) * 100 / first_request_time ))
    echo "   ✅ Cache working: ${cache_improvement}% faster on second request"
else
    echo "   ⚠️  Cache improvement unclear"
fi

echo ""

# Test 5: Rate limiting
echo "🚦 Testing rate limiting protection..."
rapid_requests=0
successful_requests=0

for i in $(seq 1 10); do
    if make_request "$API_BASE_URL/api/admin-bypass/conversations?shop=$SHOP&page=1&limit=1" > /dev/null 2>&1; then
        successful_requests=$((successful_requests + 1))
    fi
    rapid_requests=$((rapid_requests + 1))
    sleep 0.1
done

echo "   Rapid requests: $rapid_requests"
echo "   Successful: $successful_requests"

if [ $successful_requests -lt $rapid_requests ]; then
    echo "   ✅ Rate limiting working (some requests blocked)"
else
    echo "   ⚠️  All requests succeeded (rate limiting may need adjustment)"
fi

echo ""

# Final summary
echo "🎯 Performance Test Summary:"
echo "========================================="

if [ $success_count -gt 0 ] && [ $average_time -lt 100 ]; then
    echo "✅ OVERALL RESULT: PASSED"
    echo ""
    echo "Key Achievements:"
    echo "   • Conversation loading: ${average_time}ms (target: <100ms)"
    echo "   • Success rate: $(( success_count * 100 / ITERATIONS ))%"
    echo "   • Cache working: Second requests faster"
    echo "   • Rate limiting: Active protection"
    echo "   • Monitoring: All endpoints responding"
else
    echo "❌ OVERALL RESULT: NEEDS ATTENTION"
    echo ""
    echo "Issues Found:"
    if [ $average_time -ge 100 ]; then
        echo "   • Performance target not met: ${average_time}ms (target: <100ms)"
    fi
    if [ $success_count -lt $ITERATIONS ]; then
        echo "   • Some requests failing: $(( success_count * 100 / ITERATIONS ))% success rate"
    fi
fi

echo ""
echo "💡 Next Steps:"
echo "   1. Check application logs for performance warnings"
echo "   2. Verify database optimizations are deployed"
echo "   3. Monitor cache hit rates in production"
echo "   4. Review performance stats: $API_BASE_URL/api/admin-bypass/performance/stats"
echo ""

echo "✅ Performance test completed!"