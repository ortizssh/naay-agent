<?php
/**
 * Kova Agent Plugin Updater
 * Handles automatic updates from the Kova API server
 */

if (!defined('ABSPATH')) {
    exit;
}

class Kova_Updater {

    /**
     * Plugin slug
     */
    private $slug;

    /**
     * Plugin data
     */
    private $plugin_data;

    /**
     * Plugin file path
     */
    private $plugin_file;

    /**
     * Update server URL
     */
    private $update_url;

    /**
     * Cached update data
     */
    private $update_cache_key = 'kova_agent_update_data';

    /**
     * Cache expiration in seconds (6 hours)
     */
    private $cache_expiration = 21600;

    /**
     * Constructor
     */
    public function __construct() {
        $this->plugin_file = KOVA_AGENT_PLUGIN_BASENAME;
        $this->slug = 'kova-agent';

        // Get update URL from settings or use default
        $settings = get_option('kova_agent_settings', array());
        $api_endpoint = $settings['api_endpoint'] ?? 'https://naay-agent-app1763504937.azurewebsites.net';
        $this->update_url = trailingslashit($api_endpoint) . 'api/woo/plugin/update-info';

        // Hook into WordPress update system
        add_filter('pre_set_site_transient_update_plugins', array($this, 'check_for_update'));
        add_filter('plugins_api', array($this, 'plugin_info'), 20, 3);
        add_action('upgrader_process_complete', array($this, 'after_update'), 10, 2);

        // Add "Check for updates" link to plugin actions
        add_filter('plugin_action_links_' . $this->plugin_file, array($this, 'add_check_update_link'));

        // Handle manual update check
        add_action('admin_init', array($this, 'handle_manual_update_check'));

        // Clear cache on settings update
        add_action('update_option_kova_agent_settings', array($this, 'clear_update_cache'));
    }

    /**
     * Get plugin data
     */
    private function get_plugin_data() {
        if (!$this->plugin_data) {
            if (!function_exists('get_plugin_data')) {
                require_once ABSPATH . 'wp-admin/includes/plugin.php';
            }
            $this->plugin_data = get_plugin_data(KOVA_AGENT_PLUGIN_DIR . 'kova-agent.php');
        }
        return $this->plugin_data;
    }

    /**
     * Fetch update information from remote server
     */
    private function fetch_remote_info() {
        // Check cache first
        $cached = get_transient($this->update_cache_key);
        if ($cached !== false) {
            return $cached;
        }

        $settings = get_option('kova_agent_settings', array());

        // Build request with site info for tracking
        $body = array(
            'slug' => $this->slug,
            'version' => KOVA_AGENT_VERSION,
            'site_url' => get_site_url(),
            'wp_version' => get_bloginfo('version'),
            'wc_version' => defined('WC_VERSION') ? WC_VERSION : 'unknown',
            'php_version' => PHP_VERSION,
        );

        $response = wp_remote_post($this->update_url, array(
            'timeout' => 15,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-Kova-Site' => get_site_url(),
            ),
            'body' => json_encode($body),
        ));

