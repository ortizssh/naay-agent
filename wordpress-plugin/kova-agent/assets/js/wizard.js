/**
 * Kova Agent Setup Wizard JS
 */
(function($) {
    'use strict';

    var currentStep = 1;

    // Color picker sync
    $(document).ready(function() {
        $('#wizard-widget-color').on('input', function() {
            $('#wizard-widget-color-text').val(this.value);
        });
        $('#wizard-widget-color-text').on('input', function() {
            var val = this.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                $('#wizard-widget-color').val(val);
            }
        });
    });

    // Navigate to step
    window.kovaWizardNext = function(step) {
        $('.kova-wizard-step').removeClass('active');
        $('#wizard-step-' + step).addClass('active');
        currentStep = step;

        // Update progress bar
        var progress = (step / 5) * 100;
        $('#wizard-progress-bar').css('width', progress + '%');
    };

    // Generate keys and connect
    window.kovaWizardConnect = function() {
        var $btn = $('#wizard-connect-btn');
        var $status = $('#wizard-connection-status');

        $btn.prop('disabled', true).text('Generando claves...');
        $status.show().removeClass('success error').addClass('loading').text('Generando claves API de WooCommerce...');

        // Step 1: Auto-generate keys
        $.post(kovaWizard.ajax_url, {
            action: 'kova_wizard_auto_generate_keys',
            nonce: kovaWizard.nonce
        }, function(response) {
            if (response.success) {
                $status.text('Claves generadas. Conectando con Kova...');

                // Step 2: Connect to backend
                $.post(kovaWizard.ajax_url, {
                    action: 'kova_wizard_connect',
                    nonce: kovaWizard.nonce
                }, function(connectResponse) {
                    if (connectResponse.success) {
                        $status.removeClass('loading').addClass('success').text('Conexion exitosa!');
                        $btn.text('Conectado ✓');

                        setTimeout(function() {
                            kovaWizardNext(3);
                        }, 1000);
                    } else {
                        $status.removeClass('loading').addClass('error').text('Error: ' + (connectResponse.data && connectResponse.data.message ? connectResponse.data.message : 'No se pudo conectar'));
                        $btn.prop('disabled', false).text('Reintentar →');
                    }
                }).fail(function() {
                    $status.removeClass('loading').addClass('error').text('Error de red al conectar');
                    $btn.prop('disabled', false).text('Reintentar →');
                });
            } else {
                $status.removeClass('loading').addClass('error').text('Error: ' + (response.data && response.data.message ? response.data.message : 'No se pudieron generar las claves'));
                $btn.prop('disabled', false).text('Reintentar →');
            }
        }).fail(function() {
            $status.removeClass('loading').addClass('error').text('Error de red');
            $btn.prop('disabled', false).text('Reintentar →');
        });
    };

    // Sync products
    window.kovaWizardSync = function() {
        var $btn = $('#wizard-sync-btn');
        var $idle = $('.kova-wizard-sync-idle');
        var $progress = $('.kova-wizard-sync-progress');
        var $done = $('.kova-wizard-sync-done');
        var $fill = $('#wizard-sync-progress-fill');
        var $text = $('#wizard-sync-text');

        $idle.hide();
        $progress.show();
        $fill.css('width', '20%');
        $text.text('Sincronizando productos...');

        $.post(kovaWizard.ajax_url, {
            action: 'kova_wizard_sync_products',
            nonce: kovaWizard.nonce
        }, function(response) {
            $fill.css('width', '100%');

            if (response.success) {
                var data = response.data;
                setTimeout(function() {
                    $progress.hide();
                    $done.show();
                    $('#wizard-sync-result').text(
                        (data.synced || 0) + ' productos sincronizados exitosamente'
                    );
                }, 500);
            } else {
                $text.text('Error: ' + (response.data && response.data.message ? response.data.message : 'La sincronizacion fallo'));
                $fill.css('background', '#ef4444');
            }
        }).fail(function() {
            $text.text('Error de red durante la sincronizacion');
            $fill.css('background', '#ef4444');
        });
    };

    // Finish wizard
    window.kovaWizardFinish = function() {
        $.post(kovaWizard.ajax_url, {
            action: 'kova_wizard_complete',
            nonce: kovaWizard.nonce,
            brand_name: $('#wizard-brand-name').val(),
            widget_color: $('#wizard-widget-color').val(),
            widget_position: $('#wizard-widget-position').val(),
            welcome_message: $('#wizard-welcome-message').val(),
            widget_subtitle: $('#wizard-widget-subtitle').val()
        }, function() {
            window.location.href = kovaWizard.dashboardUrl;
        }).fail(function() {
            window.location.href = kovaWizard.dashboardUrl;
        });
    };

})(jQuery);
