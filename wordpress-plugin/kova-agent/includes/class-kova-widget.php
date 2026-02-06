<?php
/**
 * Kova Agent Widget Class
 * Handles the chat widget injection on the frontend
 */

if (!defined('ABSPATH')) {
    exit;
}

class Kova_Widget {

    /**
     * Plugin settings
     */
    private $settings;

    /**
     * Constructor
     */
    public function __construct() {
        $this->settings = get_option('kova_agent_settings', array());

        // Only load widget if enabled
        if (!empty($this->settings['enabled'])) {
            add_action('wp_enqueue_scripts', array($this, 'enqueue_widget_scripts'));
            add_action('wp_footer', array($this, 'render_widget'));
        }
    }

    /**
     * Check if widget should be displayed on current page
     */
    private function should_display_widget() {
        // Check mobile setting
        if (wp_is_mobile() && empty($this->settings['show_on_mobile'])) {
            return false;
        }

        // Check page-specific settings
        if (is_product() && empty($this->settings['show_on_product_pages'])) {
            return false;
        }

        if (is_cart() && empty($this->settings['show_on_cart_page'])) {
            return false;
        }

        if (is_checkout() && empty($this->settings['show_on_checkout'])) {
            return false;
        }

        return true;
    }

    /**
     * Enqueue widget scripts
     */
    public function enqueue_widget_scripts() {
        if (!$this->should_display_widget()) {
            return;
        }

        $api_endpoint = $this->settings['api_endpoint'] ?? 'https://api.kova.ai';

        // Enqueue the Kova widget script
        wp_enqueue_script(
            'kova-widget',
            $api_endpoint . '/widget/kova-widget.js',
            array(),
            KOVA_AGENT_VERSION,
            true
        );
    }

    /**
     * Get WooCommerce Store API nonce
     */
    private function get_store_api_nonce() {
        if (class_exists('Automattic\WooCommerce\StoreApi\StoreApi')) {
            return wp_create_nonce('wc_store_api');
        }
        return '';
    }

    /**
     * Get current page context
     */
    private function get_page_context() {
        $context = array(
            'page_type' => 'other',
            'product_id' => null,
            'category_id' => null,
        );

        if (is_front_page()) {
            $context['page_type'] = 'home';
        } elseif (is_shop()) {
            $context['page_type'] = 'shop';
        } elseif (is_product_category()) {
            $context['page_type'] = 'category';
            $category = get_queried_object();
            if ($category) {
                $context['category_id'] = $category->term_id;
                $context['category_name'] = $category->name;
            }
        } elseif (is_product()) {
            $context['page_type'] = 'product';
            $context['product_id'] = get_the_ID();
            $product = wc_get_product($context['product_id']);
            if ($product) {
                $context['product_name'] = $product->get_name();
                $context['product_price'] = $product->get_price();
                $context['product_sku'] = $product->get_sku();
            }
        } elseif (is_cart()) {
            $context['page_type'] = 'cart';
        } elseif (is_checkout()) {
            $context['page_type'] = 'checkout';
        } elseif (is_search()) {
            $context['page_type'] = 'search';
            $context['search_query'] = get_search_query();
        }

        return $context;
    }

    /**
     * Get customer information
     */
    private function get_customer_info() {
        $customer = array(
            'logged_in' => is_user_logged_in(),
            'customer_id' => null,
            'email' => null,
            'first_name' => null,
        );

        if (is_user_logged_in()) {
            $user = wp_get_current_user();
            $customer['customer_id'] = $user->ID;
            $customer['email'] = $user->user_email;
            $customer['first_name'] = $user->first_name;
        }

        return $customer;
    }

    /**
     * Render widget initialization script
     */
    public function render_widget() {
        if (!$this->should_display_widget()) {
            return;
        }

        $api_endpoint = $this->settings['api_endpoint'] ?? 'https://api.kova.ai';
        $page_context = $this->get_page_context();
        $customer = $this->get_customer_info();
        $nonce = $this->get_store_api_nonce();

        // Widget configuration
        $widget_config = array(
            'platform' => 'woocommerce',
            'shop' => site_url(),
            'apiEndpoint' => $api_endpoint,
            'nonce' => $nonce,
            'currency' => get_woocommerce_currency(),
            'currencySymbol' => get_woocommerce_currency_symbol(),
            'cartUrl' => wc_get_cart_url(),
            'checkoutUrl' => wc_get_checkout_url(),
            'pageContext' => $page_context,
            'customer' => $customer,
            'design' => array(
                'position' => $this->settings['widget_position'] ?? 'bottom-right',
                'primaryColor' => $this->settings['widget_color'] ?? '#6366f1',
                'title' => $this->settings['widget_title'] ?? 'Kova Assistant',
                'welcomeMessage' => $this->settings['welcome_message'] ?? '',
            ),
        );
        ?>
        <script type="text/javascript">
            (function() {
                // Wait for Kova widget to load
                function initKovaWidget() {
                    if (typeof window.KovaWidget !== 'undefined') {
                        window.KovaWidget.init(<?php echo json_encode($widget_config); ?>);
                    } else {
                        // Retry after a short delay
                        setTimeout(initKovaWidget, 100);
                    }
                }

                if (document.readyState === 'complete') {
                    initKovaWidget();
                } else {
                    window.addEventListener('load', initKovaWidget);
                }

                // Expose cart update function for WooCommerce events
                window.kovaUpdateCart = function() {
                    if (typeof window.KovaWidget !== 'undefined' && window.KovaWidget.updateCart) {
                        window.KovaWidget.updateCart();
                    }
                };

                // Listen for WooCommerce cart updates
                jQuery(document.body).on('added_to_cart removed_from_cart updated_cart_totals', function() {
                    window.kovaUpdateCart();
                });
            })();
        </script>
        <?php
    }
}
