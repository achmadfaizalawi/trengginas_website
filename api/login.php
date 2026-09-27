<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Koneksi Database
require_once __DIR__ . '/config.php';

// Ambil data JSON
$json_input = file_get_contents('php://input');
$data = json_decode($json_input, true);

$username = $data['username'] ?? '';
$password = $data['password'] ?? '';

if (empty($username) || empty($password)) {
    die(json_encode(["status" => "error", "message" => "Username dan Password wajib diisi"]));
}

// Query Cari User (Tambahkan full_name di SELECT)
$stmt = $conn->prepare("SELECT id, username, full_name, password, role, assigned_station_id FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $row = $result->fetch_assoc();
    $db_password = $row['password'];

    // Cek password (Hash atau Plain text)
    $is_valid_hash = password_verify($password, $db_password);
    $is_valid_text = ($password === $db_password);

    if ($is_valid_hash || $is_valid_text) {
        echo json_encode([
            "status" => "success",
            "message" => "Login Berhasil",
            "data" => [
                "user_id" => $row['id'],
                "username" => $row['username'],
                "full_name" => $row['full_name'], // Data ini dikirim ke frontend
                "role" => $row['role'],
                "assigned_station_id" => $row['assigned_station_id']
            ]
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "Password salah"]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "User tidak ditemukan"]);
}

$stmt->close();
$conn->close();
?>