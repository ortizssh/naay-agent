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

})(jQuery);
