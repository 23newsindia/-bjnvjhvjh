<?php
// includes/class-seo-manager.php

if (!defined('ABSPATH')) {
    exit;
}

class SEOManager {
    private $options_cache = array();
    
    private function get_option($key, $default = false) {
        if (!isset($this->options_cache[$key])) {
            $this->options_cache[$key] = get_option($key, $default);
        }
        return $this->options_cache[$key];
    }

    private function is_woocommerce_active() {
        return class_exists('WooCommerce');
    }

    public function init() {
        add_action('init', array($this, 'handle_seo_redirects'), 1);
        add_action('template_redirect', array($this, 'handle_410_responses'));
        add_action('wp_trash_post', array($this, 'store_deleted_post_url'));
        add_action('before_delete_post', array($this, 'store_deleted_post_url'));
    }

    public function handle_seo_redirects() {
        if (is_admin()) {
            return;
        }

        $current_url = $_SERVER['REQUEST_URI'];
        
        // Only check for WooCommerce spam URLs if WooCommerce is active
        if ($this->is_woocommerce_active()) {
            // Handle spam filter URLs
            if ($this->is_spam_filter_url($current_url)) {
                $this->send_410_response('Spam filter URL detected');
            }
        }

        // Handle excessive query parameters (works for any site)
        if ($this->has_excessive_query_params($current_url)) {
            $this->send_410_response('Excessive query parameters');
        }
    }

    private function is_spam_filter_url($url) {
        // Only run if WooCommerce is active
        if (!$this->is_woocommerce_active()) {
            return false;
        }

        // Parse URL to get query parameters
        $parsed_url = parse_url($url);
        if (!isset($parsed_url['query'])) {
            return false;
        }

        parse_str($parsed_url['query'], $query_params);

        // Check for spam patterns in filter URLs
        $spam_patterns = array(
            // Multiple color filters (more than allowed limit)
            'filter_colour' => $this->get_option('security_max_filter_colours', 3),
            'filter_size' => $this->get_option('security_max_filter_sizes', 4),
            'filter_brand' => $this->get_option('security_max_filter_brands', 2),
        );

        foreach ($spam_patterns as $param => $max_allowed) {
            if (isset($query_params[$param])) {
                $values = explode(',', $query_params[$param]);
                if (count($values) > $max_allowed) {
                    return true;
                }
            }
        }

        // Check for suspicious query combinations
        $total_filters = 0;
        foreach (array('filter_colour', 'filter_size', 'filter_brand', 'filter_price') as $filter) {
            if (isset($query_params[$filter])) {
                $total_filters += count(explode(',', $query_params[$filter]));
            }
        }

        // If total filters exceed threshold, consider it spam
        if ($total_filters > $this->get_option('security_max_total_filters', 8)) {
            return true;
        }

        return false;
    }

    private function has_excessive_query_params($url) {
        $parsed_url = parse_url($url);
        if (!isset($parsed_url['query'])) {
            return false;
        }

        parse_str($parsed_url['query'], $query_params);
        
        // Check total number of query parameters
        $max_params = $this->get_option('security_max_query_params', 10);
        if (count($query_params) > $max_params) {
            return true;
        }

        // Check total query string length
        $max_length = $this->get_option('security_max_query_length', 500);
        if (strlen($parsed_url['query']) > $max_length) {
            return true;
        }

        return false;
    }

    public function handle_410_responses() {
        global $wp_query;

        // Handle 410 for deleted posts
        if (is_404()) {
            $current_url = $_SERVER['REQUEST_URI'];
            $deleted_urls = get_option('security_deleted_post_urls', array());
            
            if (in_array($current_url, $deleted_urls)) {
                $this->send_410_response('Content permanently removed');
            }
        }
    }

    public function store_deleted_post_url($post_id) {
        $post = get_post($post_id);
        if (!$post) {
            return;
        }

        $post_url = parse_url(get_permalink($post_id), PHP_URL_PATH);
        $deleted_urls = get_option('security_deleted_post_urls', array());
        
        if (!in_array($post_url, $deleted_urls)) {
            $deleted_urls[] = $post_url;
            // Keep only last 1000 deleted URLs to prevent database bloat
            if (count($deleted_urls) > 1000) {
                $deleted_urls = array_slice($deleted_urls, -1000);
            }
            update_option('security_deleted_post_urls', $deleted_urls);
        }
    }

    private function send_410_response($message = 'Gone') {
        status_header(410);
        nocache_headers();
        header('HTTP/1.1 410 Gone');
        header('Status: 410 Gone');
        header('Content-Type: text/html; charset=utf-8');
        
        // Custom 410 page content
        $custom_410_content = $this->get_option('security_410_page_content', '');
        
        if (!empty($custom_410_content)) {
            echo $custom_410_content;
        } else {
            echo $this->get_default_410_page();
        }
        
        exit;
    }

    private function get_default_410_page() {
        return '<!DOCTYPE html>
<html>
<head>
    <title>410 - Content Removed</title>
    <meta name="robots" content="noindex, nofollow">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error-container { max-width: 600px; margin: 0 auto; }
        h1 { color: #d32f2f; }
        p { color: #666; line-height: 1.6; }
        .back-link { color: #1976d2; text-decoration: none; }
        .back-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>410 - Content Permanently Removed</h1>
        <p>The content you are looking for has been permanently removed and is no longer available.</p>
        <p><a href="' . home_url() . '" class="back-link">← Return to Homepage</a></p>
    </div>
</body>
</html>';
    }

    public function clean_url_for_seo($url) {
        // Only run WooCommerce-specific cleaning if WooCommerce is active
        if (!$this->is_woocommerce_active()) {
            return $url;
        }

        // Remove excessive parameters while keeping essential ones
        $parsed_url = parse_url($url);
        if (!isset($parsed_url['query'])) {
            return $url;
        }

        parse_str($parsed_url['query'], $query_params);
        
        // Keep only essential WooCommerce parameters
        $essential_params = array(
            'filter_colour' => 1, // Limit to 1 color
            'filter_size' => 2,   // Limit to 2 sizes
            'orderby' => true,
            'order' => true,
            'paged' => true,
            'per_page' => true,
            'in-stock' => true
        );

        $cleaned_params = array();
        foreach ($essential_params as $param => $limit) {
            if (isset($query_params[$param])) {
                if (is_numeric($limit) && $param !== 'in-stock') {
                    // Limit multiple values
                    $values = explode(',', $query_params[$param]);
                    $cleaned_params[$param] = implode(',', array_slice($values, 0, $limit));
                } else {
                    $cleaned_params[$param] = $query_params[$param];
                }
            }
        }

        if (empty($cleaned_params)) {
            return $parsed_url['path'];
        }

        return $parsed_url['path'] . '?' . http_build_query($cleaned_params);
    }
}