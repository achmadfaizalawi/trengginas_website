<?php
// Template konfigurasi koneksi database.
// Copy file ini jadi "config.php" (di folder yang sama) lalu isi kredensial asli.
// File "config.php" sendiri TIDAK ikut di-commit ke git (lihat .gitignore).
$db_host = "localhost";
$db_user = "ganti_dengan_username_db";
$db_pass = "ganti_dengan_password_db";
$db_name = "ganti_dengan_nama_db";

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode([
        "status" => "error",
        "success" => false,
        "error" => "Database connection failed: " . $conn->connect_error,
        "message" => "Database connection failed: " . $conn->connect_error
    ]));
}