        if (is_wp_error($response)) {
            // Log error but don't break functionality
            error_log('Kova Agent Update Check Failed: ' . $response->get_error_message());
            return false;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        if ($response_code !== 200) {
            error_log('Kova Agent Update Check Failed: HTTP ' . $response_code);
            return false;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (empty($data) || !isset($data['version'])) {
            return false;
        }

        // Cache the result
        set_transient($this->update_cache_key, $data, $this->cache_expiration);

        return $data;
    }

    /**
     * Check for plugin update
     */
    public function check_for_update($transient) {
        if (empty($transient->checked)) {
            return $transient;
        }

        $remote_info = $this->fetch_remote_info();

        if (!$remote_info || !isset($remote_info['version'])) {
            return $transient;
        }

        // Compare versions
        if (version_compare(KOVA_AGENT_VERSION, $remote_info['version'], '<')) {
            $plugin_data = $this->get_plugin_data();

            $update = new stdClass();
            $update->slug = $this->slug;
            $update->plugin = $this->plugin_file;
            $update->new_version = $remote_info['version'];
            $update->url = $remote_info['homepage'] ?? 'https://kova.ai';
            $update->package = $remote_info['download_url'] ?? '';
            $update->icons = $remote_info['icons'] ?? array();
            $update->banners = $remote_info['banners'] ?? array();
            $update->tested = $remote_info['tested'] ?? get_bloginfo('version');
            $update->requires = $remote_info['requires'] ?? '5.8';
            $update->requires_php = $remote_info['requires_php'] ?? '7.4';

            $transient->response[$this->plugin_file] = $update;
        } else {
            // No update available - add to no_update list
            $update = new stdClass();
            $update->slug = $this->slug;
            $update->plugin = $this->plugin_file;
            $update->new_version = KOVA_AGENT_VERSION;
            $update->url = 'https://kova.ai';

            $transient->no_update[$this->plugin_file] = $update;
        }

        return $transient;
    }

    /**
     * Provide plugin information for the WordPress plugin details modal
     */
    public function plugin_info($result, $action, $args) {
        if ($action !== 'plugin_information') {
            return $result;
        }

        if (!isset($args->slug) || $args->slug !== $this->slug) {
            return $result;
        }

        $remote_info = $this->fetch_remote_info();

        if (!$remote_info) {
            return $result;
        }

        $plugin_data = $this->get_plugin_data();

        $info = new stdClass();
        $info->name = $plugin_data['Name'];
        $info->slug = $this->slug;
        $info->version = $remote_info['version'];
        $info->author = $plugin_data['Author'];
        $info->author_profile = $plugin_data['AuthorURI'];
        $info->homepage = $remote_info['homepage'] ?? $plugin_data['PluginURI'];
        $info->requires = $remote_info['requires'] ?? '5.8';
        $info->requires_php = $remote_info['requires_php'] ?? '7.4';
        $info->tested = $remote_info['tested'] ?? get_bloginfo('version');
        $info->downloaded = $remote_info['downloaded'] ?? 0;
        $info->last_updated = $remote_info['last_updated'] ?? date('Y-m-d');
        $info->download_link = $remote_info['download_url'] ?? '';

        // Sections
        $info->sections = array(
            'description' => $remote_info['description'] ?? $plugin_data['Description'],
            'changelog' => $remote_info['changelog'] ?? '<p>See <a href="https://kova.ai/changelog">kova.ai/changelog</a> for full changelog.</p>',
            'installation' => $remote_info['installation'] ?? '<ol><li>Upload the plugin files to <code>/wp-content/plugins/kova-agent</code></li><li>Activate the plugin through the Plugins menu in WordPress</li><li>Configure the plugin in WooCommerce → Kova Agent</li></ol>',
        );

        // Banners and icons
        if (!empty($remote_info['banners'])) {
            $info->banners = $remote_info['banners'];
        }
        if (!empty($remote_info['icons'])) {
            $info->icons = $remote_info['icons'];
        }

        return $info;
    }

    /**
     * Clear cache after update completes
     */
    public function after_update($upgrader, $options) {
        if ($options['action'] === 'update' && $options['type'] === 'plugin') {
            if (isset($options['plugins']) && is_array($options['plugins'])) {
                if (in_array($this->plugin_file, $options['plugins'])) {
                    $this->clear_update_cache();
                }
            }
        }
    }

    /**
     * Clear the update cache
     */
    public function clear_update_cache() {
        delete_transient($this->update_cache_key);
        delete_site_transient('update_plugins');
    }

    /**
     * Add "Check for updates" link to plugin action links
     */
    public function add_check_update_link($links) {
        $check_link = '<a href="' . wp_nonce_url(
            admin_url('plugins.php?kova_check_update=1'),
            'kova_check_update'
        ) . '">' . __('Check for updates', 'kova-agent') . '</a>';

        $links[] = $check_link;
        return $links;
    }

    /**
     * Handle manual update check request
     */
    public function handle_manual_update_check() {
        if (!isset($_GET['kova_check_update'])) {
            return;
        }

        if (!wp_verify_nonce($_GET['_wpnonce'], 'kova_check_update')) {
            return;
        }

        if (!current_user_can('update_plugins')) {
            return;
        }

        // Clear cache and force check
        $this->clear_update_cache();

        // Check for updates
        $remote_info = $this->fetch_remote_info();

        // Redirect back with message
        $redirect_url = admin_url('plugins.php');

        if ($remote_info && version_compare(KOVA_AGENT_VERSION, $remote_info['version'], '<')) {
            $redirect_url = add_query_arg('kova_update_available', '1', $redirect_url);
        } else {
            $redirect_url = add_query_arg('kova_update_checked', '1', $redirect_url);
        }

        wp_redirect($redirect_url);
        exit;
    }
}

// Display admin notices for update checks
add_action('admin_notices', function() {
    if (isset($_GET['kova_update_available'])) {
        ?>
        <div class="notice notice-info is-dismissible">
            <p><?php _e('A new version of Kova Agent is available! Go to the Updates page to install it.', 'kova-agent'); ?></p>
        </div>
        <?php
    }

    if (isset($_GET['kova_update_checked'])) {
        ?>
        <div class="notice notice-success is-dismissible">
            <p><?php _e('Kova Agent is up to date.', 'kova-agent'); ?></p>
        </div>
        <?php
    }
});
