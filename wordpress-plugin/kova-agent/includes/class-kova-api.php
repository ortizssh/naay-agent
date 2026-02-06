<?php
/**
 * Kova Agent API Class
 * Handles API connection setup and management
 */

if (!defined('ABSPATH')) {
    exit;
}

class Kova_API {

    /**
     * Plugin settings
     */
    private $settings;

    /**
     * Constructor
     */
    public function __construct() {
        $this->settings = get_option('kova_agent_settings', array());

        // Register REST API endpoints
        add_action('rest_api_init', array($this, 'register_rest_routes'));

        // Add connection on settings save
        add_action('update_option_kova_agent_settings', array($this, 'on_settings_updated'), 10, 2);
    }

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('kova-agent/v1', '/status', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_status'),
            'permission_callback' => '__return_true',
        ));

        register_rest_route('kova-agent/v1', '/config', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_config'),
            'permission_callback' => '__return_true',
        ));
    }

    /**
     * Get plugin status
     */
    public function get_status($request) {
        $settings = get_option('kova_agent_settings', array());

        return new WP_REST_Response(array(
            'success' => true,
            'data' => array(
                'enabled' => !empty($settings['enabled']),
                'connected' => !empty($settings['consumer_key']) && !empty($settings['consumer_secret']),
                'version' => KOVA_AGENT_VERSION,
                'woocommerce_version' => WC()->version ?? 'unknown',
            ),
        ), 200);
    }

    /**
     * Get widget configuration
     */
    public function get_config($request) {
        $settings = get_option('kova_agent_settings', array());

        if (empty($settings['enabled'])) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'Widget is disabled',
            ), 200);
        }

        return new WP_REST_Response(array(
            'success' => true,
            'data' => array(
                'platform' => 'woocommerce',
                'shop' => site_url(),
                'currency' => get_woocommerce_currency(),
                'currencySymbol' => get_woocommerce_currency_symbol(),
                'design' => array(
                    'position' => $settings['widget_position'] ?? 'bottom-right',
                    'primaryColor' => $settings['widget_color'] ?? '#6366f1',
                    'title' => $settings['widget_title'] ?? 'Kova Assistant',
                    'welcomeMessage' => $settings['welcome_message'] ?? '',
                ),
            ),
        ), 200);
    }

    /**
     * Handle settings update
     */
    public function on_settings_updated($old_value, $new_value) {
        // Check if API credentials changed
        $credentials_changed = (
            ($old_value['consumer_key'] ?? '') !== ($new_value['consumer_key'] ?? '') ||
            ($old_value['consumer_secret'] ?? '') !== ($new_value['consumer_secret'] ?? '')
        );

        if ($credentials_changed && !empty($new_value['consumer_key']) && !empty($new_value['consumer_secret'])) {
            // Attempt to connect to Kova API
            $this->connect_to_kova($new_value);
        }
    }

    /**
     * Connect to Kova API
     */
    private function connect_to_kova($settings) {
        $api_endpoint = $settings['api_endpoint'] ?? 'https://api.kova.ai';

        $response = wp_remote_post($api_endpoint . '/api/woo/connect', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'siteUrl' => site_url(),
                'consumerKey' => $settings['consumer_key'],
                'consumerSecret' => $settings['consumer_secret'],
            )),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            error_log('Kova Agent: Connection failed - ' . $response->get_error_message());
            return false;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success']) && !empty($body['data']['webhookSecret'])) {
            // Store the webhook secret
            $settings['webhook_secret'] = $body['data']['webhookSecret'];
            update_option('kova_agent_settings', $settings);

            error_log('Kova Agent: Connected successfully to ' . $api_endpoint);
            return true;
        }

        error_log('Kova Agent: Connection failed - ' . ($body['error'] ?? 'Unknown error'));
        return false;
    }

    /**
     * Disconnect from Kova API
     */
    public function disconnect_from_kova() {
        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://api.kova.ai';

        $response = wp_remote_post($api_endpoint . '/api/woo/disconnect', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'siteUrl' => site_url(),
            )),
            'timeout' => 30,
        ));

        // Clear webhook secret
        $settings['webhook_secret'] = '';
        update_option('kova_agent_settings', $settings);

        return !is_wp_error($response);
    }

    /**
     * Get API endpoint for widget
     */
    public static function get_api_endpoint() {
        $settings = get_option('kova_agent_settings', array());
        return $settings['api_endpoint'] ?? 'https://api.kova.ai';
    }
}
