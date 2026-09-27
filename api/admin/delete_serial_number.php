<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// =================================================================
// KONEKSI DATABASE (LANGSUNG)
// =================================================================
require_once __DIR__ . '/../config.php';

// Set timezone to WIB
$conn->query("SET time_zone = '+07:00'");

// =================================================================
// DELETE SERIAL NUMBER
// =================================================================

// Only allow POST method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    $conn->close();
    exit;
}

// Get JSON input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Validate required field
if (!isset($data['id'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Missing required field: id'
    ]);
    $conn->close();
    exit;
}

$id = (int)$data['id'];

// Check if serial number exists
$stmt = $conn->prepare("SELECT serial_code, is_used FROM serial_numbers WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode([
        'success' => false,
        'message' => 'Serial number not found'
    ]);
    $stmt->close();
    $conn->close();
    exit;
}

$serial = $result->fetch_assoc();
$stmt->close();

// Prevent deletion if serial is USED
if ($serial['is_used'] == 1) {
    echo json_encode([
        'success' => false,
        'message' => 'Cannot delete serial number that is currently in use'
    ]);
    $conn->close();
    exit;
}

// Delete serial number
$stmt = $conn->prepare("DELETE FROM serial_numbers WHERE id = ?");
$stmt->bind_param("i", $id);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Serial number deleted successfully',
        'serial_code' => $serial['serial_code']
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete serial number: ' . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>