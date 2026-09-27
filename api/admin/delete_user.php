<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

require_once __DIR__ . '/../config.php';

$data = json_decode(file_get_contents('php://input'), true);
$id = $data['id'];

// Jangan biarkan menghapus Superuser Utama (ID 1)
if($id == 1) {
    echo json_encode(["status" => "error", "message" => "Superuser utama tidak boleh dihapus!"]);
    exit;
}

$stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    echo json_encode(["status" => "success"]);
} else {
    echo json_encode(["status" => "error", "message" => $conn->error]);
}
$conn->close();
?>