<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

// ========== KONEKSI DATABASE ==========
require_once __DIR__ . '/../config.php';

// ========== TERIMA DATA ==========
$data = json_decode(file_get_contents('php://input'), true);

$id = $data['id'] ?? null; 
$username = $data['username'] ?? '';
$full_name = $data['full_name'] ?? ''; // Ambil data Nama Lengkap
$password = $data['password'] ?? ''; 
$role = $data['role'] ?? '';

// ========== VALIDASI INPUT (REQ BARU) ==========

// 1. Cek Wajib Isi
if (empty($username) || empty($role) || empty($full_name)) {
    echo json_encode(["status" => "error", "message" => "Username, Nama Lengkap, dan Role wajib diisi!"]);
    exit;
}

// 2. Cek Maksimal 30 Karakter untuk Full Name
if (strlen($full_name) > 30) {
    echo json_encode(["status" => "error", "message" => "Nama Lengkap maksimal 30 karakter!"]);
    exit;
}

// Logika Station (Tetap dipertahankan)
$assigned = null;
if ($role === 'operator' && isset($data['assigned_station_ids'])) {
    if (is_array($data['assigned_station_ids'])) {
        $assigned = implode(',', $data['assigned_station_ids']);
    } else {
        $assigned = $data['assigned_station_ids'];
    }
}

// ========== EKSEKUSI QUERY ==========

if ($id) {
    // === UPDATE USER (EDIT) ===
    
    // Cek apakah password diubah atau tidak
    if (!empty($password)) {
        // Update dengan password baru
        $sql = "UPDATE users SET username=?, full_name=?, password=?, role=?, assigned_station_id=? WHERE id=?";
        $stmt = $conn->prepare($sql);
        // bind_param: sssssi (6 parameter)
        $stmt->bind_param("sssssi", $username, $full_name, $password, $role, $assigned, $id);
    } else {
        // Update tanpa mengubah password
        $sql = "UPDATE users SET username=?, full_name=?, role=?, assigned_station_id=? WHERE id=?";
        $stmt = $conn->prepare($sql);
        // bind_param: ssssi (5 parameter)
        $stmt->bind_param("ssssi", $username, $full_name, $role, $assigned, $id);
    }
    $msg = "User berhasil diperbarui.";

} else {
    // === INSERT USER (BARU) ===
    
    // Cek Username Duplikat
    $check = $conn->query("SELECT id FROM users WHERE username='$username'");
    if($check->num_rows > 0) {
        echo json_encode(["status" => "error", "message" => "Username sudah digunakan!"]);
        exit;
    }
    
    // Wajib ada password untuk user baru
    if (empty($password)) {
        echo json_encode(["status" => "error", "message" => "Password wajib diisi untuk user baru!"]);
        exit;
    }

    $sql = "INSERT INTO users (username, full_name, password, role, assigned_station_id) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    // bind_param: sssss (5 parameter)
    $stmt->bind_param("sssss", $username, $full_name, $password, $role, $assigned);
    $msg = "User baru berhasil ditambahkan.";
}

if ($stmt->execute()) {
    echo json_encode(["status" => "success", "message" => $msg]);
} else {
    echo json_encode(["status" => "error", "message" => $stmt->error]);
}

$stmt->close();
$conn->close();
?>