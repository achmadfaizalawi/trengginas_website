<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// =================================================================
// KONEKSI DATABASE (LANGSUNG)
// =================================================================
require_once __DIR__ . '/../config.php';

// Set timezone to WIB
$conn->query("SET time_zone = '+07:00'");

// =================================================================
// GET SERIAL NUMBERS
// =================================================================

// Check if specific ID requested
if (isset($_GET['id']) && !empty($_GET['id'])) {
    $id = (int)$_GET['id'];
    $stmt = $conn->prepare("SELECT * FROM serial_numbers WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    
    echo json_encode($data);
    $stmt->close();
} else {
    // Get all serial numbers, ordered by id DESC (newest first)
    $sql = "SELECT * FROM serial_numbers ORDER BY id DESC";
    $result = $conn->query($sql);
    
    $data = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $data[] = $row;
        }
    }
    
    echo json_encode($data);
}

$conn->close();
?>