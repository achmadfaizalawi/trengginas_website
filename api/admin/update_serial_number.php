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
// UPDATE SERIAL NUMBER
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

// Validate required fields
if (!isset($data['id']) || !isset($data['is_active'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Missing required fields: id and is_active are required'
    ]);
    $conn->close();
    exit;
}

$id = (int)$data['id'];
$is_active = (int)$data['is_active'];

// Handle optional field (set to NULL if empty)
$company_name = isset($data['company_name']) && !empty($data['company_name']) ? trim($data['company_name']) : null;

// Check if serial number exists
$stmt = $conn->prepare("SELECT id FROM serial_numbers WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$checkResult = $stmt->get_result();

if ($checkResult->num_rows === 0) {
    echo json_encode([
        'success' => false,
        'message' => 'Serial number not found'
    ]);
    $stmt->close();
    $conn->close();
    exit;
}
$stmt->close();

// Update serial number (only is_active and company_name)
$stmt = $conn->prepare("
    UPDATE serial_numbers 
    SET is_active = ?, 
        company_name = ? 
    WHERE id = ?
");
$stmt->bind_param("isi", $is_active, $company_name, $id);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Serial number updated successfully'
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update serial number: ' . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>