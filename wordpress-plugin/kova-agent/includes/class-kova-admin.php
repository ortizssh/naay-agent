<?php
/**
 * Kova Agent Admin Class
 * Handles the admin settings page and configuration
 * Modern Design matching Shopify Embedded Admin
 */

if (!defined('ABSPATH')) {
    exit;
}

class Kova_Admin {

    /**
     * Current page/tab
     */
    private $current_page = 'settings';

    /**
     * Constructor
     */
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_init', array($this, 'activation_redirect'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_action('admin_notices', array($this, 'setup_wizard_notice'));
        add_action('wp_ajax_kova_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_kova_sync_products', array($this, 'ajax_sync_products'));
        add_action('wp_ajax_kova_setup_webhooks', array($this, 'ajax_setup_webhooks'));
        add_action('wp_ajax_kova_get_analytics', array($this, 'ajax_get_analytics'));
        add_action('wp_ajax_kova_get_conversations', array($this, 'ajax_get_conversations'));
        add_action('wp_ajax_kova_get_conversions', array($this, 'ajax_get_conversions'));
        add_action('wp_ajax_kova_wizard_auto_generate_keys', array($this, 'ajax_wizard_auto_generate_keys'));
        add_action('wp_ajax_kova_wizard_connect', array($this, 'ajax_wizard_connect'));
        add_action('wp_ajax_kova_wizard_sync_products', array($this, 'ajax_wizard_sync_products'));
        add_action('wp_ajax_kova_wizard_complete', array($this, 'ajax_wizard_complete'));
    }

    /**
     * Redirect to setup wizard on activation
     */
    public function activation_redirect() {
        if (!get_transient('kova_agent_activation_redirect')) {
            return;
        }
        delete_transient('kova_agent_activation_redirect');

        // Don't redirect on multisite or bulk activation
        if (is_network_admin() || isset($_GET['activate-multi'])) {
            return;
        }

        $settings = get_option('kova_agent_settings', array());
        if (empty($settings['consumer_key'])) {
            wp_safe_redirect(admin_url('admin.php?page=kova-agent-setup'));
            exit;
        }
    }

    /**
     * Show admin notice if onboarding not completed
     */
    public function setup_wizard_notice() {
        $settings = get_option('kova_agent_settings', array());
        $onboarding_complete = get_option('kova_agent_onboarding_complete', false);

        if ($onboarding_complete || !empty($settings['consumer_key'])) {
            return;
        }

        $current_screen = get_current_screen();
        if ($current_screen && strpos($current_screen->id, 'kova-agent-setup') !== false) {
            return;
        }
        ?>
        <div class="notice notice-info is-dismissible">
            <p>
                <strong><?php _e('Kova Agent esta casi listo.', 'kova-agent'); ?></strong>
                <?php _e('Completa la configuracion para activar tu asistente de IA.', 'kova-agent'); ?>
                <a href="<?php echo admin_url('admin.php?page=kova-agent-setup'); ?>" class="button button-primary" style="margin-left: 10px;">
                    <?php _e('Ejecutar Setup Wizard', 'kova-agent'); ?>
                </a>
            </p>
        </div>
        <?php
    }

    /**
     * Add admin menu page
     */
    public function add_admin_menu() {
        add_menu_page(
            __('Kova Agent', 'kova-agent'),
            __('Kova Agent', 'kova-agent'),
            'manage_woocommerce',
            'kova-agent',
            array($this, 'render_admin_page'),
            'dashicons-format-chat',
            56
        );

        // Hidden setup wizard page
        add_submenu_page(
            null,
            __('Kova Agent Setup', 'kova-agent'),
            __('Setup', 'kova-agent'),
            'manage_woocommerce',
            'kova-agent-setup',
            array($this, 'render_setup_wizard')
        );
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting(
            'kova_agent_settings_group',
            'kova_agent_settings',
            array($this, 'sanitize_settings')
        );
    }

    /**
     * Sanitize settings
     */
    public function sanitize_settings($input) {
        // Get existing settings to preserve values not in current form (different tabs)
        $existing = get_option('kova_agent_settings', array());
        $sanitized = array();

        // Helper function to get value from input or preserve existing
        $get_value = function($key, $default) use ($input, $existing) {
            if (array_key_exists($key, $input)) {
                return $input[$key];
            }
            return $existing[$key] ?? $default;
        };

        // Helper for checkbox fields (preserve existing when checkbox not in form)
        $get_checkbox = function($key, $default) use ($input, $existing) {
            // If the key exists in input, use its value (true if set, false if not)
            if (array_key_exists($key, $input)) {
                return (bool) $input[$key];
            }
            // If not in input, preserve existing value (field is on different tab)
            return $existing[$key] ?? $default;
        };

        // General settings (Settings tab)
        $sanitized['enabled'] = $get_checkbox('enabled', false);
        $sanitized['api_endpoint'] = sanitize_url($get_value('api_endpoint', 'https://naay-agent-app1763504937.azurewebsites.net'));
        $sanitized['chat_endpoint'] = sanitize_url($get_value('chat_endpoint', 'https://n8n.dustkey.com/webhook/chat-naay'));
        $sanitized['api_key'] = sanitize_text_field($get_value('api_key', ''));
        $sanitized['consumer_key'] = sanitize_text_field($get_value('consumer_key', ''));
        $sanitized['consumer_secret'] = sanitize_text_field($get_value('consumer_secret', ''));
        $sanitized['webhook_secret'] = sanitize_text_field($get_value('webhook_secret', ''));

        // Widget position and theme (Widget tab)
        $sanitized['widget_position'] = sanitize_text_field($get_value('widget_position', 'bottom-right'));
        $sanitized['widget_theme'] = sanitize_text_field($get_value('widget_theme', 'light'));

        // Colors (Widget tab)
        $sanitized['widget_color'] = sanitize_hex_color($get_value('widget_color', '#6366f1'));
        $sanitized['widget_secondary_color'] = sanitize_hex_color($get_value('widget_secondary_color', '#212120'));
        $sanitized['widget_accent_color'] = sanitize_hex_color($get_value('widget_accent_color', '#cf795e'));

        // Sizes (Widget tab)
        $sanitized['widget_button_size'] = absint($get_value('widget_button_size', 72));
        $sanitized['widget_chat_width'] = absint($get_value('widget_chat_width', 420));
        $sanitized['widget_chat_height'] = absint($get_value('widget_chat_height', 600));

        // Button style (Widget tab)
        $sanitized['widget_button_style'] = sanitize_text_field($get_value('widget_button_style', 'circle'));
        $sanitized['widget_show_pulse'] = $get_checkbox('widget_show_pulse', true);

        // Texts (Widget tab)
        $sanitized['welcome_message'] = sanitize_textarea_field($get_value('welcome_message', ''));
        $sanitized['widget_subtitle'] = sanitize_text_field($get_value('widget_subtitle', 'Asistente de compras con IA'));
        $sanitized['widget_placeholder'] = sanitize_text_field($get_value('widget_placeholder', 'Escribe tu mensaje...'));
        $sanitized['widget_avatar'] = sanitize_text_field($get_value('widget_avatar', '🌿'));
        $sanitized['widget_brand_name'] = sanitize_text_field($get_value('widget_brand_name', get_bloginfo('name')));

        // Rotating messages (Widget tab)
        $sanitized['rotating_messages_enabled'] = $get_checkbox('rotating_messages_enabled', false);
        $sanitized['welcome_message_2'] = sanitize_textarea_field($get_value('welcome_message_2', ''));
        $sanitized['subtitle_2'] = sanitize_text_field($get_value('subtitle_2', ''));
        $sanitized['welcome_message_3'] = sanitize_textarea_field($get_value('welcome_message_3', ''));
        $sanitized['subtitle_3'] = sanitize_text_field($get_value('subtitle_3', ''));
        $sanitized['rotating_messages_interval'] = absint($get_value('rotating_messages_interval', 5));

        // Features (Widget tab)
        $sanitized['widget_show_promo_message'] = $get_checkbox('widget_show_promo_message', true);
        $sanitized['widget_show_cart'] = $get_checkbox('widget_show_cart', true);
        $sanitized['widget_enable_animations'] = $get_checkbox('widget_enable_animations', true);

        // Promo Badge (Widget tab)
        $sanitized['promo_badge_enabled'] = $get_checkbox('promo_badge_enabled', false);
        $sanitized['promo_badge_type'] = sanitize_text_field($get_value('promo_badge_type', 'discount'));
        $sanitized['promo_badge_discount'] = absint($get_value('promo_badge_discount', 10));
        $sanitized['promo_badge_text'] = sanitize_text_field($get_value('promo_badge_text', 'Descuento especial'));
        $sanitized['promo_badge_color'] = sanitize_hex_color($get_value('promo_badge_color', '#ef4444'));
        $sanitized['promo_badge_shape'] = sanitize_text_field($get_value('promo_badge_shape', 'circle'));
        $sanitized['promo_badge_position'] = sanitize_text_field($get_value('promo_badge_position', 'right'));
        $sanitized['promo_badge_suffix'] = sanitize_text_field($get_value('promo_badge_suffix', 'OFF'));
        $sanitized['promo_badge_prefix'] = sanitize_text_field($get_value('promo_badge_prefix', ''));
        $sanitized['promo_badge_font_size'] = absint($get_value('promo_badge_font_size', 12));

        // Suggested Questions (Widget tab)
        $sanitized['suggested_question_1_text'] = sanitize_text_field($get_value('suggested_question_1_text', 'Recomendaciones personalizadas'));
        $sanitized['suggested_question_1_message'] = sanitize_text_field($get_value('suggested_question_1_message', '¿Qué productos recomiendas para mí?'));
        $sanitized['suggested_question_2_text'] = sanitize_text_field($get_value('suggested_question_2_text', 'Ayuda con mi compra'));
        $sanitized['suggested_question_2_message'] = sanitize_text_field($get_value('suggested_question_2_message', '¿Puedes ayudarme a elegir productos?'));
        $sanitized['suggested_question_3_text'] = sanitize_text_field($get_value('suggested_question_3_text', 'Información de envío'));
        $sanitized['suggested_question_3_message'] = sanitize_text_field($get_value('suggested_question_3_message', '¿Cuáles son las opciones de envío?'));

        // Display settings (Widget tab)
        $sanitized['show_on_mobile'] = $get_checkbox('show_on_mobile', true);
        $sanitized['show_on_product_pages'] = $get_checkbox('show_on_product_pages', true);
        $sanitized['show_on_cart_page'] = $get_checkbox('show_on_cart_page', true);
        $sanitized['show_on_checkout'] = $get_checkbox('show_on_checkout', false);

        return $sanitized;
    }

    /**
     * Enqueue admin scripts and styles
     */
    public function enqueue_admin_scripts($hook) {
        if (strpos($hook, 'kova-agent') === false) {
            return;
        }

        // Setup wizard page - load wizard-specific assets
        if (strpos($hook, 'kova-agent-setup') !== false) {
            wp_enqueue_style(
                'kova-wizard-css',
                KOVA_AGENT_PLUGIN_URL . 'assets/css/wizard.css',
                array(),
                KOVA_AGENT_VERSION
            );
            wp_enqueue_script(
                'kova-wizard-js',
                KOVA_AGENT_PLUGIN_URL . 'assets/js/wizard.js',
                array('jquery'),
                KOVA_AGENT_VERSION,
                true
            );
            wp_localize_script('kova-wizard-js', 'kovaWizard', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('kova_admin_nonce'),
                'siteUrl' => site_url(),
                'storeName' => get_bloginfo('name'),
                'storeEmail' => get_option('admin_email'),
                'currency' => function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'USD',
                'country' => class_exists('WC') && WC()->countries ? WC()->countries->get_base_country() : '',
                'timezone' => wp_timezone_string(),
                'locale' => get_locale(),
                'dashboardUrl' => admin_url('admin.php?page=kova-agent'),
            ));
            return; // Don't load main admin scripts for wizard page
        }

        // Modern CSS
        wp_enqueue_style(
            'kova-admin-modern-css',
            KOVA_AGENT_PLUGIN_URL . 'assets/css/admin-modern.css',
            array(),
            KOVA_AGENT_VERSION
        );

        // Chart.js for analytics charts
        wp_enqueue_script(
            'chartjs',
            'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
            array(),
            '4.4.1',
            true
        );

        wp_enqueue_script(
            'kova-admin-js',
            KOVA_AGENT_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery', 'chartjs'),
            KOVA_AGENT_VERSION,
            true
        );

        $settings = get_option('kova_agent_settings', array());

        wp_localize_script('kova-admin-js', 'kovaAdmin', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('kova_admin_nonce'),
            'siteUrl' => site_url(),
            'apiEndpoint' => $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net',
            'strings' => array(
                'testing' => __('Testing connection...', 'kova-agent'),
                'syncing' => __('Syncing products...', 'kova-agent'),
                'setting_up_webhooks' => __('Setting up webhooks...', 'kova-agent'),
                'success' => __('Success!', 'kova-agent'),
                'error' => __('Error', 'kova-agent'),
                'loading' => __('Loading...', 'kova-agent'),
                'no_data' => __('No data available', 'kova-agent'),
                'conversations' => __('Conversations', 'kova-agent'),
                'recommendations' => __('Recommendations', 'kova-agent'),
                'conversions' => __('Conversions', 'kova-agent'),
            ),
        ));
    }

    /**
     * Get current tab
     */
    private function get_current_tab() {
        return isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'dashboard';
    }

    /**
     * Render SVG icons
     */
    private function render_icon($icon) {
        $icons = array(
            'dashboard' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>',
            'settings' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
            'widget' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>',
            'analytics' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
            'conversations' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/></svg>',
            'conversions' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
            'help' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            'chat' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>',
            'messages' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>',
            'star' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>',
            'cart' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
            'products' => '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
        );

        return isset($icons[$icon]) ? $icons[$icon] : '';
    }

    /**
     * Render main admin page
     */
    public function render_admin_page() {
        $current_tab = $this->get_current_tab();
        $settings = get_option('kova_agent_settings', array());
        $store_name = get_bloginfo('name');
        $store_url = parse_url(site_url(), PHP_URL_HOST);
        $store_initials = strtoupper(substr($store_name, 0, 2));
        ?>
        <div class="kova-modern-admin">
            <div class="kova-admin-layout">
                <!-- Sidebar -->
                <aside class="kova-sidebar">
                    <div class="kova-sidebar-header">
                        <a href="<?php echo admin_url('admin.php?page=kova-agent'); ?>" class="kova-sidebar-logo">
                            <svg class="kova-sidebar-logo-svg" viewBox="0 0 453.05 161.03" xmlns="http://www.w3.org/2000/svg"><rect fill="#6b5afc" x="0" y="0" width="55.94" height="161.03" rx="27.97" ry="27.97"/><path fill="#6b5afc" d="M102.81,0h0C88.46,0,76.63,10.81,75.03,24.74h0c-.12,1.06-.19,2.14-.19,3.23h0c0,.99.05,1.97.15,2.94l-.15,25.04h27.97c15.45,0,27.97-12.52,27.97-27.97h0C130.78,12.52,118.26,0,102.81,0Z"/><path fill="#6b5afc" d="M114.74,158.27h0c-20.48,0-37.34-15.43-39.63-35.29h0c-.17-1.51-.27-3.05-.27-4.61h0c0-1.41.08-2.81.22-4.19l-.22-35.71h39.9c22.04,0,39.9,17.87,39.9,39.9h0c0,22.04-17.87,39.9-39.9,39.9Z"/><path fill="#232323" d="M192.25,105.24V32.6c0-2.12,1.72-3.84,3.84-3.84h.84c2.12,0,3.84,1.72,3.84,3.84v38.23c0,2.12,1.72,3.84,3.84,3.84h14.21c1.17,0,2.27-.53,3-1.44l17.47-21.92c.73-.91,1.83-1.44,3-1.44h.18c3.23,0,5.01,3.74,2.98,6.25l-15.97,19.74c-1.1,1.36-1.14,3.28-.11,4.69l16.52,22.43c1.86,2.53.06,6.11-3.09,6.11h-.44c-1.21,0-2.35-.57-3.07-1.54l-17.59-23.53c-.72-.97-1.86-1.54-3.07-1.54h-14.02c-2.12,0-3.84,1.72-3.84,3.84v18.94c0,2.12-1.72,3.84-3.84,3.84h-.84c-2.12,0-3.84-1.72-3.84-3.84Z"/><path fill="#232323" d="M255.65,79.47c0-17.98,12.82-30.8,32.12-30.8s32.24,12.82,32.24,30.8-12.82,30.8-32.24,30.8-32.12-12.82-32.12-30.8ZM311.63,79.47c0-14.26-7.55-23.13-23.85-23.13s-23.73,8.87-23.73,23.13,7.43,23.13,23.73,23.13,23.85-8.75,23.85-23.13Z"/><path fill="#232323" d="M352.53,106.89l-24.62-51.54c-1.22-2.55.64-5.49,3.46-5.49h.71c1.48,0,2.84.86,3.47,2.2l22.93,48.62h.72l22.82-48.61c.63-1.35,1.98-2.21,3.47-2.21h.71c2.82,0,4.68,2.94,3.46,5.49l-24.62,51.54c-.64,1.33-1.98,2.18-3.46,2.18h-5.59c-1.48,0-2.82-.85-3.46-2.18Z"/><path fill="#232323" d="M397.55,95.17c0-9.71,8.03-13.9,19.06-15.1l24.75-2.74c1.94-.21,3.41-1.86,3.41-3.81v-1.12c0-11.51-5.03-16.06-17.98-16.06s-19.42,4.55-19.42,14.98v.48h-8.51v-.48c0-12.47,10.31-22.65,28.53-22.65s25.65,10.31,25.65,23.37v33.2c0,2.12-1.72,3.84-3.84,3.84h0c-2.12,0-3.84-1.72-3.84-3.84v-12.11h-.6c-3.48,10.91-13.9,17.14-27.69,17.14-11.63,0-19.54-5.51-19.54-15.1ZM419.01,103.68c14.38,0,25.77-6.35,25.77-20.61v-.48l-25.53,2.88c-8.87.84-13.18,3-13.18,9.11s3.96,9.11,12.94,9.11Z"/></svg>
                        </a>
                    </div>

                    <nav class="kova-sidebar-nav">
                        <div class="kova-nav-section">
                            <div class="kova-nav-section-title"><?php _e('Overview', 'kova-agent'); ?></div>
                            <a href="<?php echo admin_url('admin.php?page=kova-agent&tab=dashboard'); ?>"
                               class="kova-nav-item <?php echo $current_tab === 'dashboard' ? 'active' : ''; ?>">
                                <?php echo $this->render_icon('dashboard'); ?>
                                <?php _e('Dashboard', 'kova-agent'); ?>
                            </a>
                            <a href="<?php echo admin_url('admin.php?page=kova-agent&tab=analytics'); ?>"
                               class="kova-nav-item <?php echo $current_tab === 'analytics' ? 'active' : ''; ?>">
                                <?php echo $this->render_icon('analytics'); ?>
                                <?php _e('Analytics', 'kova-agent'); ?>
                            </a>
                        </div>

                        <div class="kova-nav-section">
                            <div class="kova-nav-section-title"><?php _e('Chat', 'kova-agent'); ?></div>
                            <a href="<?php echo admin_url('admin.php?page=kova-agent&tab=conversations'); ?>"
                               class="kova-nav-item <?php echo $current_tab === 'conversations' ? 'active' : ''; ?>">
                                <?php echo $this->render_icon('conversations'); ?>
                                <?php _e('Conversations', 'kova-agent'); ?>
                            </a>
                            <a href="<?php echo admin_url('admin.php?page=kova-agent&tab=conversions'); ?>"
                               class="kova-nav-item <?php echo $current_tab === 'conversions' ? 'active' : ''; ?>">
                                <?php echo $this->render_icon('conversions'); ?>
                                <?php _e('Conversions', 'kova-agent'); ?>
                            </a>
                        </div>

                        <div class="kova-nav-section">
                            <div class="kova-nav-section-title"><?php _e('Configuration', 'kova-agent'); ?></div>
                            <a href="<?php echo admin_url('admin.php?page=kova-agent&tab=widget'); ?>"
                               class="kova-nav-item <?php echo $current_tab === 'widget' ? 'active' : ''; ?>">
                                <?php echo $this->render_icon('widget'); ?>
                                <?php _e('Widget', 'kova-agent'); ?>
                            </a>
                            <a href="<?php echo admin_url('admin.php?page=kova-agent&tab=settings'); ?>"
                               class="kova-nav-item <?php echo $current_tab === 'settings' ? 'active' : ''; ?>">
                                <?php echo $this->render_icon('settings'); ?>
                                <?php _e('Settings', 'kova-agent'); ?>
                            </a>
                        </div>

                        <div class="kova-nav-section">
                            <div class="kova-nav-section-title"><?php _e('Help', 'kova-agent'); ?></div>
                            <a href="https://docs.kova.ai" target="_blank" class="kova-nav-item">
                                <?php echo $this->render_icon('help'); ?>
                                <?php _e('Documentation', 'kova-agent'); ?>
                            </a>
                        </div>
                    </nav>

                    <div class="kova-sidebar-footer">
                        <div class="kova-store-info">
                            <div class="kova-store-avatar"><?php echo esc_html($store_initials); ?></div>
                            <div class="kova-store-details">
                                <div class="kova-store-name"><?php echo esc_html($store_name); ?></div>
                                <div class="kova-store-url"><?php echo esc_html($store_url); ?></div>
                            </div>
                        </div>
                    </div>
                </aside>

                <!-- Main Content -->
                <main class="kova-main-content">
                    <?php
                    switch ($current_tab) {
                        case 'analytics':
                            $this->render_analytics_tab();
                            break;
                        case 'conversations':
                            $this->render_conversations_tab();
                            break;
                        case 'conversions':
                            $this->render_conversions_tab();
                            break;
                        case 'widget':
                            $this->render_widget_tab();
                            break;
                        case 'settings':
                            $this->render_settings_tab();
                            break;
                        default:
                            $this->render_dashboard_tab();
                            break;
                    }
                    ?>
                </main>
            </div>
        </div>
        <?php
    }

    /**
     * Render Dashboard Tab
     */
    private function render_dashboard_tab() {
        $settings = get_option('kova_agent_settings', array());
        $is_connected = !empty($settings['consumer_key']) && !empty($settings['consumer_secret']);
        $is_enabled = !empty($settings['enabled']);
        ?>
        <div class="kova-page-header">
            <div class="kova-page-header-content">
                <div>
                    <h1 class="kova-page-title"><?php _e('Dashboard', 'kova-agent'); ?></h1>
                    <p class="kova-page-subtitle"><?php _e('Overview of your Kova Agent performance', 'kova-agent'); ?></p>
                </div>
                <div>
                    <span class="kova-badge <?php echo $is_enabled ? 'kova-badge-success' : 'kova-badge-warning'; ?>">
                        <?php echo $is_enabled ? __('Active', 'kova-agent') : __('Inactive', 'kova-agent'); ?>
                    </span>
                </div>
            </div>
        </div>

        <div class="kova-page-content">
            <?php if (!$is_connected): ?>
            <div class="kova-quick-setup">
                <h3><?php _e('Complete Your Setup', 'kova-agent'); ?></h3>
                <p><?php _e('Connect your WooCommerce store to start using the AI assistant.', 'kova-agent'); ?></p>
                <a href="<?php echo admin_url('admin.php?page=kova-agent&tab=settings'); ?>" class="kova-btn">
                    <?php _e('Configure Settings', 'kova-agent'); ?>
                </a>
            </div>
            <?php endif; ?>

            <div class="kova-stats-grid" id="kova-dashboard-stats">
                <div class="kova-stat-card">
                    <div class="kova-stat-icon primary">
                        <?php echo $this->render_icon('chat'); ?>
                    </div>
                    <div class="kova-stat-value" id="kova-dash-conversations">-</div>
                    <div class="kova-stat-label"><?php _e('Conversations', 'kova-agent'); ?></div>
                </div>
                <div class="kova-stat-card">
                    <div class="kova-stat-icon accent">
                        <?php echo $this->render_icon('messages'); ?>
                    </div>
                    <div class="kova-stat-value" id="kova-dash-messages">-</div>
                    <div class="kova-stat-label"><?php _e('Messages', 'kova-agent'); ?></div>
                </div>
                <div class="kova-stat-card">
                    <div class="kova-stat-icon warning">
                        <?php echo $this->render_icon('star'); ?>
                    </div>
                    <div class="kova-stat-value" id="kova-dash-recommendations">-</div>
                    <div class="kova-stat-label"><?php _e('Recommendations', 'kova-agent'); ?></div>
                </div>
                <div class="kova-stat-card">
                    <div class="kova-stat-icon success">
                        <?php echo $this->render_icon('cart'); ?>
                    </div>
                    <div class="kova-stat-value" id="kova-dash-conversions">-</div>
                    <div class="kova-stat-label"><?php _e('Conversions', 'kova-agent'); ?></div>
                </div>
            </div>

            <div class="kova-two-columns">
                <div class="kova-main-column">
                    <div class="kova-chart-container">
                        <h3 class="kova-chart-title"><?php _e('Activity Over Time', 'kova-agent'); ?></h3>
                        <canvas id="kova-dashboard-chart"></canvas>
                    </div>
                </div>
                <div class="kova-side-column">
                    <div class="kova-info-box">
                        <h3><?php _e('Store Info', 'kova-agent'); ?></h3>
                        <div class="kova-info-item">
                            <span class="kova-info-label"><?php _e('WooCommerce', 'kova-agent'); ?></span>
                            <span class="kova-info-value"><?php echo esc_html(WC()->version ?? 'N/A'); ?></span>
                        </div>
                        <div class="kova-info-item">
                            <span class="kova-info-label"><?php _e('Currency', 'kova-agent'); ?></span>
                            <span class="kova-info-value"><?php echo esc_html(get_woocommerce_currency()); ?></span>
                        </div>
                        <div class="kova-info-item">
                            <span class="kova-info-label"><?php _e('Products', 'kova-agent'); ?></span>
                            <span class="kova-info-value"><?php echo esc_html(wp_count_posts('product')->publish); ?></span>
                        </div>
                        <div class="kova-info-item">
                            <span class="kova-info-label"><?php _e('Status', 'kova-agent'); ?></span>
                            <span class="kova-badge <?php echo $is_connected ? 'kova-badge-success' : 'kova-badge-error'; ?>">
                                <?php echo $is_connected ? __('Connected', 'kova-agent') : __('Not Connected', 'kova-agent'); ?>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Render Analytics Tab
     */
    private function render_analytics_tab() {
        ?>
        <div class="kova-page-header">
            <div class="kova-page-header-content">
                <div>
                    <h1 class="kova-page-title"><?php _e('Analytics', 'kova-agent'); ?></h1>
                    <p class="kova-page-subtitle"><?php _e('Track your chat performance and engagement', 'kova-agent'); ?></p>
                </div>
            </div>
        </div>

        <div class="kova-page-content">
            <div class="kova-analytics-container">
                <div class="kova-filters-bar">
                    <div class="kova-filter-group">
                        <label class="kova-filter-label" for="kova-start-date"><?php _e('From:', 'kova-agent'); ?></label>
                        <input type="date" id="kova-start-date" class="kova-filter-input" value="<?php echo date('Y-m-d', strtotime('-7 days')); ?>">
                    </div>
                    <div class="kova-filter-group">
                        <label class="kova-filter-label" for="kova-end-date"><?php _e('To:', 'kova-agent'); ?></label>
                        <input type="date" id="kova-end-date" class="kova-filter-input" value="<?php echo date('Y-m-d'); ?>">
                    </div>
                    <button type="button" id="kova-refresh-analytics" class="kova-btn kova-btn-primary">
                        <?php _e('Refresh', 'kova-agent'); ?>
                    </button>
                </div>

                <div class="kova-stats-grid">
                    <div class="kova-stat-card">
                        <div class="kova-stat-icon primary"><?php echo $this->render_icon('chat'); ?></div>
                        <div class="kova-stat-value" id="kova-stat-conversations">-</div>
                        <div class="kova-stat-label"><?php _e('Conversations', 'kova-agent'); ?></div>
                    </div>
                    <div class="kova-stat-card">
                        <div class="kova-stat-icon accent"><?php echo $this->render_icon('messages'); ?></div>
                        <div class="kova-stat-value" id="kova-stat-messages">-</div>
                        <div class="kova-stat-label"><?php _e('Messages', 'kova-agent'); ?></div>
                    </div>
                    <div class="kova-stat-card">
                        <div class="kova-stat-icon warning"><?php echo $this->render_icon('star'); ?></div>
                        <div class="kova-stat-value" id="kova-stat-recommendations">-</div>
                        <div class="kova-stat-label"><?php _e('Recommendations', 'kova-agent'); ?></div>
                    </div>
                    <div class="kova-stat-card">
                        <div class="kova-stat-icon success"><?php echo $this->render_icon('products'); ?></div>
                        <div class="kova-stat-value" id="kova-stat-products">-</div>
                        <div class="kova-stat-label"><?php _e('Products Synced', 'kova-agent'); ?></div>
                    </div>
                </div>

                <div class="kova-chart-container">
                    <h3 class="kova-chart-title"><?php _e('Activity Over Time', 'kova-agent'); ?></h3>
                    <canvas id="kova-analytics-chart"></canvas>
                </div>

                <div id="kova-analytics-loading" class="kova-loading" style="display: none;">
                    <div class="kova-loading-spinner"></div>
                    <p class="kova-loading-text"><?php _e('Loading analytics...', 'kova-agent'); ?></p>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Render Conversations Tab
     */
    private function render_conversations_tab() {
        ?>
        <div class="kova-page-header">
            <div class="kova-page-header-content">
                <div>
                    <h1 class="kova-page-title"><?php _e('Conversations', 'kova-agent'); ?></h1>
                    <p class="kova-page-subtitle"><?php _e('Review chat history with your customers', 'kova-agent'); ?></p>
                </div>
            </div>
        </div>

        <div class="kova-page-content">
            <div class="kova-conversations-container">
                <div class="kova-filters-bar">
                    <div class="kova-filter-group">
                        <label class="kova-filter-label" for="kova-conversation-date"><?php _e('Select Date:', 'kova-agent'); ?></label>
                        <input type="date" id="kova-conversation-date" class="kova-filter-input" value="<?php echo date('Y-m-d'); ?>">
                    </div>
                    <button type="button" id="kova-load-conversations" class="kova-btn kova-btn-primary">
                        <?php _e('Load Conversations', 'kova-agent'); ?>
                    </button>
                </div>

                <div class="kova-card">
                    <div class="kova-card-header">
                        <h3 class="kova-card-title"><?php _e('Chat History', 'kova-agent'); ?></h3>
                        <div class="kova-conversations-summary">
                            <span><strong><?php _e('Total:', 'kova-agent'); ?></strong> <span id="kova-total-conversations">-</span></span>
                            <span style="margin-left: 1rem;"><strong><?php _e('Messages:', 'kova-agent'); ?></strong> <span id="kova-total-messages">-</span></span>
                        </div>
                    </div>
                    <div id="kova-conversations-list" class="kova-conversations-list">
                        <div class="kova-empty-state">
                            <div class="kova-empty-state-icon"><?php echo $this->render_icon('conversations'); ?></div>
                            <h3 class="kova-empty-state-title"><?php _e('No conversations yet', 'kova-agent'); ?></h3>
                            <p class="kova-empty-state-description"><?php _e('Select a date and click "Load Conversations" to view chat history.', 'kova-agent'); ?></p>
                        </div>
                    </div>
                </div>

                <div id="kova-conversations-loading" class="kova-loading" style="display: none;">
                    <div class="kova-loading-spinner"></div>
                    <p class="kova-loading-text"><?php _e('Loading conversations...', 'kova-agent'); ?></p>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Render Conversions Tab
     */
    private function render_conversions_tab() {
        ?>
        <div class="kova-page-header">
            <div class="kova-page-header-content">
                <div>
                    <h1 class="kova-page-title"><?php _e('Conversions', 'kova-agent'); ?></h1>
                    <p class="kova-page-subtitle"><?php _e('Track sales attributed to chat recommendations', 'kova-agent'); ?></p>
                </div>
            </div>
        </div>

        <div class="kova-page-content">
            <div class="kova-conversions-container">
                <div class="kova-filters-bar">
                    <div class="kova-filter-group">
                        <label class="kova-filter-label" for="kova-conversion-days"><?php _e('Period:', 'kova-agent'); ?></label>
                        <select id="kova-conversion-days" class="kova-filter-select">
                            <option value="7"><?php _e('Last 7 days', 'kova-agent'); ?></option>
                            <option value="14"><?php _e('Last 14 days', 'kova-agent'); ?></option>
                            <option value="30" selected><?php _e('Last 30 days', 'kova-agent'); ?></option>
                            <option value="90"><?php _e('Last 90 days', 'kova-agent'); ?></option>
                        </select>
                    </div>
                    <button type="button" id="kova-load-conversions" class="kova-btn kova-btn-primary">
                        <?php _e('Load Data', 'kova-agent'); ?>
                    </button>
                </div>

                <div class="kova-stats-grid">
                    <div class="kova-stat-card">
                        <div class="kova-stat-icon success"><?php echo $this->render_icon('cart'); ?></div>
                        <div class="kova-stat-value" id="kova-conv-total">-</div>
                        <div class="kova-stat-label"><?php _e('Total Conversions', 'kova-agent'); ?></div>
                    </div>
                    <div class="kova-stat-card">
                        <div class="kova-stat-icon primary"><?php echo $this->render_icon('analytics'); ?></div>
                        <div class="kova-stat-value" id="kova-conv-rate">-</div>
                        <div class="kova-stat-label"><?php _e('Conversion Rate', 'kova-agent'); ?></div>
                    </div>
                    <div class="kova-stat-card">
                        <div class="kova-stat-icon accent"><?php echo $this->render_icon('star'); ?></div>
                        <div class="kova-stat-value" id="kova-conv-revenue">-</div>
                        <div class="kova-stat-label"><?php _e('Total Revenue', 'kova-agent'); ?></div>
                    </div>
                    <div class="kova-stat-card">
                        <div class="kova-stat-icon warning"><?php echo $this->render_icon('products'); ?></div>
                        <div class="kova-stat-value" id="kova-conv-aov">-</div>
                        <div class="kova-stat-label"><?php _e('Average Order Value', 'kova-agent'); ?></div>
                    </div>
                </div>

                <div class="kova-two-columns">
                    <div class="kova-main-column">
                        <div class="kova-chart-container">
                            <h3 class="kova-chart-title"><?php _e('Conversions Over Time', 'kova-agent'); ?></h3>
                            <canvas id="kova-conversions-chart"></canvas>
                        </div>

                        <div class="kova-table-container">
                            <div class="kova-table-header">
                                <h3 class="kova-table-title"><?php _e('Top Converting Products', 'kova-agent'); ?></h3>
                            </div>
                            <table class="kova-table">
                                <thead>
                                    <tr>
                                        <th><?php _e('Product', 'kova-agent'); ?></th>
                                        <th><?php _e('Recommendations', 'kova-agent'); ?></th>
                                        <th><?php _e('Conversions', 'kova-agent'); ?></th>
                                        <th><?php _e('Rate', 'kova-agent'); ?></th>
                                        <th><?php _e('Revenue', 'kova-agent'); ?></th>
                                    </tr>
                                </thead>
                                <tbody id="kova-top-products-body">
                                    <tr>
                                        <td colspan="5" class="kova-empty-state-description"><?php _e('Click "Load Data" to view top products.', 'kova-agent'); ?></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="kova-side-column">
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Recent Activity', 'kova-agent'); ?></h3>
                            </div>
                            <div id="kova-activity-list" class="kova-activity-list">
                                <div class="kova-empty-state-description"><?php _e('Click "Load Data" to view recent activity.', 'kova-agent'); ?></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="kova-conversions-loading" class="kova-loading" style="display: none;">
                    <div class="kova-loading-spinner"></div>
                    <p class="kova-loading-text"><?php _e('Loading conversion data...', 'kova-agent'); ?></p>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Render Widget Tab
     */
    private function render_widget_tab() {
        $settings = get_option('kova_agent_settings', array());

        // Get all widget settings with defaults
        $widget_color = $settings['widget_color'] ?? '#6366f1';
        $widget_secondary_color = $settings['widget_secondary_color'] ?? '#212120';
        $widget_accent_color = $settings['widget_accent_color'] ?? '#cf795e';
        $widget_position = $settings['widget_position'] ?? 'bottom-right';
        $widget_theme = $settings['widget_theme'] ?? 'light';
        $welcome_message = $settings['welcome_message'] ?? '';
        $widget_brand_name = $settings['widget_brand_name'] ?? get_bloginfo('name');
        $widget_subtitle = $settings['widget_subtitle'] ?? 'Asistente de compras con IA';
        $widget_placeholder = $settings['widget_placeholder'] ?? 'Escribe tu mensaje...';
        $widget_avatar = $settings['widget_avatar'] ?? '🌿';
        $widget_button_size = $settings['widget_button_size'] ?? 72;
        $widget_button_style = $settings['widget_button_style'] ?? 'circle';
        $widget_show_pulse = $settings['widget_show_pulse'] ?? true;
        $widget_chat_width = $settings['widget_chat_width'] ?? 420;
        $widget_chat_height = $settings['widget_chat_height'] ?? 600;
        ?>
        <div class="kova-page-header">
            <div class="kova-page-header-content">
                <div>
                    <h1 class="kova-page-title"><?php _e('Widget Configuration', 'kova-agent'); ?></h1>
                    <p class="kova-page-subtitle"><?php _e('Customize the appearance and behavior of your chat widget', 'kova-agent'); ?></p>
                </div>
            </div>
        </div>

        <div class="kova-page-content">
            <form method="post" action="options.php">
                <?php settings_fields('kova_agent_settings_group'); ?>

                <div class="kova-two-columns">
                    <div class="kova-main-column">
                        <!-- Colors Section -->
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Colors', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label"><?php _e('Primary Color', 'kova-agent'); ?></label>
                                <div class="kova-color-picker-wrapper">
                                    <input type="color"
                                           id="kova_widget_color"
                                           name="kova_agent_settings[widget_color]"
                                           value="<?php echo esc_attr($widget_color); ?>"
                                           class="kova-color-preview">
                                    <input type="text"
                                           value="<?php echo esc_attr($widget_color); ?>"
                                           class="kova-form-input"
                                           style="max-width: 120px;"
                                           id="kova_widget_color_text">
                                </div>
                                <p class="kova-form-hint"><?php _e('Main color for header and buttons', 'kova-agent'); ?></p>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label"><?php _e('Secondary Color', 'kova-agent'); ?></label>
                                <div class="kova-color-picker-wrapper">
                                    <input type="color"
                                           id="kova_widget_secondary_color"
                                           name="kova_agent_settings[widget_secondary_color]"
                                           value="<?php echo esc_attr($widget_secondary_color); ?>"
                                           class="kova-color-preview">
                                    <input type="text"
                                           value="<?php echo esc_attr($widget_secondary_color); ?>"
                                           class="kova-form-input"
                                           style="max-width: 120px;"
                                           id="kova_widget_secondary_color_text">
                                </div>
                                <p class="kova-form-hint"><?php _e('Color for text and secondary elements', 'kova-agent'); ?></p>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label"><?php _e('Accent Color', 'kova-agent'); ?></label>
                                <div class="kova-color-picker-wrapper">
                                    <input type="color"
                                           id="kova_widget_accent_color"
                                           name="kova_agent_settings[widget_accent_color]"
                                           value="<?php echo esc_attr($widget_accent_color); ?>"
                                           class="kova-color-preview">
                                    <input type="text"
                                           value="<?php echo esc_attr($widget_accent_color); ?>"
                                           class="kova-form-input"
                                           style="max-width: 120px;"
                                           id="kova_widget_accent_color_text">
                                </div>
                                <p class="kova-form-hint"><?php _e('Color for highlights and accents', 'kova-agent'); ?></p>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label"><?php _e('Theme', 'kova-agent'); ?></label>
                                <select name="kova_agent_settings[widget_theme]" class="kova-form-select">
                                    <option value="light" <?php selected($widget_theme, 'light'); ?>><?php _e('Light', 'kova-agent'); ?></option>
                                    <option value="dark" <?php selected($widget_theme, 'dark'); ?>><?php _e('Dark', 'kova-agent'); ?></option>
                                </select>
                            </div>
                        </div>

                        <!-- Position & Size Section -->
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Position & Size', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label"><?php _e('Widget Position', 'kova-agent'); ?></label>
                                <div class="kova-position-grid">
                                    <div class="kova-position-option <?php echo $widget_position === 'top-left' ? 'selected' : ''; ?>" data-position="top-left">
                                        <?php _e('Top Left', 'kova-agent'); ?>
                                    </div>
                                    <div class="kova-position-option <?php echo $widget_position === 'top-right' ? 'selected' : ''; ?>" data-position="top-right">
                                        <?php _e('Top Right', 'kova-agent'); ?>
                                    </div>
                                    <div class="kova-position-option <?php echo $widget_position === 'bottom-left' ? 'selected' : ''; ?>" data-position="bottom-left">
                                        <?php _e('Bottom Left', 'kova-agent'); ?>
                                    </div>
                                    <div class="kova-position-option <?php echo $widget_position === 'bottom-right' ? 'selected' : ''; ?>" data-position="bottom-right">
                                        <?php _e('Bottom Right', 'kova-agent'); ?>
                                    </div>
                                </div>
                                <input type="hidden" name="kova_agent_settings[widget_position]" id="kova_widget_position" value="<?php echo esc_attr($widget_position); ?>">
                            </div>

                            <div class="kova-form-row">
                                <div class="kova-form-group kova-form-group-half">
                                    <label class="kova-form-label" for="kova_widget_button_size"><?php _e('Button Size (px)', 'kova-agent'); ?></label>
                                    <input type="number"
                                           id="kova_widget_button_size"
                                           name="kova_agent_settings[widget_button_size]"
                                           value="<?php echo esc_attr($widget_button_size); ?>"
                                           class="kova-form-input"
                                           min="48" max="120">
                                </div>
                                <div class="kova-form-group kova-form-group-half">
                                    <label class="kova-form-label"><?php _e('Button Style', 'kova-agent'); ?></label>
                                    <select name="kova_agent_settings[widget_button_style]" class="kova-form-select">
                                        <option value="circle" <?php selected($widget_button_style, 'circle'); ?>><?php _e('Circle', 'kova-agent'); ?></option>
                                        <option value="square" <?php selected($widget_button_style, 'square'); ?>><?php _e('Square', 'kova-agent'); ?></option>
                                    </select>
                                </div>
                            </div>

                            <div class="kova-form-row">
                                <div class="kova-form-group kova-form-group-half">
                                    <label class="kova-form-label" for="kova_widget_chat_width"><?php _e('Chat Width (px)', 'kova-agent'); ?></label>
                                    <input type="number"
                                           id="kova_widget_chat_width"
                                           name="kova_agent_settings[widget_chat_width]"
                                           value="<?php echo esc_attr($widget_chat_width); ?>"
                                           class="kova-form-input"
                                           min="320" max="600">
                                </div>
                                <div class="kova-form-group kova-form-group-half">
                                    <label class="kova-form-label" for="kova_widget_chat_height"><?php _e('Chat Height (px)', 'kova-agent'); ?></label>
                                    <input type="number"
                                           id="kova_widget_chat_height"
                                           name="kova_agent_settings[widget_chat_height]"
                                           value="<?php echo esc_attr($widget_chat_height); ?>"
                                           class="kova-form-input"
                                           min="400" max="800">
                                </div>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[widget_show_pulse]"
                                           value="1"
                                           <?php checked($widget_show_pulse); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Show Pulse Animation', 'kova-agent'); ?></span>
                            </div>
                        </div>

                        <!-- Content Section -->
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Content', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-row">
                                <div class="kova-form-group kova-form-group-half">
                                    <label class="kova-form-label" for="kova_widget_brand_name"><?php _e('Brand Name', 'kova-agent'); ?></label>
                                    <input type="text"
                                           id="kova_widget_brand_name"
                                           name="kova_agent_settings[widget_brand_name]"
                                           value="<?php echo esc_attr($widget_brand_name); ?>"
                                           class="kova-form-input"
                                           placeholder="<?php echo esc_attr(get_bloginfo('name')); ?>">
                                </div>
                                <div class="kova-form-group kova-form-group-half">
                                    <label class="kova-form-label" for="kova_widget_avatar"><?php _e('Avatar/Emoji', 'kova-agent'); ?></label>
                                    <input type="text"
                                           id="kova_widget_avatar"
                                           name="kova_agent_settings[widget_avatar]"
                                           value="<?php echo esc_attr($widget_avatar); ?>"
                                           class="kova-form-input"
                                           placeholder="🌿">
                                </div>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label" for="kova_widget_subtitle"><?php _e('Subtitle', 'kova-agent'); ?></label>
                                <input type="text"
                                       id="kova_widget_subtitle"
                                       name="kova_agent_settings[widget_subtitle]"
                                       value="<?php echo esc_attr($widget_subtitle); ?>"
                                       class="kova-form-input"
                                       placeholder="<?php _e('AI Shopping Assistant', 'kova-agent'); ?>">
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label" for="kova_welcome_message"><?php _e('Welcome Message', 'kova-agent'); ?></label>
                                <textarea id="kova_welcome_message"
                                          name="kova_agent_settings[welcome_message]"
                                          class="kova-form-textarea"
                                          placeholder="<?php _e('Hello! How can I help you today?', 'kova-agent'); ?>"><?php echo esc_textarea($welcome_message); ?></textarea>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label" for="kova_widget_placeholder"><?php _e('Input Placeholder', 'kova-agent'); ?></label>
                                <input type="text"
                                       id="kova_widget_placeholder"
                                       name="kova_agent_settings[widget_placeholder]"
                                       value="<?php echo esc_attr($widget_placeholder); ?>"
                                       class="kova-form-input"
                                       placeholder="<?php _e('Write your message...', 'kova-agent'); ?>">
                            </div>
                        </div>

                        <!-- Rotating Messages Section -->
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Rotating Messages', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[rotating_messages_enabled]"
                                           value="1"
                                           id="kova_rotating_messages_enabled"
                                           <?php checked(!empty($settings['rotating_messages_enabled'])); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Enable Rotating Messages', 'kova-agent'); ?></span>
                                <p class="kova-form-hint"><?php _e('Display different welcome messages that rotate automatically', 'kova-agent'); ?></p>
                            </div>

                            <div id="kova-rotating-messages-fields">
                                <div class="kova-form-group">
                                    <label class="kova-form-label" for="kova_rotating_messages_interval"><?php _e('Rotation Interval (seconds)', 'kova-agent'); ?></label>
                                    <input type="number"
                                           id="kova_rotating_messages_interval"
                                           name="kova_agent_settings[rotating_messages_interval]"
                                           value="<?php echo esc_attr($settings['rotating_messages_interval'] ?? 5); ?>"
                                           class="kova-form-input"
                                           min="3" max="30"
                                           style="max-width: 120px;">
                                </div>

                                <div class="kova-form-group">
                                    <label class="kova-form-label"><?php _e('Message 2', 'kova-agent'); ?></label>
                                    <textarea name="kova_agent_settings[welcome_message_2]"
                                              class="kova-form-textarea"
                                              placeholder="<?php _e('Second welcome message...', 'kova-agent'); ?>"><?php echo esc_textarea($settings['welcome_message_2'] ?? ''); ?></textarea>
                                    <input type="text"
                                           name="kova_agent_settings[subtitle_2]"
                                           value="<?php echo esc_attr($settings['subtitle_2'] ?? ''); ?>"
                                           class="kova-form-input"
                                           style="margin-top: 0.5rem;"
                                           placeholder="<?php _e('Subtitle 2 (optional)', 'kova-agent'); ?>">
                                </div>

                                <div class="kova-form-group">
                                    <label class="kova-form-label"><?php _e('Message 3', 'kova-agent'); ?></label>
                                    <textarea name="kova_agent_settings[welcome_message_3]"
                                              class="kova-form-textarea"
                                              placeholder="<?php _e('Third welcome message...', 'kova-agent'); ?>"><?php echo esc_textarea($settings['welcome_message_3'] ?? ''); ?></textarea>
                                    <input type="text"
                                           name="kova_agent_settings[subtitle_3]"
                                           value="<?php echo esc_attr($settings['subtitle_3'] ?? ''); ?>"
                                           class="kova-form-input"
                                           style="margin-top: 0.5rem;"
                                           placeholder="<?php _e('Subtitle 3 (optional)', 'kova-agent'); ?>">
                                </div>
                            </div>
                        </div>

                        <!-- Features Section -->
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Features', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[widget_show_cart]"
                                           value="1"
                                           <?php checked($settings['widget_show_cart'] ?? true); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Show Cart in Widget', 'kova-agent'); ?></span>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[widget_show_promo_message]"
                                           value="1"
                                           <?php checked($settings['widget_show_promo_message'] ?? true); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Show Promo Messages', 'kova-agent'); ?></span>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[widget_enable_animations]"
                                           value="1"
                                           <?php checked($settings['widget_enable_animations'] ?? true); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Enable Animations', 'kova-agent'); ?></span>
                            </div>
                        </div>

                        <!-- Promo Badge Section -->
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Promo Badge', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[promo_badge_enabled]"
                                           value="1"
                                           id="kova_promo_badge_enabled"
                                           <?php checked(!empty($settings['promo_badge_enabled'])); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Enable Promo Badge', 'kova-agent'); ?></span>
                                <p class="kova-form-hint"><?php _e('Show a promotional badge on the chat button', 'kova-agent'); ?></p>
                            </div>

                            <div id="kova-promo-badge-fields">
                                <!-- Badge Type Selector -->
                                <div class="kova-form-group">
                                    <label class="kova-form-label"><?php _e('Badge Type', 'kova-agent'); ?></label>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <label style="display: flex; align-items: center; padding: 0.5rem 1rem; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; <?php echo ($settings['promo_badge_type'] ?? 'discount') === 'discount' ? 'border-color: #6366f1; background: rgba(99, 102, 241, 0.1);' : ''; ?>">
                                            <input type="radio"
                                                   name="kova_agent_settings[promo_badge_type]"
                                                   value="discount"
                                                   id="kova_promo_badge_type_discount"
                                                   <?php checked(($settings['promo_badge_type'] ?? 'discount') === 'discount'); ?>
                                                   style="margin-right: 0.5rem;">
                                            <?php _e('💰 Discount', 'kova-agent'); ?>
                                        </label>
                                        <label style="display: flex; align-items: center; padding: 0.5rem 1rem; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; <?php echo ($settings['promo_badge_type'] ?? 'discount') === 'notice' ? 'border-color: #6366f1; background: rgba(99, 102, 241, 0.1);' : ''; ?>">
                                            <input type="radio"
                                                   name="kova_agent_settings[promo_badge_type]"
                                                   value="notice"
                                                   id="kova_promo_badge_type_notice"
                                                   <?php checked(($settings['promo_badge_type'] ?? 'discount') === 'notice'); ?>
                                                   style="margin-right: 0.5rem;">
                                            <?php _e('📢 Notice', 'kova-agent'); ?>
                                        </label>
                                    </div>
                                    <p class="kova-form-hint"><?php _e('Discount shows percentage, Notice shows custom text', 'kova-agent'); ?></p>
                                </div>

                                <!-- Discount Type Fields -->
                                <div id="kova-promo-badge-discount-fields" style="<?php echo ($settings['promo_badge_type'] ?? 'discount') === 'notice' ? 'display: none;' : ''; ?>">
                                    <div class="kova-form-row">
                                        <div class="kova-form-group kova-form-group-half">
                                            <label class="kova-form-label"><?php _e('Discount Value', 'kova-agent'); ?></label>
                                            <input type="number"
                                                   name="kova_agent_settings[promo_badge_discount]"
                                                   value="<?php echo esc_attr($settings['promo_badge_discount'] ?? 10); ?>"
                                                   class="kova-form-input"
                                                   min="1" max="100">
                                        </div>
                                        <div class="kova-form-group kova-form-group-half">
                                            <label class="kova-form-label"><?php _e('Badge Color', 'kova-agent'); ?></label>
                                            <div class="kova-color-picker-wrapper">
                                                <input type="color"
                                                       name="kova_agent_settings[promo_badge_color]"
                                                       value="<?php echo esc_attr($settings['promo_badge_color'] ?? '#ef4444'); ?>"
                                                       class="kova-color-preview">
                                            </div>
                                        </div>
                                    </div>

                                    <div class="kova-form-row">
                                        <div class="kova-form-group kova-form-group-third">
                                            <label class="kova-form-label"><?php _e('Prefix', 'kova-agent'); ?></label>
                                            <input type="text"
                                                   name="kova_agent_settings[promo_badge_prefix]"
                                                   value="<?php echo esc_attr($settings['promo_badge_prefix'] ?? ''); ?>"
                                                   class="kova-form-input"
                                                   placeholder="-">
                                        </div>
                                        <div class="kova-form-group kova-form-group-third">
                                            <label class="kova-form-label"><?php _e('Suffix', 'kova-agent'); ?></label>
                                            <input type="text"
                                                   name="kova_agent_settings[promo_badge_suffix]"
                                                   value="<?php echo esc_attr($settings['promo_badge_suffix'] ?? 'OFF'); ?>"
                                                   class="kova-form-input"
                                                   placeholder="% OFF">
                                        </div>
                                        <div class="kova-form-group kova-form-group-third">
                                            <label class="kova-form-label"><?php _e('Font Size', 'kova-agent'); ?></label>
                                            <input type="number"
                                                   name="kova_agent_settings[promo_badge_font_size]"
                                                   value="<?php echo esc_attr($settings['promo_badge_font_size'] ?? 12); ?>"
                                                   class="kova-form-input"
                                                   min="8" max="24">
                                        </div>
                                    </div>
                                </div>

                                <!-- Notice Type Fields -->
                                <div id="kova-promo-badge-notice-fields" style="<?php echo ($settings['promo_badge_type'] ?? 'discount') !== 'notice' ? 'display: none;' : ''; ?>">
                                    <div class="kova-form-row">
                                        <div class="kova-form-group kova-form-group-half">
                                            <label class="kova-form-label"><?php _e('Notice Text', 'kova-agent'); ?></label>
                                            <input type="text"
                                                   name="kova_agent_settings[promo_badge_text]"
                                                   value="<?php echo esc_attr($settings['promo_badge_text'] ?? 'NEW'); ?>"
                                                   class="kova-form-input"
                                                   placeholder="NEW, HOT, SALE"
                                                   maxlength="15">
                                            <p class="kova-form-hint"><?php _e('Short text to display on the badge', 'kova-agent'); ?></p>
                                        </div>
                                        <div class="kova-form-group kova-form-group-half">
                                            <label class="kova-form-label"><?php _e('Badge Color', 'kova-agent'); ?></label>
                                            <div class="kova-color-picker-wrapper">
                                                <input type="color"
                                                       name="kova_agent_settings[promo_badge_color]"
                                                       value="<?php echo esc_attr($settings['promo_badge_color'] ?? '#ef4444'); ?>"
                                                       class="kova-color-preview">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="kova-form-group">
                                        <label class="kova-form-label"><?php _e('Font Size', 'kova-agent'); ?></label>
                                        <input type="number"
                                               name="kova_agent_settings[promo_badge_font_size]"
                                               value="<?php echo esc_attr($settings['promo_badge_font_size'] ?? 12); ?>"
                                               class="kova-form-input"
                                               min="8" max="24"
                                               style="width: 100px;">
                                    </div>
                                </div>

                                <div class="kova-form-row">
                                    <div class="kova-form-group kova-form-group-half">
                                        <label class="kova-form-label"><?php _e('Badge Shape', 'kova-agent'); ?></label>
                                        <select name="kova_agent_settings[promo_badge_shape]" class="kova-form-select">
                                            <option value="circle" <?php selected($settings['promo_badge_shape'] ?? 'circle', 'circle'); ?>><?php _e('Circle', 'kova-agent'); ?></option>
                                            <option value="square" <?php selected($settings['promo_badge_shape'] ?? 'circle', 'square'); ?>><?php _e('Square', 'kova-agent'); ?></option>
                                        </select>
                                    </div>
                                    <div class="kova-form-group kova-form-group-half">
                                        <label class="kova-form-label"><?php _e('Badge Position', 'kova-agent'); ?></label>
                                        <select name="kova_agent_settings[promo_badge_position]" class="kova-form-select">
                                            <option value="right" <?php selected($settings['promo_badge_position'] ?? 'right', 'right'); ?>><?php _e('Right', 'kova-agent'); ?></option>
                                            <option value="left" <?php selected($settings['promo_badge_position'] ?? 'right', 'left'); ?>><?php _e('Left', 'kova-agent'); ?></option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Suggested Questions Section -->
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Suggested Questions', 'kova-agent'); ?></h3>
                            </div>
                            <p class="kova-form-hint" style="margin-bottom: 1rem;"><?php _e('Customize the quick action buttons shown to users when they open the chat.', 'kova-agent'); ?></p>

                            <!-- Question 1 -->
                            <div class="kova-form-group" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                <label class="kova-form-label" style="font-weight: 600; margin-bottom: 0.5rem;"><?php _e('Question 1', 'kova-agent'); ?></label>
                                <div class="kova-form-row">
                                    <div class="kova-form-group-half">
                                        <label class="kova-form-label"><?php _e('Button Text', 'kova-agent'); ?></label>
                                        <input type="text"
                                               name="kova_agent_settings[suggested_question_1_text]"
                                               value="<?php echo esc_attr($settings['suggested_question_1_text'] ?? 'Recomendaciones personalizadas'); ?>"
                                               class="kova-form-input"
                                               placeholder="<?php _e('Text shown on button', 'kova-agent'); ?>">
                                    </div>
                                    <div class="kova-form-group-half">
                                        <label class="kova-form-label"><?php _e('Message to Send', 'kova-agent'); ?></label>
                                        <input type="text"
                                               name="kova_agent_settings[suggested_question_1_message]"
                                               value="<?php echo esc_attr($settings['suggested_question_1_message'] ?? '¿Qué productos recomiendas para mí?'); ?>"
                                               class="kova-form-input"
                                               placeholder="<?php _e('Message sent when clicked', 'kova-agent'); ?>">
                                    </div>
                                </div>
                            </div>

                            <!-- Question 2 -->
                            <div class="kova-form-group" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                <label class="kova-form-label" style="font-weight: 600; margin-bottom: 0.5rem;"><?php _e('Question 2', 'kova-agent'); ?></label>
                                <div class="kova-form-row">
                                    <div class="kova-form-group-half">
                                        <label class="kova-form-label"><?php _e('Button Text', 'kova-agent'); ?></label>
                                        <input type="text"
                                               name="kova_agent_settings[suggested_question_2_text]"
                                               value="<?php echo esc_attr($settings['suggested_question_2_text'] ?? 'Ayuda con mi compra'); ?>"
                                               class="kova-form-input"
                                               placeholder="<?php _e('Text shown on button', 'kova-agent'); ?>">
                                    </div>
                                    <div class="kova-form-group-half">
                                        <label class="kova-form-label"><?php _e('Message to Send', 'kova-agent'); ?></label>
                                        <input type="text"
                                               name="kova_agent_settings[suggested_question_2_message]"
                                               value="<?php echo esc_attr($settings['suggested_question_2_message'] ?? '¿Puedes ayudarme a elegir productos?'); ?>"
                                               class="kova-form-input"
                                               placeholder="<?php _e('Message sent when clicked', 'kova-agent'); ?>">
                                    </div>
                                </div>
                            </div>

                            <!-- Question 3 -->
                            <div class="kova-form-group" style="background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                                <label class="kova-form-label" style="font-weight: 600; margin-bottom: 0.5rem;"><?php _e('Question 3', 'kova-agent'); ?></label>
                                <div class="kova-form-row">
                                    <div class="kova-form-group-half">
                                        <label class="kova-form-label"><?php _e('Button Text', 'kova-agent'); ?></label>
                                        <input type="text"
                                               name="kova_agent_settings[suggested_question_3_text]"
                                               value="<?php echo esc_attr($settings['suggested_question_3_text'] ?? 'Información de envío'); ?>"
                                               class="kova-form-input"
                                               placeholder="<?php _e('Text shown on button', 'kova-agent'); ?>">
                                    </div>
                                    <div class="kova-form-group-half">
                                        <label class="kova-form-label"><?php _e('Message to Send', 'kova-agent'); ?></label>
                                        <input type="text"
                                               name="kova_agent_settings[suggested_question_3_message]"
                                               value="<?php echo esc_attr($settings['suggested_question_3_message'] ?? '¿Cuáles son las opciones de envío?'); ?>"
                                               class="kova-form-input"
                                               placeholder="<?php _e('Message sent when clicked', 'kova-agent'); ?>">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Display Settings Section -->
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Display Settings', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[show_on_mobile]"
                                           value="1"
                                           <?php checked($settings['show_on_mobile'] ?? true); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Show on Mobile', 'kova-agent'); ?></span>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[show_on_product_pages]"
                                           value="1"
                                           <?php checked($settings['show_on_product_pages'] ?? true); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Show on Product Pages', 'kova-agent'); ?></span>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[show_on_cart_page]"
                                           value="1"
                                           <?php checked($settings['show_on_cart_page'] ?? true); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Show on Cart Page', 'kova-agent'); ?></span>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           name="kova_agent_settings[show_on_checkout]"
                                           value="1"
                                           <?php checked(!empty($settings['show_on_checkout'])); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem;"><?php _e('Show on Checkout', 'kova-agent'); ?></span>
                            </div>
                        </div>

                        <?php submit_button(__('Save Widget Settings', 'kova-agent'), 'kova-btn kova-btn-primary', 'submit', false); ?>
                    </div>

                    <div class="kova-side-column">
                        <div class="kova-card kova-sticky-preview">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Preview', 'kova-agent'); ?></h3>
                            </div>
                            <div class="kova-widget-preview-container">
                                <div class="kova-widget-preview">
                                    <div class="kova-widget-preview-header" id="kova-preview-header" style="background: <?php echo esc_attr($widget_color); ?>;">
                                        <div class="kova-widget-preview-avatar"><?php echo esc_html($widget_avatar); ?></div>
                                        <div>
                                            <div class="kova-widget-preview-title" id="kova-preview-title"><?php echo esc_html($widget_brand_name); ?></div>
                                            <div class="kova-widget-preview-status"><?php echo esc_html($widget_subtitle); ?></div>
                                        </div>
                                    </div>
                                    <div class="kova-widget-preview-body">
                                        <div class="kova-widget-preview-message" id="kova-preview-message">
                                            <?php echo esc_html($welcome_message ?: __('Hello! How can I help you today?', 'kova-agent')); ?>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
        <script>
        jQuery(document).ready(function($) {
            // Toggle rotating messages fields
            function toggleRotatingFields() {
                var enabled = $('#kova_rotating_messages_enabled').is(':checked');
                $('#kova-rotating-messages-fields').toggle(enabled);
            }
            $('#kova_rotating_messages_enabled').on('change', toggleRotatingFields);
            toggleRotatingFields();

            // Toggle promo badge fields
            function togglePromoBadgeFields() {
                var enabled = $('#kova_promo_badge_enabled').is(':checked');
                $('#kova-promo-badge-fields').toggle(enabled);
            }
            $('#kova_promo_badge_enabled').on('change', togglePromoBadgeFields);
            togglePromoBadgeFields();

            // Toggle promo badge type fields (discount vs notice)
            function togglePromoBadgeTypeFields() {
                var type = $('input[name="kova_agent_settings[promo_badge_type]"]:checked').val();
                if (type === 'notice') {
                    $('#kova-promo-badge-discount-fields').hide();
                    $('#kova-promo-badge-notice-fields').show();
                } else {
                    $('#kova-promo-badge-discount-fields').show();
                    $('#kova-promo-badge-notice-fields').hide();
                }
                // Update radio button styles
                $('input[name="kova_agent_settings[promo_badge_type]"]').each(function() {
                    var label = $(this).closest('label');
                    if ($(this).is(':checked')) {
                        label.css({'border-color': '#6366f1', 'background': 'rgba(99, 102, 241, 0.1)'});
                    } else {
                        label.css({'border-color': '#ddd', 'background': 'transparent'});
                    }
                });
            }
            $('input[name="kova_agent_settings[promo_badge_type]"]').on('change', togglePromoBadgeTypeFields);
            togglePromoBadgeTypeFields();

            // Sync color inputs
            $('input[type="color"]').on('input', function() {
                var textInput = $(this).siblings('input[type="text"]');
                if (textInput.length) {
                    textInput.val($(this).val());
                }
                // Update preview header color
                if ($(this).attr('id') === 'kova_widget_color') {
                    $('#kova-preview-header').css('background', $(this).val());
                }
            });
        });
        </script>
        <?php
    }

    /**
     * Render Settings Tab
     */
    private function render_settings_tab() {
        $settings = get_option('kova_agent_settings', array());
        ?>
        <div class="kova-page-header">
            <div class="kova-page-header-content">
                <div>
                    <h1 class="kova-page-title"><?php _e('Settings', 'kova-agent'); ?></h1>
                    <p class="kova-page-subtitle"><?php _e('Configure your Kova Agent connection and API settings', 'kova-agent'); ?></p>
                </div>
            </div>
        </div>

        <div class="kova-page-content">
            <form method="post" action="options.php">
                <?php settings_fields('kova_agent_settings_group'); ?>

                <div class="kova-two-columns">
                    <div class="kova-main-column">
                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('Enable Widget', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-toggle">
                                    <input type="checkbox"
                                           id="kova_enabled"
                                           name="kova_agent_settings[enabled]"
                                           value="1"
                                           <?php checked(!empty($settings['enabled'])); ?>>
                                    <span class="kova-toggle-slider"></span>
                                </label>
                                <span style="margin-left: 0.75rem; font-weight: 600;"><?php _e('Enable Chat Widget', 'kova-agent'); ?></span>
                                <p class="kova-form-hint"><?php _e('Enable or disable the chat widget on your store.', 'kova-agent'); ?></p>
                            </div>
                        </div>

                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('API Configuration', 'kova-agent'); ?></h3>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label" for="kova_api_endpoint"><?php _e('API Endpoint', 'kova-agent'); ?></label>
                                <input type="url"
                                       id="kova_api_endpoint"
                                       name="kova_agent_settings[api_endpoint]"
                                       value="<?php echo esc_attr($settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net'); ?>"
                                       class="kova-form-input">
                                <p class="kova-form-hint"><?php _e('The Kova Agent API endpoint URL.', 'kova-agent'); ?></p>
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label" for="kova_chat_endpoint"><?php _e('Chat Endpoint', 'kova-agent'); ?></label>
                                <input type="url"
                                       id="kova_chat_endpoint"
                                       name="kova_agent_settings[chat_endpoint]"
                                       value="<?php echo esc_attr($settings['chat_endpoint'] ?? 'https://n8n.dustkey.com/webhook/chat-naay'); ?>"
                                       class="kova-form-input">
                                <p class="kova-form-hint"><?php _e('The chat webhook URL for processing messages (e.g., n8n webhook).', 'kova-agent'); ?></p>
                            </div>
                        </div>

                        <div class="kova-card">
                            <div class="kova-card-header">
                                <h3 class="kova-card-title"><?php _e('WooCommerce API Credentials', 'kova-agent'); ?></h3>
                            </div>

                            <p class="kova-form-hint" style="margin-bottom: 1rem;">
                                <?php _e('Generate API keys in WooCommerce > Settings > Advanced > REST API. Required permissions: Read/Write.', 'kova-agent'); ?>
                            </p>

                            <div class="kova-form-group">
                                <label class="kova-form-label" for="kova_consumer_key"><?php _e('Consumer Key', 'kova-agent'); ?></label>
                                <input type="text"
                                       id="kova_consumer_key"
                                       name="kova_agent_settings[consumer_key]"
                                       value="<?php echo esc_attr($settings['consumer_key'] ?? ''); ?>"
                                       class="kova-form-input"
                                       placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label" for="kova_consumer_secret"><?php _e('Consumer Secret', 'kova-agent'); ?></label>
                                <input type="password"
                                       id="kova_consumer_secret"
                                       name="kova_agent_settings[consumer_secret]"
                                       value="<?php echo esc_attr($settings['consumer_secret'] ?? ''); ?>"
                                       class="kova-form-input"
                                       placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
                            </div>

                            <div class="kova-form-group">
                                <label class="kova-form-label" for="kova_webhook_secret"><?php _e('Webhook Secret', 'kova-agent'); ?></label>
                                <input type="text"
                                       id="kova_webhook_secret"
                                       name="kova_agent_settings[webhook_secret]"
                                       value="<?php echo esc_attr($settings['webhook_secret'] ?? ''); ?>"
                                       class="kova-form-input"
                                       readonly>
                                <p class="kova-form-hint"><?php _e('This will be set automatically when you connect to Kova.', 'kova-agent'); ?></p>
                            </div>

                            <div class="kova-actions-bar">
                                <button type="button" id="kova-test-connection" class="kova-btn kova-btn-secondary">
                                    <?php _e('Test Connection', 'kova-agent'); ?>
                                </button>
                                <button type="button" id="kova-sync-products" class="kova-btn kova-btn-secondary">
                                    <?php _e('Sync Products', 'kova-agent'); ?>
                                </button>
                                <button type="button" id="kova-setup-webhooks" class="kova-btn kova-btn-secondary">
                                    <?php _e('Setup Webhooks', 'kova-agent'); ?>
                                </button>
                                <span id="kova-action-status" class="kova-action-status"></span>
                            </div>
                        </div>

                        <?php submit_button(__('Save Settings', 'kova-agent'), 'kova-btn kova-btn-primary', 'submit', false); ?>
                    </div>

                    <div class="kova-side-column">
                        <div class="kova-info-box">
                            <h3><?php _e('Quick Start', 'kova-agent'); ?></h3>
                            <ol>
                                <li><?php _e('Create WooCommerce API keys (Read/Write)', 'kova-agent'); ?></li>
                                <li><?php _e('Enter your API credentials', 'kova-agent'); ?></li>
                                <li><?php _e('Click "Test Connection" to verify', 'kova-agent'); ?></li>
                                <li><?php _e('Click "Sync Products" to import your catalog', 'kova-agent'); ?></li>
                                <li><?php _e('Enable the widget and save settings', 'kova-agent'); ?></li>
                            </ol>
                        </div>

                        <div class="kova-info-box">
                            <h3><?php _e('Need Help?', 'kova-agent'); ?></h3>
                            <p><?php _e('Check our documentation for detailed setup instructions.', 'kova-agent'); ?></p>
                            <a href="https://docs.kova.ai" target="_blank" class="kova-btn kova-btn-secondary" style="width: 100%; margin-top: 0.5rem;">
                                <?php _e('View Documentation', 'kova-agent'); ?>
                            </a>
                        </div>
                    </div>
                </div>
            </form>
        </div>
        <?php
    }

    /**
     * AJAX: Test connection to Kova API
     */
    public function ajax_test_connection() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permission denied.', 'kova-agent')));
        }

        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';
        $consumer_key = $settings['consumer_key'] ?? '';
        $consumer_secret = $settings['consumer_secret'] ?? '';

        if (empty($consumer_key) || empty($consumer_secret)) {
            wp_send_json_error(array('message' => __('Please enter your WooCommerce API credentials.', 'kova-agent')));
        }

        $response = wp_remote_post($api_endpoint . '/api/woo/test-connection', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'siteUrl' => site_url(),
                'consumerKey' => $consumer_key,
                'consumerSecret' => $consumer_secret,
            )),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success'])) {
            wp_send_json_success(array(
                'message' => sprintf(
                    __('Connected successfully! Store: %s', 'kova-agent'),
                    $body['data']['storeName'] ?? 'Unknown'
                ),
            ));
        } else {
            wp_send_json_error(array('message' => $body['error'] ?? __('Connection failed.', 'kova-agent')));
        }
    }

    /**
     * AJAX: Sync products to Kova
     */
    public function ajax_sync_products() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permission denied.', 'kova-agent')));
        }

        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';

        $response = wp_remote_post($api_endpoint . '/api/woo/sync-products', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'siteUrl' => site_url(),
            )),
            'timeout' => 120,
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success'])) {
            wp_send_json_success(array(
                'message' => sprintf(
                    __('Synced %d of %d products successfully!', 'kova-agent'),
                    $body['data']['synced'] ?? 0,
                    $body['data']['total'] ?? 0
                ),
            ));
        } else {
            wp_send_json_error(array('message' => $body['error'] ?? __('Sync failed.', 'kova-agent')));
        }
    }

    /**
     * AJAX: Setup webhooks
     */
    public function ajax_setup_webhooks() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permission denied.', 'kova-agent')));
        }

        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';

        $response = wp_remote_post($api_endpoint . '/api/woo/setup-webhooks', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'siteUrl' => site_url(),
            )),
            'timeout' => 60,
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success'])) {
            $webhook_count = count($body['data']['webhooks'] ?? array());
            wp_send_json_success(array(
                'message' => sprintf(__('Created %d webhooks successfully!', 'kova-agent'), $webhook_count),
            ));
        } else {
            wp_send_json_error(array('message' => $body['error'] ?? __('Webhook setup failed.', 'kova-agent')));
        }
    }

    /**
     * AJAX: Get analytics data
     */
    public function ajax_get_analytics() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permission denied.', 'kova-agent')));
        }

        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';
        $start_date = sanitize_text_field($_POST['startDate'] ?? '');
        $end_date = sanitize_text_field($_POST['endDate'] ?? '');

        $url = $api_endpoint . '/api/woo/embedded/analytics?' . http_build_query(array(
            'siteUrl' => site_url(),
            'startDate' => $start_date,
            'endDate' => $end_date,
        ));

        $response = wp_remote_get($url, array('timeout' => 30));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success'])) {
            wp_send_json_success($body['data']);
        } else {
            wp_send_json_error(array('message' => $body['error'] ?? __('Failed to load analytics.', 'kova-agent')));
        }
    }

    /**
     * AJAX: Get conversations
     */
    public function ajax_get_conversations() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permission denied.', 'kova-agent')));
        }

        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';
        $date = sanitize_text_field($_POST['date'] ?? date('Y-m-d'));

        $url = $api_endpoint . '/api/woo/embedded/conversations?' . http_build_query(array(
            'siteUrl' => site_url(),
            'date' => $date,
        ));

        $response = wp_remote_get($url, array('timeout' => 30));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success'])) {
            wp_send_json_success($body['data']);
        } else {
            wp_send_json_error(array('message' => $body['error'] ?? __('Failed to load conversations.', 'kova-agent')));
        }
    }

    /**
     * AJAX: Get conversions dashboard
     */
    public function ajax_get_conversions() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => __('Permission denied.', 'kova-agent')));
        }

        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';
        $days = intval($_POST['days'] ?? 30);

        $url = $api_endpoint . '/api/woo/embedded/conversions/dashboard?' . http_build_query(array(
            'siteUrl' => site_url(),
            'days' => $days,
        ));

        $response = wp_remote_get($url, array('timeout' => 30));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success'])) {
            wp_send_json_success($body['data']);
        } else {
            wp_send_json_error(array('message' => $body['error'] ?? __('Failed to load conversions.', 'kova-agent')));
        }
    }

    /**
     * AJAX: Auto-generate WooCommerce API keys
     */
    public function ajax_wizard_auto_generate_keys() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => 'Insufficient permissions'));
        }

        global $wpdb;

        // Check if WC functions exist
        if (!function_exists('wc_rand_hash') || !function_exists('wc_api_hash')) {
            wp_send_json_error(array('message' => 'WooCommerce functions not available'));
        }

        $consumer_key = 'ck_' . wc_rand_hash();
        $consumer_secret = 'cs_' . wc_rand_hash();

        $result = $wpdb->insert(
            $wpdb->prefix . 'woocommerce_api_keys',
            array(
                'user_id'         => get_current_user_id(),
                'description'     => 'Kova Agent - Auto Generated',
                'permissions'     => 'read_write',
                'consumer_key'    => wc_api_hash($consumer_key),
                'consumer_secret' => $consumer_secret,
                'truncated_key'   => substr($consumer_key, -7),
            ),
            array('%d', '%s', '%s', '%s', '%s', '%s')
        );

        if ($result === false) {
            wp_send_json_error(array('message' => 'Failed to generate API keys'));
        }

        // Save keys in plugin settings
        $settings = get_option('kova_agent_settings', array());
        $settings['consumer_key'] = $consumer_key;
        $settings['consumer_secret'] = $consumer_secret;
        update_option('kova_agent_settings', $settings);

        wp_send_json_success(array(
            'consumer_key' => $consumer_key,
            'consumer_secret' => $consumer_secret,
        ));
    }

    /**
     * AJAX: Connect to Kova backend with full store metadata
     */
    public function ajax_wizard_connect() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => 'Insufficient permissions'));
        }

        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';

        if (empty($settings['consumer_key']) || empty($settings['consumer_secret'])) {
            wp_send_json_error(array('message' => 'API keys not configured'));
        }

        $body = array(
            'siteUrl'       => site_url(),
            'consumerKey'   => $settings['consumer_key'],
            'consumerSecret'=> $settings['consumer_secret'],
            'storeName'     => get_bloginfo('name'),
            'storeEmail'    => get_option('admin_email'),
            'currency'      => function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'USD',
            'country'       => class_exists('WC') && WC()->countries ? WC()->countries->get_base_country() : '',
            'timezone'      => wp_timezone_string(),
            'locale'        => get_locale(),
        );

        $response = wp_remote_post($api_endpoint . '/api/woo/connect', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode($body),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $response_body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($response_body['success'])) {
            // Store webhook secret
            if (!empty($response_body['data']['webhookSecret'])) {
                $settings['webhook_secret'] = $response_body['data']['webhookSecret'];
                update_option('kova_agent_settings', $settings);
            }
            wp_send_json_success($response_body['data']);
        } else {
            wp_send_json_error(array('message' => $response_body['error'] ?? 'Connection failed'));
        }
    }

    /**
     * AJAX: Trigger product sync from wizard
     */
    public function ajax_wizard_sync_products() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => 'Insufficient permissions'));
        }

        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';

        $response = wp_remote_post($api_endpoint . '/api/woo/sync-products', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array('siteUrl' => site_url())),
            'timeout' => 120,
        ));

        if (is_wp_error($response)) {
            wp_send_json_error(array('message' => $response->get_error_message()));
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success'])) {
            // Also set up webhooks
            wp_remote_post($api_endpoint . '/api/woo/setup-webhooks', array(
                'headers' => array('Content-Type' => 'application/json'),
                'body' => json_encode(array('siteUrl' => site_url())),
                'timeout' => 30,
            ));

            wp_send_json_success($body['data']);
        } else {
            wp_send_json_error(array('message' => $body['error'] ?? 'Sync failed'));
        }
    }

    /**
     * AJAX: Complete wizard and enable widget
     */
    public function ajax_wizard_complete() {
        check_ajax_referer('kova_admin_nonce', 'nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(array('message' => 'Insufficient permissions'));
        }

        // Get widget config from request
        $brand_name = isset($_POST['brand_name']) ? sanitize_text_field($_POST['brand_name']) : get_bloginfo('name');
        $widget_color = isset($_POST['widget_color']) ? sanitize_hex_color($_POST['widget_color']) : '#6366f1';
        $widget_position = isset($_POST['widget_position']) ? sanitize_text_field($_POST['widget_position']) : 'bottom-right';
        $welcome_message = isset($_POST['welcome_message']) ? sanitize_textarea_field($_POST['welcome_message']) : '';
        $widget_subtitle = isset($_POST['widget_subtitle']) ? sanitize_text_field($_POST['widget_subtitle']) : 'Asistente de compras con IA';

        $settings = get_option('kova_agent_settings', array());
        $settings['enabled'] = true;
        $settings['widget_brand_name'] = $brand_name;
        $settings['widget_color'] = $widget_color;
        $settings['widget_position'] = $widget_position;
        $settings['welcome_message'] = $welcome_message;
        $settings['widget_subtitle'] = $widget_subtitle;
        update_option('kova_agent_settings', $settings);

        // Mark onboarding as complete
        update_option('kova_agent_onboarding_complete', true);

        // Sync widget config to backend
        $api = new Kova_API();

        wp_send_json_success(array('message' => 'Setup completed'));
    }

    /**
     * Render setup wizard page
     */
    public function render_setup_wizard() {
        $store_name = get_bloginfo('name');
        ?>
        <!DOCTYPE html>
        <html <?php language_attributes(); ?>>
        <head>
            <meta charset="<?php bloginfo('charset'); ?>">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title><?php _e('Kova Agent Setup', 'kova-agent'); ?></title>
            <?php wp_head(); ?>
        </head>
        <body class="kova-wizard-body">
            <div class="kova-wizard-wrapper">
                <div class="kova-wizard-header">
                    <div class="kova-wizard-logo">
                        <svg class="kova-wizard-logo-svg" viewBox="0 0 453.05 161.03" xmlns="http://www.w3.org/2000/svg"><rect fill="#6b5afc" x="0" y="0" width="55.94" height="161.03" rx="27.97" ry="27.97"/><path fill="#6b5afc" d="M102.81,0h0C88.46,0,76.63,10.81,75.03,24.74h0c-.12,1.06-.19,2.14-.19,3.23h0c0,.99.05,1.97.15,2.94l-.15,25.04h27.97c15.45,0,27.97-12.52,27.97-27.97h0C130.78,12.52,118.26,0,102.81,0Z"/><path fill="#6b5afc" d="M114.74,158.27h0c-20.48,0-37.34-15.43-39.63-35.29h0c-.17-1.51-.27-3.05-.27-4.61h0c0-1.41.08-2.81.22-4.19l-.22-35.71h39.9c22.04,0,39.9,17.87,39.9,39.9h0c0,22.04-17.87,39.9-39.9,39.9Z"/><path fill="#232323" d="M192.25,105.24V32.6c0-2.12,1.72-3.84,3.84-3.84h.84c2.12,0,3.84,1.72,3.84,3.84v38.23c0,2.12,1.72,3.84,3.84,3.84h14.21c1.17,0,2.27-.53,3-1.44l17.47-21.92c.73-.91,1.83-1.44,3-1.44h.18c3.23,0,5.01,3.74,2.98,6.25l-15.97,19.74c-1.1,1.36-1.14,3.28-.11,4.69l16.52,22.43c1.86,2.53.06,6.11-3.09,6.11h-.44c-1.21,0-2.35-.57-3.07-1.54l-17.59-23.53c-.72-.97-1.86-1.54-3.07-1.54h-14.02c-2.12,0-3.84,1.72-3.84,3.84v18.94c0,2.12-1.72,3.84-3.84,3.84h-.84c-2.12,0-3.84-1.72-3.84-3.84Z"/><path fill="#232323" d="M255.65,79.47c0-17.98,12.82-30.8,32.12-30.8s32.24,12.82,32.24,30.8-12.82,30.8-32.24,30.8-32.12-12.82-32.12-30.8ZM311.63,79.47c0-14.26-7.55-23.13-23.85-23.13s-23.73,8.87-23.73,23.13,7.43,23.13,23.73,23.13,23.85-8.75,23.85-23.13Z"/><path fill="#232323" d="M352.53,106.89l-24.62-51.54c-1.22-2.55.64-5.49,3.46-5.49h.71c1.48,0,2.84.86,3.47,2.2l22.93,48.62h.72l22.82-48.61c.63-1.35,1.98-2.21,3.47-2.21h.71c2.82,0,4.68,2.94,3.46,5.49l-24.62,51.54c-.64,1.33-1.98,2.18-3.46,2.18h-5.59c-1.48,0-2.82-.85-3.46-2.18Z"/><path fill="#232323" d="M397.55,95.17c0-9.71,8.03-13.9,19.06-15.1l24.75-2.74c1.94-.21,3.41-1.86,3.41-3.81v-1.12c0-11.51-5.03-16.06-17.98-16.06s-19.42,4.55-19.42,14.98v.48h-8.51v-.48c0-12.47,10.31-22.65,28.53-22.65s25.65,10.31,25.65,23.37v33.2c0,2.12-1.72,3.84-3.84,3.84h0c-2.12,0-3.84-1.72-3.84-3.84v-12.11h-.6c-3.48,10.91-13.9,17.14-27.69,17.14-11.63,0-19.54-5.51-19.54-15.1ZM419.01,103.68c14.38,0,25.77-6.35,25.77-20.61v-.48l-25.53,2.88c-8.87.84-13.18,3-13.18,9.11s3.96,9.11,12.94,9.11Z"/></svg>
                    </div>
                    <a href="<?php echo admin_url('admin.php?page=kova-agent'); ?>" class="kova-wizard-skip">
                        <?php _e('Saltar', 'kova-agent'); ?> &rarr;
                    </a>
                </div>

                <div class="kova-wizard-progress">
                    <div class="kova-wizard-progress-bar" id="wizard-progress-bar" style="width: 20%"></div>
                </div>

                <!-- Step 1: Welcome -->
                <div class="kova-wizard-step active" id="wizard-step-1">
                    <h1><?php _e('Bienvenido a Kova Agent', 'kova-agent'); ?></h1>
                    <p class="kova-wizard-desc"><?php _e('Configura tu asistente de IA en pocos minutos. Kova ayudara a tus clientes a encontrar productos, obtener recomendaciones y completar compras.', 'kova-agent'); ?></p>

                    <div class="kova-wizard-features">
                        <div class="kova-wizard-feature">
                            <div class="kova-wizard-feature-icon">&#128269;</div>
                            <div>
                                <strong><?php _e('Busqueda inteligente', 'kova-agent'); ?></strong>
                                <p><?php _e('Busqueda semantica de productos con IA', 'kova-agent'); ?></p>
                            </div>
                        </div>
                        <div class="kova-wizard-feature">
                            <div class="kova-wizard-feature-icon">&#128172;</div>
                            <div>
                                <strong><?php _e('Chat conversacional', 'kova-agent'); ?></strong>
                                <p><?php _e('Atencion al cliente automatizada 24/7', 'kova-agent'); ?></p>
                            </div>
                        </div>
                        <div class="kova-wizard-feature">
                            <div class="kova-wizard-feature-icon">&#128722;</div>
                            <div>
                                <strong><?php _e('Gestion de carrito', 'kova-agent'); ?></strong>
                                <p><?php _e('Agregar productos al carrito desde el chat', 'kova-agent'); ?></p>
                            </div>
                        </div>
                    </div>

                    <button class="kova-wizard-btn kova-wizard-btn-primary" onclick="kovaWizardNext(2)">
                        <?php _e('Comenzar', 'kova-agent'); ?> &rarr;
                    </button>
                </div>

                <!-- Step 2: Connection -->
                <div class="kova-wizard-step" id="wizard-step-2">
                    <h1><?php _e('Conectar tu tienda', 'kova-agent'); ?></h1>
                    <p class="kova-wizard-desc"><?php _e('Generaremos las claves API de WooCommerce automaticamente para conectar tu tienda.', 'kova-agent'); ?></p>

                    <div class="kova-wizard-store-info">
                        <div class="kova-wizard-info-row">
                            <span class="kova-wizard-info-label"><?php _e('Tienda', 'kova-agent'); ?></span>
                            <span class="kova-wizard-info-value"><?php echo esc_html($store_name); ?></span>
                        </div>
                        <div class="kova-wizard-info-row">
                            <span class="kova-wizard-info-label"><?php _e('URL', 'kova-agent'); ?></span>
                            <span class="kova-wizard-info-value"><?php echo esc_html(site_url()); ?></span>
                        </div>
                        <div class="kova-wizard-info-row">
                            <span class="kova-wizard-info-label"><?php _e('Moneda', 'kova-agent'); ?></span>
                            <span class="kova-wizard-info-value"><?php echo function_exists('get_woocommerce_currency') ? esc_html(get_woocommerce_currency()) : 'USD'; ?></span>
                        </div>
                    </div>

                    <div id="wizard-connection-status" class="kova-wizard-status" style="display:none;"></div>

                    <div class="kova-wizard-nav">
                        <button class="kova-wizard-btn kova-wizard-btn-secondary" onclick="kovaWizardNext(1)">
                            &larr; <?php _e('Atras', 'kova-agent'); ?>
                        </button>
                        <button class="kova-wizard-btn kova-wizard-btn-primary" id="wizard-connect-btn" onclick="kovaWizardConnect()">
                            <?php _e('Generar claves y conectar', 'kova-agent'); ?> &rarr;
                        </button>
                    </div>
                </div>

                <!-- Step 3: Branding & Widget -->
                <div class="kova-wizard-step" id="wizard-step-3">
                    <h1><?php _e('Personaliza tu widget', 'kova-agent'); ?></h1>
                    <p class="kova-wizard-desc"><?php _e('Configura la apariencia del asistente para que combine con tu marca.', 'kova-agent'); ?></p>

                    <div class="kova-wizard-form">
                        <div class="kova-wizard-field">
                            <label><?php _e('Nombre de marca', 'kova-agent'); ?></label>
                            <input type="text" id="wizard-brand-name" value="<?php echo esc_attr($store_name); ?>">
                        </div>
                        <div class="kova-wizard-field">
                            <label><?php _e('Color principal', 'kova-agent'); ?></label>
                            <div class="kova-wizard-color-row">
                                <input type="color" id="wizard-widget-color" value="#6366f1">
                                <input type="text" id="wizard-widget-color-text" value="#6366f1" class="kova-wizard-color-text">
                            </div>
                        </div>
                        <div class="kova-wizard-field">
                            <label><?php _e('Posicion', 'kova-agent'); ?></label>
                            <select id="wizard-widget-position">
                                <option value="bottom-right"><?php _e('Abajo Derecha', 'kova-agent'); ?></option>
                                <option value="bottom-left"><?php _e('Abajo Izquierda', 'kova-agent'); ?></option>
                                <option value="top-right"><?php _e('Arriba Derecha', 'kova-agent'); ?></option>
                                <option value="top-left"><?php _e('Arriba Izquierda', 'kova-agent'); ?></option>
                            </select>
                        </div>
                        <div class="kova-wizard-field">
                            <label><?php _e('Mensaje de bienvenida', 'kova-agent'); ?></label>
                            <textarea id="wizard-welcome-message" rows="2" placeholder="<?php esc_attr_e('Hola! Como puedo ayudarte?', 'kova-agent'); ?>"></textarea>
                        </div>
                        <div class="kova-wizard-field">
                            <label><?php _e('Subtitulo', 'kova-agent'); ?></label>
                            <input type="text" id="wizard-widget-subtitle" value="<?php esc_attr_e('Asistente de compras con IA', 'kova-agent'); ?>">
                        </div>
                    </div>

                    <div class="kova-wizard-nav">
                        <button class="kova-wizard-btn kova-wizard-btn-secondary" onclick="kovaWizardNext(2)">
                            &larr; <?php _e('Atras', 'kova-agent'); ?>
                        </button>
                        <button class="kova-wizard-btn kova-wizard-btn-primary" onclick="kovaWizardNext(4)">
                            <?php _e('Continuar', 'kova-agent'); ?> &rarr;
                        </button>
                    </div>
                </div>

                <!-- Step 4: Sync -->
                <div class="kova-wizard-step" id="wizard-step-4">
                    <h1><?php _e('Sincronizar productos', 'kova-agent'); ?></h1>
                    <p class="kova-wizard-desc"><?php _e('Sincronizamos tus productos para que el asistente pueda recomendarlos a tus clientes.', 'kova-agent'); ?></p>

                    <div id="wizard-sync-status" class="kova-wizard-sync-container">
                        <div class="kova-wizard-sync-idle">
                            <p><?php _e('Haz clic para iniciar la sincronizacion de productos.', 'kova-agent'); ?></p>
                            <button class="kova-wizard-btn kova-wizard-btn-primary" id="wizard-sync-btn" onclick="kovaWizardSync()">
                                <?php _e('Sincronizar productos', 'kova-agent'); ?>
                            </button>
                        </div>
                        <div class="kova-wizard-sync-progress" style="display:none;">
                            <div class="kova-wizard-progress-container">
                                <div class="kova-wizard-progress-fill" id="wizard-sync-progress-fill"></div>
                            </div>
                            <p id="wizard-sync-text"><?php _e('Sincronizando...', 'kova-agent'); ?></p>
                        </div>
                        <div class="kova-wizard-sync-done" style="display:none;">
                            <div class="kova-wizard-check">&#10003;</div>
                            <p id="wizard-sync-result"></p>
                        </div>
                    </div>

                    <div class="kova-wizard-nav">
                        <button class="kova-wizard-btn kova-wizard-btn-secondary" onclick="kovaWizardNext(3)">
                            &larr; <?php _e('Atras', 'kova-agent'); ?>
                        </button>
                        <button class="kova-wizard-btn kova-wizard-btn-primary" id="wizard-sync-next-btn" onclick="kovaWizardNext(5)">
                            <?php _e('Continuar', 'kova-agent'); ?> &rarr;
                        </button>
                    </div>
                </div>

                <!-- Step 5: Activate -->
                <div class="kova-wizard-step" id="wizard-step-5">
                    <div class="kova-wizard-check-large">&#10003;</div>
                    <h1><?php _e('Tu asistente esta listo!', 'kova-agent'); ?></h1>
                    <p class="kova-wizard-desc"><?php _e('Kova Agent se ha configurado correctamente. Tu asistente de IA esta activo.', 'kova-agent'); ?></p>

                    <div class="kova-wizard-checklist">
                        <div class="kova-wizard-checklist-item">&#10003; <?php _e('Tienda conectada', 'kova-agent'); ?></div>
                        <div class="kova-wizard-checklist-item">&#10003; <?php _e('Widget personalizado', 'kova-agent'); ?></div>
                        <div class="kova-wizard-checklist-item">&#10003; <?php _e('Productos sincronizados', 'kova-agent'); ?></div>
                        <div class="kova-wizard-checklist-item">&#10003; <?php _e('Widget activo en tu tienda', 'kova-agent'); ?></div>
                    </div>

                    <button class="kova-wizard-btn kova-wizard-btn-primary" onclick="kovaWizardFinish()">
                        <?php _e('Ir al Dashboard', 'kova-agent'); ?> &rarr;
                    </button>
                </div>
            </div>
            <?php wp_footer(); ?>
        </body>
        </html>
        <?php
    }
}
