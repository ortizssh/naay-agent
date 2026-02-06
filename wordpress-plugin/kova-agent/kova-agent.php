<?php
/**
 * Plugin Name: Kova Agent - AI Shopping Assistant
 * Plugin URI: https://kova.ai
 * Description: AI-powered shopping assistant for WooCommerce stores. Provides intelligent product search, recommendations, and cart management through a chat widget.
 * Version: 1.0.0
 * Author: Kova AI
 * Author URI: https://kova.ai
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: kova-agent
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 8.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Plugin constants
define('KOVA_AGENT_VERSION', '1.0.0');
define('KOVA_AGENT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('KOVA_AGENT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('KOVA_AGENT_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Check if WooCommerce is active
 */
function kova_agent_check_woocommerce() {
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', function() {
            ?>
            <div class="notice notice-error">
                <p><?php _e('Kova Agent requires WooCommerce to be installed and activated.', 'kova-agent'); ?></p>
            </div>
            <?php
        });
        return false;
    }
    return true;
}

/**
 * Initialize the plugin
 */
function kova_agent_init() {
    // Check for WooCommerce
    if (!kova_agent_check_woocommerce()) {
        return;
    }

    // Load plugin classes
    require_once KOVA_AGENT_PLUGIN_DIR . 'includes/class-kova-admin.php';
    require_once KOVA_AGENT_PLUGIN_DIR . 'includes/class-kova-widget.php';
    require_once KOVA_AGENT_PLUGIN_DIR . 'includes/class-kova-api.php';
    require_once KOVA_AGENT_PLUGIN_DIR . 'includes/class-kova-updater.php';

    // Initialize components
    new Kova_Admin();
    new Kova_Widget();
    new Kova_API();
    new Kova_Updater();
}
add_action('plugins_loaded', 'kova_agent_init');

/**
 * Activation hook
 */
function kova_agent_activate() {
    // Create default options
    $default_options = array(
        'enabled' => false,
        'api_endpoint' => 'https://api.kova.ai',
        'api_key' => '',
        'consumer_key' => '',
        'consumer_secret' => '',
        'webhook_secret' => '',
        'widget_position' => 'bottom-right',
        'widget_color' => '#6366f1',
        'welcome_message' => __('Hello! How can I help you find the perfect product today?', 'kova-agent'),
        'widget_title' => __('Kova Assistant', 'kova-agent'),
        'show_on_mobile' => true,
        'show_on_product_pages' => true,
        'show_on_cart_page' => true,
        'show_on_checkout' => false,
    );

    // Only set defaults if options don't exist
    if (!get_option('kova_agent_settings')) {
        add_option('kova_agent_settings', $default_options);
    }

    // Flush rewrite rules
    flush_rewrite_rules();
}
register_activation_hook(__FILE__, 'kova_agent_activate');

/**
 * Deactivation hook
 */
function kova_agent_deactivate() {
    // Clean up scheduled events if any
    wp_clear_scheduled_hook('kova_agent_sync_products');

    // Flush rewrite rules
    flush_rewrite_rules();
}
register_deactivation_hook(__FILE__, 'kova_agent_deactivate');

/**
 * Add settings link to plugins page
 */
function kova_agent_settings_link($links) {
    $settings_link = '<a href="' . admin_url('admin.php?page=kova-agent') . '">' . __('Settings', 'kova-agent') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
}
add_filter('plugin_action_links_' . KOVA_AGENT_PLUGIN_BASENAME, 'kova_agent_settings_link');

/**
 * Declare HPOS compatibility
 */
add_action('before_woocommerce_init', function() {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});
