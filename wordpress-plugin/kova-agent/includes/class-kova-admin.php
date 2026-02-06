<?php
/**
 * Kova Agent Admin Class
 * Handles the admin settings page and configuration
 */

if (!defined('ABSPATH')) {
    exit;
}

class Kova_Admin {

    /**
     * Constructor
     */
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_action('wp_ajax_kova_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_kova_sync_products', array($this, 'ajax_sync_products'));
        add_action('wp_ajax_kova_setup_webhooks', array($this, 'ajax_setup_webhooks'));
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
            array($this, 'render_settings_page'),
            'dashicons-format-chat',
            56
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
        $sanitized = array();

        $sanitized['enabled'] = isset($input['enabled']) ? (bool) $input['enabled'] : false;
        $sanitized['api_endpoint'] = sanitize_url($input['api_endpoint'] ?? 'https://api.kova.ai');
        $sanitized['api_key'] = sanitize_text_field($input['api_key'] ?? '');
        $sanitized['consumer_key'] = sanitize_text_field($input['consumer_key'] ?? '');
        $sanitized['consumer_secret'] = sanitize_text_field($input['consumer_secret'] ?? '');
        $sanitized['webhook_secret'] = sanitize_text_field($input['webhook_secret'] ?? '');
        $sanitized['widget_position'] = sanitize_text_field($input['widget_position'] ?? 'bottom-right');
        $sanitized['widget_color'] = sanitize_hex_color($input['widget_color'] ?? '#6366f1');
        $sanitized['welcome_message'] = sanitize_textarea_field($input['welcome_message'] ?? '');
        $sanitized['widget_title'] = sanitize_text_field($input['widget_title'] ?? 'Kova Assistant');
        $sanitized['show_on_mobile'] = isset($input['show_on_mobile']) ? (bool) $input['show_on_mobile'] : true;
        $sanitized['show_on_product_pages'] = isset($input['show_on_product_pages']) ? (bool) $input['show_on_product_pages'] : true;
        $sanitized['show_on_cart_page'] = isset($input['show_on_cart_page']) ? (bool) $input['show_on_cart_page'] : true;
        $sanitized['show_on_checkout'] = isset($input['show_on_checkout']) ? (bool) $input['show_on_checkout'] : false;

