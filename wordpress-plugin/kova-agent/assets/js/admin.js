/**
 * Kova Agent Admin JavaScript
 */

(function($) {
    'use strict';

    // Initialize color picker
    $(document).ready(function() {
        $('.kova-color-picker').wpColorPicker();
    });

    // Status element
    var $status = $('#kova-action-status');

    /**
     * Update status message
     */
    function updateStatus(message, type) {
        $status
            .removeClass('success error loading')
            .addClass(type)
            .text(message);

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(function() {
                $status.fadeOut(function() {
                    $(this).text('').removeClass('success').show();
                });
            }, 5000);
        }
    }

    /**
     * Test Connection
     */
    $('#kova-test-connection').on('click', function() {
        var $button = $(this);
        $button.prop('disabled', true);
        updateStatus(kovaAdmin.strings.testing, 'loading');

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_test_connection',
                nonce: kovaAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    updateStatus(response.data.message, 'success');
                } else {
                    updateStatus(kovaAdmin.strings.error + ': ' + response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                updateStatus(kovaAdmin.strings.error + ': ' + error, 'error');
            },
            complete: function() {
                $button.prop('disabled', false);
            }
        });
    });

    /**
     * Sync Products
     */
    $('#kova-sync-products').on('click', function() {
        var $button = $(this);

        if (!confirm('This will sync all products to Kova. Continue?')) {
            return;
        }

        $button.prop('disabled', true);
        updateStatus(kovaAdmin.strings.syncing, 'loading');

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_sync_products',
                nonce: kovaAdmin.nonce
            },
            timeout: 120000, // 2 minute timeout
            success: function(response) {
                if (response.success) {
                    updateStatus(response.data.message, 'success');
                } else {
                    updateStatus(kovaAdmin.strings.error + ': ' + response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                var message = error;
                if (status === 'timeout') {
                    message = 'Request timed out. Products may still be syncing in the background.';
                }
                updateStatus(kovaAdmin.strings.error + ': ' + message, 'error');
            },
            complete: function() {
                $button.prop('disabled', false);
            }
        });
    });

    /**
     * Setup Webhooks
     */
    $('#kova-setup-webhooks').on('click', function() {
        var $button = $(this);
        $button.prop('disabled', true);
        updateStatus(kovaAdmin.strings.setting_up_webhooks, 'loading');

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_setup_webhooks',
                nonce: kovaAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    updateStatus(response.data.message, 'success');
                } else {
                    updateStatus(kovaAdmin.strings.error + ': ' + response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                updateStatus(kovaAdmin.strings.error + ': ' + error, 'error');
            },
            complete: function() {
                $button.prop('disabled', false);
            }
        });
    });

    /**
     * Show/hide password toggle
     */
    $('#kova_consumer_secret').closest('td').append(
        '<button type="button" class="button button-secondary kova-toggle-visibility" style="margin-left: 10px;">Show</button>'
    );

    $(document).on('click', '.kova-toggle-visibility', function(e) {
        e.preventDefault();
        var $input = $('#kova_consumer_secret');
        var $button = $(this);

        if ($input.attr('type') === 'password') {
            $input.attr('type', 'text');
            $button.text('Hide');
        } else {
            $input.attr('type', 'password');
            $button.text('Show');
        }
    });

    // ===========================================
    // Analytics Page
    // ===========================================

    var analyticsChart = null;

    function initAnalyticsPage() {
        var $container = $('.kova-analytics-container');
        if ($container.length === 0) return;

        // Set default dates (last 7 days - matching PHP)
        var endDate = new Date();
        var startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        $('#kova-start-date').val(formatDate(startDate));
        $('#kova-end-date').val(formatDate(endDate));

        // Load initial data
        loadAnalyticsData();

        // Bind refresh button
        $('#kova-refresh-analytics').on('click', function() {
            loadAnalyticsData();
        });
    }

    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    function loadAnalyticsData() {
        var $container = $('.kova-analytics-container');
        var startDate = $('#kova-start-date').val();
        var endDate = $('#kova-end-date').val();

        // Show loading state
        $('#kova-stat-conversations, #kova-stat-messages, #kova-stat-recommendations, #kova-stat-conversions, #kova-stat-products').text('-');
        $('#kova-analytics-loading').show();

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_get_analytics',
                nonce: kovaAdmin.nonce,
                startDate: startDate,
                endDate: endDate
            },
            success: function(response) {
                $('#kova-analytics-loading').hide();
                if (response.success) {
                    renderAnalyticsStats(response.data);
                    renderAnalyticsChart(response.data);
                } else {
                    $('#kova-stat-conversations, #kova-stat-messages, #kova-stat-recommendations, #kova-stat-conversions, #kova-stat-products').text('Error');
                }
            },
            error: function(xhr, status, error) {
                $('#kova-analytics-loading').hide();
                $('#kova-stat-conversations, #kova-stat-messages, #kova-stat-recommendations, #kova-stat-conversions, #kova-stat-products').text('Error');
            }
        });
    }

    function renderAnalyticsStats(data) {
        var stats = data.summary || {};

        // Update the individual stat elements
        $('#kova-stat-conversations').text(stats.totalConversations || 0);
        $('#kova-stat-messages').text(stats.totalMessages || 0);
        $('#kova-stat-recommendations').text(stats.totalRecommendations || 0);
        $('#kova-stat-conversions').text(stats.totalConversions || 0);
        $('#kova-stat-products').text(stats.productsCount || stats.totalProducts || 0);
    }

    function renderAnalyticsChart(data) {
        var chartData = data.dailyStats || [];
        var $canvas = $('#kova-analytics-chart');

        if (chartData.length === 0) {
            $canvas.parent().find('h2').after('<p class="kova-placeholder">No hay datos para el período seleccionado</p>');
            return;
        }

        // Remove any placeholder
        $canvas.parent().find('.kova-placeholder').remove();

        var ctx = document.getElementById('kova-analytics-chart').getContext('2d');

        // Destroy existing chart if any
        if (analyticsChart) {
            analyticsChart.destroy();
        }

        var labels = chartData.map(function(item) {
            return item.date;
        });

        var conversationsData = chartData.map(function(item) {
            return item.conversations || 0;
        });

        var messagesData = chartData.map(function(item) {
            return item.messages || 0;
        });

        analyticsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Conversaciones',
                        data: conversationsData,
                        borderColor: '#6d5cff',
                        backgroundColor: 'rgba(109, 92, 255, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Mensajes',
                        data: messagesData,
                        borderColor: '#ff6b4a',
                        backgroundColor: 'rgba(255, 107, 74, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    function formatCurrency(value) {
        return '$' + parseFloat(value).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }

    // ===========================================
    // Conversations Page
    // ===========================================

    function initConversationsPage() {
        var $container = $('.kova-conversations-container');
        if ($container.length === 0) return;

        // Set default date to today (matching PHP)
        var today = new Date();
        $('#kova-conversation-date').val(formatDate(today));

        // Load initial data
        loadConversationsData();

        // Bind load button
        $('#kova-load-conversations').on('click', function() {
            loadConversationsData();
        });
    }

    function loadConversationsData() {
        var $container = $('.kova-conversations-container');
        var date = $('#kova-conversation-date').val();

        // Show loading state
        $container.find('.kova-conversations-summary').html('<div class="kova-loading"><span class="spinner is-active"></span><p>Cargando...</p></div>');
        $('#kova-conversations-list').html('<div class="kova-loading"><span class="spinner is-active"></span><p>Cargando conversaciones...</p></div>');

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_get_conversations',
                nonce: kovaAdmin.nonce,
                date: date
            },
            success: function(response) {
                if (response.success) {
                    renderConversationsSummary(response.data);
                    renderConversationsList(response.data.conversations || []);
                } else {
                    $container.find('.kova-conversations-summary').html('<p>Error al cargar las estadísticas</p>');
                    $('#kova-conversations-list').html('<div class="kova-placeholder">Error: ' + (response.data.message || 'Error desconocido') + '</div>');
                }
            },
            error: function(xhr, status, error) {
                $container.find('.kova-conversations-summary').html('<p>Error de conexión</p>');
                $('#kova-conversations-list').html('<div class="kova-placeholder">Error de conexión: ' + error + '</div>');
            }
        });
    }

    function renderConversationsSummary(data) {
        var total = data.totalConversations || data.total || 0;
        var totalMessages = data.totalMessages || 0;
        // Restore the original HTML structure and update values
        var html = '<p><strong>' + kovaAdmin.strings.conversations + ':</strong> <span id="kova-total-conversations">' + total + '</span>';
        html += ' &nbsp;|&nbsp; <strong>Mensajes:</strong> <span id="kova-total-messages">' + totalMessages + '</span></p>';
        $('.kova-conversations-summary').html(html);
    }

    function renderConversationsList(conversations) {
        var $list = $('#kova-conversations-list');

        if (conversations.length === 0) {
            $list.html('<div class="kova-placeholder">No hay conversaciones en el período seleccionado</div>');
            return;
        }

        var html = '';
        conversations.forEach(function(conv, index) {
            var messages = conv.messages || [];
            var messageCount = messages.length;
            var firstUserMessage = messages.find(function(m) { return m.role === 'user'; });
            var preview = firstUserMessage ? firstUserMessage.content.substring(0, 80) : 'Sin mensajes';
            if (firstUserMessage && firstUserMessage.content.length > 80) {
                preview += '...';
            }

            html += '<div class="kova-conversation-item" data-index="' + index + '">';
            html += '  <div class="kova-conversation-header" onclick="toggleConversation(' + index + ')">';
            html += '    <div class="kova-conversation-header-left">';
            html += '      <span class="kova-conversation-toggle" id="toggle-' + index + '">▶</span>';
            html += '      <span class="kova-conversation-time">' + formatConversationDate(conv.startedAt || conv.created_at) + '</span>';
            html += '      <span class="kova-conversation-count">' + messageCount + ' mensajes</span>';
            html += '    </div>';
            html += '    <span class="kova-conversation-id">' + (conv.sessionId || conv.conversation_id || conv.id || '').substring(0, 8) + '...</span>';
            html += '  </div>';
            html += '  <div class="kova-conversation-preview" id="preview-' + index + '">';
            html += '    <span class="kova-preview-label">Usuario:</span> ' + escapeHtml(preview);
            html += '  </div>';
            html += '  <div class="kova-conversation-messages" id="messages-' + index + '" style="display: none;">';

            messages.forEach(function(msg) {
                var roleClass = msg.role === 'user' ? 'user' : 'assistant';
                var roleLabel = msg.role === 'user' ? '👤 Usuario' : '🤖 Asistente';
                var timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}) : '';
                html += '<div class="kova-message ' + roleClass + '">';
                html += '  <div class="kova-message-header">';
                html += '    <span class="kova-message-role">' + roleLabel + '</span>';
                if (timeStr) {
                    html += '    <span class="kova-message-time">' + timeStr + '</span>';
                }
                html += '  </div>';
                html += '  <div class="kova-message-content">' + escapeHtml(msg.content || '') + '</div>';
                html += '</div>';
            });

            html += '  </div>';
            html += '</div>';
        });

        $list.html(html);

        // Add global toggle function
        window.toggleConversation = function(index) {
            var $messages = $('#messages-' + index);
            var $preview = $('#preview-' + index);
            var $toggle = $('#toggle-' + index);

            if ($messages.is(':visible')) {
                $messages.slideUp(200);
                $preview.slideDown(200);
                $toggle.text('▶');
            } else {
                $messages.slideDown(200);
                $preview.slideUp(200);
                $toggle.text('▼');
            }
        };
    }

    function formatConversationDate(dateStr) {
        if (!dateStr) return '';
        var date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===========================================
    // Conversions Page
    // ===========================================

    var conversionsChart = null;

    function initConversionsPage() {
        var $container = $('.kova-conversions-container');
        if ($container.length === 0) return;

        // Set default period (30 days is already selected in PHP)
        // Load initial data
        loadConversionsData();

        // Bind load button
        $('#kova-load-conversions').on('click', function() {
            loadConversionsData();
        });

        // Also bind period change
        $('#kova-conversion-days').on('change', function() {
            loadConversionsData();
        });
    }

    function loadConversionsData() {
        var $container = $('.kova-conversions-container');
        var days = $('#kova-conversion-days').val();

        // Show loading indicators
        $('#kova-conv-total, #kova-conv-rate, #kova-conv-revenue, #kova-conv-aov').text('-');
        $('#kova-top-products-body').html('<tr><td colspan="5"><div class="kova-loading"><span class="spinner is-active"></span><p>Cargando...</p></div></td></tr>');
        $('#kova-activity-list').html('<div class="kova-loading"><span class="spinner is-active"></span><p>Cargando...</p></div>');
        $('#kova-conversions-loading').show();

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_get_conversions',
                nonce: kovaAdmin.nonce,
                days: days
            },
            success: function(response) {
                $('#kova-conversions-loading').hide();
                if (response.success) {
                    renderConversionStats(response.data);
                    renderConversionChart(response.data);
                    renderTopProducts(response.data.topProducts || []);
                    renderRecentActivity(response.data.recentActivity || []);
                } else {
                    var errorMsg = 'Error: ' + (response.data.message || 'Error desconocido');
                    $('#kova-conv-total, #kova-conv-rate, #kova-conv-revenue, #kova-conv-aov').text('Error');
                    $('#kova-top-products-body').html('<tr><td colspan="5" class="kova-placeholder">' + errorMsg + '</td></tr>');
                    $('#kova-activity-list').html('<p class="kova-placeholder">' + errorMsg + '</p>');
                }
            },
            error: function(xhr, status, error) {
                $('#kova-conversions-loading').hide();
                var errorMsg = 'Error de conexión: ' + error;
                $('#kova-conv-total, #kova-conv-rate, #kova-conv-revenue, #kova-conv-aov').text('Error');
                $('#kova-top-products-body').html('<tr><td colspan="5" class="kova-placeholder">' + errorMsg + '</td></tr>');
                $('#kova-activity-list').html('<p class="kova-placeholder">' + errorMsg + '</p>');
            }
        });
    }

    function renderConversionStats(data) {
        var summary = data.summary || {};

        // Update the individual stat elements
        $('#kova-conv-total').text(summary.totalConversions || 0);
        $('#kova-conv-rate').text(((summary.conversionRate || 0) * 100).toFixed(1) + '%');
        $('#kova-conv-revenue').text(formatCurrency(summary.totalRevenue || 0));
        $('#kova-conv-aov').text(formatCurrency(summary.avgOrderValue || 0));
    }

    function renderConversionChart(data) {
        var chartData = data.dailyConversions || [];
        var $container = $('.kova-conversions-container .kova-chart-container');

        if (chartData.length === 0) {
            $container.html('<h2>Conversiones por Día</h2><div class="kova-placeholder">No hay datos para el período seleccionado</div>');
            return;
        }

        $container.html('<h2>Conversiones por Día</h2><canvas id="kova-conversions-chart" style="height: 300px;"></canvas>');

        var ctx = document.getElementById('kova-conversions-chart').getContext('2d');

        // Destroy existing chart if any
        if (conversionsChart) {
            conversionsChart.destroy();
        }

        var labels = chartData.map(function(item) {
            return item.date;
        });

        var conversionsData = chartData.map(function(item) {
            return item.conversions || 0;
        });

        var revenueData = chartData.map(function(item) {
            return item.revenue || 0;
        });

        conversionsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Conversiones',
                        data: conversionsData,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Ingresos',
                        data: revenueData,
                        type: 'line',
                        borderColor: '#6d5cff',
                        backgroundColor: 'rgba(109, 92, 255, 0.1)',
                        tension: 0.3,
                        fill: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        },
                        title: {
                            display: true,
                            text: 'Conversiones'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false
                        },
                        title: {
                            display: true,
                            text: 'Ingresos ($)'
                        }
                    }
                }
            }
        });
    }

    function renderTopProducts(products) {
        var $tbody = $('#kova-top-products-body');

        if (products.length === 0) {
            $tbody.html('<tr><td colspan="5" class="kova-placeholder">No hay productos con conversiones</td></tr>');
            return;
        }

        var html = '';
        products.forEach(function(product) {
            var recommendations = product.recommendations || 0;
            var conversions = product.conversions || product.count || 0;
            var rate = recommendations > 0 ? ((conversions / recommendations) * 100).toFixed(1) : '0.0';

            html += '<tr>';
            html += '<td>' + escapeHtml(product.name || product.product_title || 'Sin nombre') + '</td>';
            html += '<td>' + recommendations + '</td>';
            html += '<td>' + conversions + '</td>';
            html += '<td>' + rate + '%</td>';
            html += '<td>' + formatCurrency(product.revenue || 0) + '</td>';
            html += '</tr>';
        });

        $tbody.html(html);
    }

    function renderRecentActivity(activities) {
        var $list = $('#kova-activity-list');

        if (activities.length === 0) {
            $list.html('<p class="kova-placeholder">No hay actividad reciente</p>');
            return;
        }

        var html = '';
        activities.forEach(function(activity) {
            var iconClass = activity.type === 'conversion' ? 'conversion' : 'recommendation';
            var icon = activity.type === 'conversion' ? 'dashicons-cart' : 'dashicons-star-filled';

            html += '<div class="kova-activity-item">';
            html += '  <div class="kova-activity-icon ' + iconClass + '"><span class="dashicons ' + icon + '"></span></div>';
            html += '  <div class="kova-activity-content">';
            html += '    <div class="kova-activity-title">' + escapeHtml(activity.title || activity.product_title || '') + '</div>';
            html += '    <div class="kova-activity-meta">' + formatConversationDate(activity.created_at || activity.date) + '</div>';
            html += '  </div>';
            if (activity.amount || activity.revenue) {
                html += '  <div class="kova-activity-amount">' + formatCurrency(activity.amount || activity.revenue || 0) + '</div>';
            }
            html += '</div>';
        });

        $list.html(html);
    }

    // ===========================================
    // Widget Tab
    // ===========================================

    function initWidgetTab() {
        // Check if we're on the widget tab
        if ($('.kova-position-grid').length === 0) return;

        // Position selector
        $('.kova-position-option').on('click', function() {
            var position = $(this).data('position');
            $('.kova-position-option').removeClass('selected');
            $(this).addClass('selected');
            $('#kova_widget_position').val(position);
        });

        // Color picker sync
        $('#kova_widget_color').on('input change', function() {
            var color = $(this).val();
            $('#kova_widget_color_text').val(color);
            $('#kova-preview-header').css('background', color);
        });

        $('#kova_widget_color_text').on('input change', function() {
            var color = $(this).val();
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                $('#kova_widget_color').val(color);
                $('#kova-preview-header').css('background', color);
            }
        });

        // Title preview
        $('#kova_widget_title').on('input', function() {
            $('#kova-preview-title').text($(this).val() || 'Kova Assistant');
        });

        // Welcome message preview
        $('#kova_welcome_message').on('input', function() {
            $('#kova-preview-message').text($(this).val() || 'Hello! How can I help you today?');
        });

        // Show/hide Retell Agent ID field based on contact toggle
        $('#kova_widget_show_contact').on('change', function() {
            if ($(this).is(':checked')) {
                $('#kova-retell-agent-id-group').show();
            } else {
                $('#kova-retell-agent-id-group').hide();
            }
        });
    }

    // ===========================================
    // Dashboard Tab
    // ===========================================

    var dashboardChart = null;

    function initDashboardTab() {
        if ($('#kova-dashboard-stats').length === 0) return;

        // Load dashboard data on page load
        loadDashboardData();
    }

    function loadDashboardData() {
        // Get last 7 days by default
        var endDate = new Date();
        var startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_get_analytics',
                nonce: kovaAdmin.nonce,
                startDate: formatDate(startDate),
                endDate: formatDate(endDate)
            },
            success: function(response) {
                if (response.success) {
                    var stats = response.data.summary || {};
                    $('#kova-dash-conversations').text(stats.totalConversations || 0);
                    $('#kova-dash-messages').text(stats.totalMessages || 0);
                    $('#kova-dash-recommendations').text(stats.totalRecommendations || 0);
                    $('#kova-dash-conversions').text(stats.totalConversions || 0);
                    renderDashboardChart(response.data);
                }
            }
        });
    }

    function renderDashboardChart(data) {
        var chartData = data.dailyStats || [];
        var $canvas = $('#kova-dashboard-chart');

        if (chartData.length === 0 || $canvas.length === 0) {
            return;
        }

        var ctx = document.getElementById('kova-dashboard-chart').getContext('2d');

        if (dashboardChart) {
            dashboardChart.destroy();
        }

        var labels = chartData.map(function(item) {
            return item.date;
        });

        var conversationsData = chartData.map(function(item) {
            return item.conversations || 0;
        });

        var messagesData = chartData.map(function(item) {
            return item.messages || 0;
        });

        dashboardChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Conversaciones',
                        data: conversationsData,
                        borderColor: '#6d5cff',
                        backgroundColor: 'rgba(109, 92, 255, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Mensajes',
                        data: messagesData,
                        borderColor: '#ff6b4a',
                        backgroundColor: 'rgba(255, 107, 74, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // ===========================================
    // Page Initialization
    // ===========================================

    $(document).ready(function() {
        // Initialize page-specific functionality
        initDashboardTab();
        initAnalyticsPage();
        initConversationsPage();
        initConversionsPage();
        initWidgetTab();
        initAiTab();
        initKnowledgeTab();
    });

    // ===========================================
    // AI Config Tab
    // ===========================================

    function initAiTab() {
        var $container = $('#kova-ai-container');
        if (!$container.length) return;

        loadAiConfig();

        // Chat mode toggle
        $container.on('click', '.kova-mode-btn', function() {
            var mode = $(this).data('mode');
            $('.kova-mode-btn').removeClass('active');
            $(this).addClass('active');
            if (mode === 'internal') {
                $('#kova-ai-internal').show();
                $('#kova-ai-external').hide();
            } else {
                $('#kova-ai-internal').hide();
                $('#kova-ai-external').show();
            }
        });

        // Tone selector
        $container.on('click', '.kova-tone-btn', function() {
            $('.kova-tone-btn').removeClass('active');
            $(this).addClass('active');
        });

        // Language selector
        $container.on('click', '.kova-lang-btn', function() {
            $('.kova-lang-btn').removeClass('active');
            $(this).addClass('active');
        });

        // Save AI config
        $('#kova-save-ai-config').on('click', function() {
            saveAiConfig();
        });
    }

    function loadAiConfig() {
        $('#kova-ai-loading').show();
        $('#kova-ai-content').hide();

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_get_ai_config',
                nonce: kovaAdmin.nonce
            },
            success: function(response) {
                if (response.success && response.data) {
                    var d = response.data;
                    // Set mode
                    var mode = d.chat_mode || 'internal';
                    $('.kova-mode-btn').removeClass('active');
                    $('.kova-mode-btn[data-mode="' + mode + '"]').addClass('active');
                    if (mode === 'external') {
                        $('#kova-ai-internal').hide();
                        $('#kova-ai-external').show();
                    }

                    // Set fields
                    $('#kova-ai-agent-name').val(d.agent_name || '');
                    $('#kova-ai-brand-desc').val(d.brand_description || '');
                    $('#kova-ai-instructions').val(d.agent_instructions || '');
                    $('#kova-ai-model').val(d.ai_model || 'gpt-4.1-mini');
                    $('#kova-ai-endpoint').val(d.chatbot_endpoint || '');

                    // Set tone
                    var tone = d.agent_tone || 'friendly';
                    $('.kova-tone-btn').removeClass('active');
                    $('.kova-tone-btn[data-tone="' + tone + '"]').addClass('active');

                    // Set language
                    var lang = d.agent_language || 'es';
                    $('.kova-lang-btn').removeClass('active');
                    $('.kova-lang-btn[data-lang="' + lang + '"]').addClass('active');
                }
                $('#kova-ai-loading').hide();
                $('#kova-ai-content').show();
            },
            error: function() {
                $('#kova-ai-loading').hide();
                $('#kova-ai-content').show();
            }
        });
    }

    function saveAiConfig() {
        var $btn = $('#kova-save-ai-config');
        var $status = $('#kova-ai-status');
        $btn.prop('disabled', true).text('Saving...');

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_save_ai_config',
                nonce: kovaAdmin.nonce,
                chatMode: $('.kova-mode-btn.active').data('mode'),
                aiModel: $('#kova-ai-model').val(),
                agentName: $('#kova-ai-agent-name').val(),
                agentTone: $('.kova-tone-btn.active').data('tone'),
                brandDescription: $('#kova-ai-brand-desc').val(),
                agentInstructions: $('#kova-ai-instructions').val(),
                agentLanguage: $('.kova-lang-btn.active').data('lang'),
                chatbotEndpoint: $('#kova-ai-endpoint').val()
            },
            success: function(response) {
                $btn.prop('disabled', false).text('Save Configuration');
                if (response.success) {
                    $status.text('Saved!').css('color', '#10b981').show();
                    setTimeout(function() { $status.fadeOut(); }, 3000);
                } else {
                    $status.text('Error: ' + (response.data?.message || 'Unknown')).css('color', '#ef4444').show();
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Save Configuration');
                $status.text('Connection error').css('color', '#ef4444').show();
            }
        });
    }

    // ===========================================
    // Knowledge Base Tab
    // ===========================================

    var knowledgePollInterval = null;

    function initKnowledgeTab() {
        var $container = $('#kova-knowledge-container');
        if (!$container.length) return;

        loadKnowledgeDocs();

        // Doc mode toggle
        $container.on('click', '.kova-doc-mode-btn', function() {
            var mode = $(this).data('mode');
            $('.kova-doc-mode-btn').removeClass('active');
            $(this).addClass('active');
            if (mode === 'text') {
                $('#kova-doc-text-mode').show();
                $('#kova-doc-file-mode').hide();
            } else {
                $('#kova-doc-text-mode').hide();
                $('#kova-doc-file-mode').show();
            }
        });

        // Create text document
        $('#kova-create-doc').on('click', function() {
            createTextDocument();
        });

        // Upload file document
        $('#kova-upload-doc').on('click', function() {
            uploadFileDocument();
        });
    }

    function loadKnowledgeDocs() {
        $('#kova-knowledge-loading').show();
        $('#kova-knowledge-content').hide();

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_get_knowledge',
                nonce: kovaAdmin.nonce
            },
            success: function(response) {
                $('#kova-knowledge-loading').hide();
                $('#kova-knowledge-content').show();

                if (response.success && response.data) {
                    renderKnowledgeDocs(response.data);
                } else {
                    renderKnowledgeDocs([]);
                }
            },
            error: function() {
                $('#kova-knowledge-loading').hide();
                $('#kova-knowledge-content').show();
                renderKnowledgeDocs([]);
            }
        });
    }

    function renderKnowledgeDocs(docs) {
        var $tbody = $('#kova-knowledge-tbody');
        var $empty = $('#kova-knowledge-empty');
        var $count = $('#kova-knowledge-count');
        var $table = $tbody.closest('table');

        $count.text(docs.length);
        $tbody.empty();

        if (docs.length === 0) {
            $table.hide();
            $empty.show();
            stopKnowledgePolling();
            return;
        }

        $table.show();
        $empty.hide();

        var hasPending = false;

        docs.forEach(function(doc) {
            var statusClass = 'pending';
            var statusText = 'Pending';
            if (doc.embedding_status === 'completed') { statusClass = 'completed'; statusText = 'Ready'; }
            else if (doc.embedding_status === 'processing') { statusClass = 'processing'; statusText = 'Processing...'; hasPending = true; }
            else if (doc.embedding_status === 'failed') { statusClass = 'error'; statusText = 'Error'; }
            else { hasPending = true; }

            var typeLabel = doc.source_type === 'file' ? 'File' : 'Text';
            var dateStr = new Date(doc.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

            var row = '<tr>' +
                '<td style="font-weight:500; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escHtml(doc.title) + '</td>' +
                '<td style="text-align:center;"><span class="kova-type-badge kova-type-' + doc.source_type + '">' + typeLabel + '</span></td>' +
                '<td style="text-align:center;">' + (doc.chunk_count || 0) + '</td>' +
                '<td style="text-align:center;"><span class="kova-status-badge kova-status-badge--' + statusClass + '">' + statusText + '</span></td>' +
                '<td style="text-align:center; font-size:0.85em; color:#6b7280;">' + dateStr + '</td>' +
                '<td style="text-align:center;"><button type="button" class="kova-delete-doc" data-id="' + doc.id + '" title="Delete" style="background:none;border:none;cursor:pointer;color:#ef4444;padding:4px;">&times;</button></td>' +
                '</tr>';

            $tbody.append(row);
        });

        // Bind delete buttons
        $tbody.find('.kova-delete-doc').off('click').on('click', function() {
            var docId = $(this).data('id');
            if (confirm('Delete this document?')) {
                deleteKnowledgeDoc(docId);
            }
        });

        // Start/stop polling
        if (hasPending) {
            startKnowledgePolling();
        } else {
            stopKnowledgePolling();
        }
    }

    function createTextDocument() {
        var title = $('#kova-doc-title').val();
        var content = $('#kova-doc-content').val();
        var $status = $('#kova-knowledge-status');

        if (!title || !content) {
            $status.text('Title and content are required.').css('color', '#ef4444').show();
            return;
        }

        var $btn = $('#kova-create-doc');
        $btn.prop('disabled', true).text('Creating...');

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_create_knowledge',
                nonce: kovaAdmin.nonce,
                title: title,
                content: content
            },
            success: function(response) {
                $btn.prop('disabled', false).text('Create Document');
                if (response.success) {
                    $('#kova-doc-title').val('');
                    $('#kova-doc-content').val('');
                    $status.text('Document created!').css('color', '#10b981').show();
                    setTimeout(function() { $status.fadeOut(); }, 3000);
                    loadKnowledgeDocs();
                } else {
                    $status.text('Error: ' + (response.data?.message || 'Unknown')).css('color', '#ef4444').show();
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Create Document');
                $status.text('Connection error').css('color', '#ef4444').show();
            }
        });
    }

    function uploadFileDocument() {
        var fileInput = document.getElementById('kova-doc-file');
        var file = fileInput.files[0];
        var $status = $('#kova-knowledge-status');

        if (!file) {
            $status.text('Please select a file.').css('color', '#ef4444').show();
            return;
        }

        var $btn = $('#kova-upload-doc');
        $btn.prop('disabled', true).text('Uploading...');

        var formData = new FormData();
        formData.append('action', 'kova_upload_knowledge');
        formData.append('nonce', kovaAdmin.nonce);
        formData.append('file', file);
        formData.append('title', $('#kova-doc-title').val() || '');

        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                $btn.prop('disabled', false).text('Upload File');
                if (response.success) {
                    $('#kova-doc-title').val('');
                    fileInput.value = '';
                    $status.text('File uploaded!').css('color', '#10b981').show();
                    setTimeout(function() { $status.fadeOut(); }, 3000);
                    loadKnowledgeDocs();
                } else {
                    $status.text('Error: ' + (response.data?.message || 'Unknown')).css('color', '#ef4444').show();
                }
            },
            error: function() {
                $btn.prop('disabled', false).text('Upload File');
                $status.text('Connection error').css('color', '#ef4444').show();
            }
        });
    }

    function deleteKnowledgeDoc(docId) {
        $.ajax({
            url: kovaAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'kova_delete_knowledge',
                nonce: kovaAdmin.nonce,
                documentId: docId
            },
            success: function(response) {
                if (response.success) {
                    loadKnowledgeDocs();
                }
            }
        });
    }

    function startKnowledgePolling() {
        if (knowledgePollInterval) return;
        knowledgePollInterval = setInterval(function() {
            $.ajax({
                url: kovaAdmin.ajax_url,
                type: 'POST',
                data: {
                    action: 'kova_get_knowledge',
                    nonce: kovaAdmin.nonce
                },
                success: function(response) {
                    if (response.success && response.data) {
                        renderKnowledgeDocs(response.data);
                    }
                }
            });
        }, 5000);
    }

    function stopKnowledgePolling() {
        if (knowledgePollInterval) {
            clearInterval(knowledgePollInterval);
            knowledgePollInterval = null;
        }
    }

    function escHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str || ''));
        return div.innerHTML;
    }

})(jQuery);
