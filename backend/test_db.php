<?php
try {
    $pdo = new PDO(
        'pgsql:host=aws-1-ap-southeast-1.pooler.supabase.com;port=6543;dbname=postgres',
        'postgres.aifkxyxfdrikuflkuvme',
        'P6zpmE2RQ4Sk2Dv1v'
    );
    echo "Connected to Supabase!\n";
    $result = $pdo->query("SELECT 1")->fetch();
    print_r($result);
} catch(Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