        return $sanitized;
    }

    /**
     * Enqueue admin scripts and styles
     */
    public function enqueue_admin_scripts($hook) {
        if ('toplevel_page_kova-agent' !== $hook) {
            return;
        }

        wp_enqueue_style('wp-color-picker');
        wp_enqueue_script('wp-color-picker');
        wp_enqueue_style(
            'kova-admin-css',
            KOVA_AGENT_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            KOVA_AGENT_VERSION
        );
        wp_enqueue_script(
            'kova-admin-js',
            KOVA_AGENT_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery', 'wp-color-picker'),
            KOVA_AGENT_VERSION,
            true
        );
        wp_localize_script('kova-admin-js', 'kovaAdmin', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('kova_admin_nonce'),
            'strings' => array(
                'testing' => __('Testing connection...', 'kova-agent'),
                'syncing' => __('Syncing products...', 'kova-agent'),
                'setting_up_webhooks' => __('Setting up webhooks...', 'kova-agent'),
                'success' => __('Success!', 'kova-agent'),
                'error' => __('Error', 'kova-agent'),
            ),
        ));
    }

    /**
     * Render settings page
     */
    public function render_settings_page() {
        $settings = get_option('kova_agent_settings', array());
        ?>
        <div class="wrap kova-admin-wrap">
            <h1>
                <span class="dashicons dashicons-format-chat"></span>
                <?php _e('Kova Agent Settings', 'kova-agent'); ?>
            </h1>

            <div class="kova-admin-container">
                <div class="kova-admin-main">
                    <form method="post" action="options.php">
                        <?php settings_fields('kova_agent_settings_group'); ?>

                        <!-- Connection Section -->
                        <div class="kova-section">
                            <h2><?php _e('Connection Settings', 'kova-agent'); ?></h2>

                            <table class="form-table">
                                <tr>
                                    <th scope="row">
                                        <label for="kova_enabled"><?php _e('Enable Widget', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <label class="kova-toggle">
                                            <input type="checkbox"
                                                   id="kova_enabled"
                                                   name="kova_agent_settings[enabled]"
                                                   value="1"
                                                   <?php checked(!empty($settings['enabled'])); ?>>
                                            <span class="kova-toggle-slider"></span>
                                        </label>
                                        <p class="description"><?php _e('Enable or disable the chat widget on your store.', 'kova-agent'); ?></p>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">
                                        <label for="kova_api_endpoint"><?php _e('API Endpoint', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <input type="url"
                                               id="kova_api_endpoint"
                                               name="kova_agent_settings[api_endpoint]"
                                               value="<?php echo esc_attr($settings['api_endpoint'] ?? 'https://api.kova.ai'); ?>"
                                               class="regular-text">
                                        <p class="description"><?php _e('The Kova Agent API endpoint URL.', 'kova-agent'); ?></p>
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <!-- WooCommerce API Credentials -->
                        <div class="kova-section">
                            <h2><?php _e('WooCommerce API Credentials', 'kova-agent'); ?></h2>
                            <p class="description">
                                <?php _e('Generate API keys in WooCommerce > Settings > Advanced > REST API. Required permissions: Read/Write.', 'kova-agent'); ?>
                            </p>

                            <table class="form-table">
                                <tr>
                                    <th scope="row">
                                        <label for="kova_consumer_key"><?php _e('Consumer Key', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <input type="text"
                                               id="kova_consumer_key"
                                               name="kova_agent_settings[consumer_key]"
                                               value="<?php echo esc_attr($settings['consumer_key'] ?? ''); ?>"
                                               class="regular-text"
                                               placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">
                                        <label for="kova_consumer_secret"><?php _e('Consumer Secret', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <input type="password"
                                               id="kova_consumer_secret"
                                               name="kova_agent_settings[consumer_secret]"
                                               value="<?php echo esc_attr($settings['consumer_secret'] ?? ''); ?>"
                                               class="regular-text"
                                               placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">
                                        <label for="kova_webhook_secret"><?php _e('Webhook Secret', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <input type="text"
                                               id="kova_webhook_secret"
                                               name="kova_agent_settings[webhook_secret]"
                                               value="<?php echo esc_attr($settings['webhook_secret'] ?? ''); ?>"
                                               class="regular-text"
                                               readonly>
                                        <p class="description"><?php _e('This will be set automatically when you connect to Kova.', 'kova-agent'); ?></p>
                                    </td>
                                </tr>
                            </table>

                            <div class="kova-actions">
                                <button type="button" id="kova-test-connection" class="button">
                                    <?php _e('Test Connection', 'kova-agent'); ?>
                                </button>
                                <button type="button" id="kova-sync-products" class="button">
                                    <?php _e('Sync Products', 'kova-agent'); ?>
                                </button>
                                <button type="button" id="kova-setup-webhooks" class="button">
                                    <?php _e('Setup Webhooks', 'kova-agent'); ?>
                                </button>
                                <span id="kova-action-status"></span>
                            </div>
                        </div>

                        <!-- Widget Appearance -->
                        <div class="kova-section">
                            <h2><?php _e('Widget Appearance', 'kova-agent'); ?></h2>

                            <table class="form-table">
                                <tr>
                                    <th scope="row">
                                        <label for="kova_widget_title"><?php _e('Widget Title', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <input type="text"
                                               id="kova_widget_title"
                                               name="kova_agent_settings[widget_title]"
                                               value="<?php echo esc_attr($settings['widget_title'] ?? 'Kova Assistant'); ?>"
                                               class="regular-text">
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">
                                        <label for="kova_welcome_message"><?php _e('Welcome Message', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <textarea id="kova_welcome_message"
                                                  name="kova_agent_settings[welcome_message]"
                                                  rows="3"
                                                  class="large-text"><?php echo esc_textarea($settings['welcome_message'] ?? ''); ?></textarea>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">
                                        <label for="kova_widget_color"><?php _e('Widget Color', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <input type="text"
                                               id="kova_widget_color"
                                               name="kova_agent_settings[widget_color]"
                                               value="<?php echo esc_attr($settings['widget_color'] ?? '#6366f1'); ?>"
                                               class="kova-color-picker">
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">
                                        <label for="kova_widget_position"><?php _e('Widget Position', 'kova-agent'); ?></label>
                                    </th>
                                    <td>
                                        <select id="kova_widget_position" name="kova_agent_settings[widget_position]">
                                            <option value="bottom-right" <?php selected($settings['widget_position'] ?? '', 'bottom-right'); ?>><?php _e('Bottom Right', 'kova-agent'); ?></option>
                                            <option value="bottom-left" <?php selected($settings['widget_position'] ?? '', 'bottom-left'); ?>><?php _e('Bottom Left', 'kova-agent'); ?></option>
                                            <option value="top-right" <?php selected($settings['widget_position'] ?? '', 'top-right'); ?>><?php _e('Top Right', 'kova-agent'); ?></option>
                                            <option value="top-left" <?php selected($settings['widget_position'] ?? '', 'top-left'); ?>><?php _e('Top Left', 'kova-agent'); ?></option>
                                        </select>
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <!-- Display Settings -->
                        <div class="kova-section">
                            <h2><?php _e('Display Settings', 'kova-agent'); ?></h2>

                            <table class="form-table">
                                <tr>
                                    <th scope="row"><?php _e('Show on Mobile', 'kova-agent'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox"
                                                   name="kova_agent_settings[show_on_mobile]"
                                                   value="1"
                                                   <?php checked(!empty($settings['show_on_mobile'])); ?>>
                                            <?php _e('Display widget on mobile devices', 'kova-agent'); ?>
                                        </label>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php _e('Show on Product Pages', 'kova-agent'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox"
                                                   name="kova_agent_settings[show_on_product_pages]"
                                                   value="1"
                                                   <?php checked(!empty($settings['show_on_product_pages'])); ?>>
                                            <?php _e('Display widget on single product pages', 'kova-agent'); ?>
                                        </label>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php _e('Show on Cart Page', 'kova-agent'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox"
                                                   name="kova_agent_settings[show_on_cart_page]"
                                                   value="1"
                                                   <?php checked(!empty($settings['show_on_cart_page'])); ?>>
                                            <?php _e('Display widget on cart page', 'kova-agent'); ?>
                                        </label>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php _e('Show on Checkout', 'kova-agent'); ?></th>
                                    <td>
                                        <label>
                                            <input type="checkbox"
                                                   name="kova_agent_settings[show_on_checkout]"
                                                   value="1"
                                                   <?php checked(!empty($settings['show_on_checkout'])); ?>>
                                            <?php _e('Display widget on checkout page', 'kova-agent'); ?>
                                        </label>
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <?php submit_button(); ?>
                    </form>
                </div>

                <div class="kova-admin-sidebar">
                    <div class="kova-info-box">
                        <h3><?php _e('Quick Start', 'kova-agent'); ?></h3>
                        <ol>
                            <li><?php _e('Create WooCommerce API keys (Read/Write)', 'kova-agent'); ?></li>
                            <li><?php _e('Enter your API credentials above', 'kova-agent'); ?></li>
                            <li><?php _e('Click "Test Connection" to verify', 'kova-agent'); ?></li>
                            <li><?php _e('Click "Sync Products" to import your catalog', 'kova-agent'); ?></li>
                            <li><?php _e('Enable the widget and save settings', 'kova-agent'); ?></li>
                        </ol>
                    </div>

                    <div class="kova-info-box">
                        <h3><?php _e('Need Help?', 'kova-agent'); ?></h3>
                        <p><?php _e('Check our documentation for detailed setup instructions.', 'kova-agent'); ?></p>
                        <a href="https://docs.kova.ai" target="_blank" class="button button-secondary">
                            <?php _e('View Documentation', 'kova-agent'); ?>
                        </a>
                    </div>

                    <div class="kova-info-box">
                        <h3><?php _e('Store Info', 'kova-agent'); ?></h3>
                        <p><strong><?php _e('Site URL:', 'kova-agent'); ?></strong><br><?php echo esc_html(site_url()); ?></p>
                        <p><strong><?php _e('WooCommerce Version:', 'kova-agent'); ?></strong><br><?php echo esc_html(WC()->version ?? 'N/A'); ?></p>
                        <p><strong><?php _e('Currency:', 'kova-agent'); ?></strong><br><?php echo esc_html(get_woocommerce_currency()); ?></p>
                        <p><strong><?php _e('Products:', 'kova-agent'); ?></strong><br><?php echo esc_html(wp_count_posts('product')->publish); ?></p>
                    </div>
                </div>
            </div>
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
        $api_endpoint = $settings['api_endpoint'] ?? 'https://api.kova.ai';
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
                    __('Connected successfully! Store: %s, WooCommerce: %s', 'kova-agent'),
                    $body['data']['storeName'] ?? 'Unknown',
                    $body['data']['woocommerceVersion'] ?? 'Unknown'
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
        $api_endpoint = $settings['api_endpoint'] ?? 'https://api.kova.ai';

        $response = wp_remote_post($api_endpoint . '/api/woo/sync-products', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'siteUrl' => site_url(),
            )),
            'timeout' => 120, // Products sync can take a while
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
        $api_endpoint = $settings['api_endpoint'] ?? 'https://api.kova.ai';

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
}
