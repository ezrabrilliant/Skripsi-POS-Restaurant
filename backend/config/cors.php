<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://*.ngrok-free.app',
        'https://*.ngrok.io',
        'https://machelle-collectional-acropetally.ngrok-free.dev',
    ],

    'allowed_origins_patterns' => [
        '#^https://.*\.ngrok-free\.dev$#',
        '#^https://.*\.ngrok\.io$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
