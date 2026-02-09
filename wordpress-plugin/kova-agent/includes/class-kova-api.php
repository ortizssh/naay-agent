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

        // Always sync widget configuration when settings are updated
        $this->sync_widget_config($new_value);
    }

    /**
     * Sync widget configuration with Kova backend
     */
    private function sync_widget_config($settings) {
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';

        $config = array(
            'enabled' => !empty($settings['enabled']),
            'position' => $settings['widget_position'] ?? 'bottom-right',
            'primaryColor' => $settings['widget_color'] ?? '#6366f1',
            'secondaryColor' => $settings['widget_secondary_color'] ?? '#212120',
            'accentColor' => $settings['widget_accent_color'] ?? '#cf795e',
            'greeting' => $settings['welcome_message'] ?? '',
            'greeting2' => $settings['welcome_message_2'] ?? '',
            'subtitle2' => $settings['subtitle_2'] ?? '',
            'greeting3' => $settings['welcome_message_3'] ?? '',
            'subtitle3' => $settings['subtitle_3'] ?? '',
            'rotatingMessagesEnabled' => !empty($settings['rotating_messages_enabled']),
            'rotatingMessagesInterval' => intval($settings['rotating_messages_interval'] ?? 5),
            'subtitle' => $settings['widget_subtitle'] ?? 'Asistente de compras con IA',
            'placeholder' => $settings['widget_placeholder'] ?? 'Escribe tu mensaje...',
            'avatar' => $settings['widget_avatar'] ?? '🌿',
            'brandName' => $settings['widget_brand_name'] ?? get_bloginfo('name'),
            'buttonSize' => intval($settings['widget_button_size'] ?? 72),
            'buttonStyle' => $settings['widget_button_style'] ?? 'circle',
            'showPulse' => !empty($settings['widget_show_pulse']),
            'chatWidth' => intval($settings['widget_chat_width'] ?? 420),
            'chatHeight' => intval($settings['widget_chat_height'] ?? 600),
            'showPromoMessage' => !empty($settings['widget_show_promo_message']),
            'showCart' => isset($settings['widget_show_cart']) ? !empty($settings['widget_show_cart']) : true,
            'enableAnimations' => isset($settings['widget_enable_animations']) ? !empty($settings['widget_enable_animations']) : true,
            'theme' => $settings['widget_theme'] ?? 'light',
            'promoBadgeEnabled' => !empty($settings['promo_badge_enabled']),
            'promoBadgeType' => $settings['promo_badge_type'] ?? 'discount',
            'promoBadgeDiscount' => intval($settings['promo_badge_discount'] ?? 10),
            'promoBadgeText' => $settings['promo_badge_text'] ?? 'Descuento especial',
            'promoBadgeColor' => $settings['promo_badge_color'] ?? '#ef4444',
            'promoBadgeShape' => $settings['promo_badge_shape'] ?? 'circle',
            'promoBadgePosition' => $settings['promo_badge_position'] ?? 'right',
            'promoBadgeSuffix' => $settings['promo_badge_suffix'] ?? 'OFF',
            'promoBadgePrefix' => $settings['promo_badge_prefix'] ?? '',
            'promoBadgeFontSize' => intval($settings['promo_badge_font_size'] ?? 12),
            'suggestedQuestion1Text' => $settings['suggested_question_1_text'] ?? 'Recomendaciones personalizadas',
            'suggestedQuestion1Message' => $settings['suggested_question_1_message'] ?? '¿Qué productos recomiendas para mí?',
            'suggestedQuestion2Text' => $settings['suggested_question_2_text'] ?? 'Ayuda con mi compra',
            'suggestedQuestion2Message' => $settings['suggested_question_2_message'] ?? '¿Puedes ayudarme a elegir productos?',
            'suggestedQuestion3Text' => $settings['suggested_question_3_text'] ?? 'Información de envío',
            'suggestedQuestion3Message' => $settings['suggested_question_3_message'] ?? '¿Cuáles son las opciones de envío?',
        );

        $response = wp_remote_post($api_endpoint . '/api/woo/widget-config', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'siteUrl' => site_url(),
                'config' => $config,
            )),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            error_log('Kova Agent: Widget config sync failed - ' . $response->get_error_message());
            return false;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (!empty($body['success'])) {
            error_log('Kova Agent: Widget config synced successfully');
            return true;
        }

        error_log('Kova Agent: Widget config sync failed - ' . ($body['error'] ?? 'Unknown error'));
        return false;
    }

    /**
     * Connect to Kova API
     */
    private function connect_to_kova($settings) {
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';

        $response = wp_remote_post($api_endpoint . '/api/woo/connect', array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'siteUrl'       => site_url(),
                'consumerKey'   => $settings['consumer_key'],
                'consumerSecret'=> $settings['consumer_secret'],
                'storeName'     => get_bloginfo('name'),
                'storeEmail'    => get_option('admin_email'),
                'currency'      => function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'USD',
                'country'       => class_exists('WC') && WC()->countries ? WC()->countries->get_base_country() : '',
                'timezone'      => wp_timezone_string(),
                'locale'        => get_locale(),
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
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';

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
        return $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';
    }
}
