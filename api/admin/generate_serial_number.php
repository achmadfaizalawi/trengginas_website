<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// =================================================================
// KONEKSI DATABASE (LANGSUNG)
// =================================================================
require_once __DIR__ . '/../config.php';

// Set timezone to WIB
$conn->query("SET time_zone = '+07:00'");

// =================================================================
// GENERATE SERIAL NUMBER WITH GAP DETECTION
// =================================================================

// Get all existing serial numbers with TRG prefix
$sql = "SELECT serial_code FROM serial_numbers WHERE serial_code LIKE 'TRG%' ORDER BY serial_code ASC";
$result = $conn->query($sql);

$existingNumbers = [];

if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $serialCode = $row['serial_code'];
        // Extract number from serial code (e.g., TRG005 -> 5)
        $number = (int)substr($serialCode, 3);
        $existingNumbers[] = $number;
    }
}

// Determine next number
$nextNumber = 1;

if (!empty($existingNumbers)) {
    $maxNumber = max($existingNumbers);
    
    // Check for gaps in the sequence
    $foundGap = false;
    for ($i = 1; $i <= $maxNumber; $i++) {
        if (!in_array($i, $existingNumbers)) {
            // Found a gap! Use this number
            $nextNumber = $i;
            $foundGap = true;
            break;
        }
    }
    
    // If no gap found, use max + 1
    if (!$foundGap) {
        $nextNumber = $maxNumber + 1;
    }
} else {
    // No existing serials, start from 1
    $nextNumber = 1;
}

// Format: TRG + 3-digit number (001, 002, 003, etc.)
$newSerialCode = 'TRG' . str_pad($nextNumber, 3, '0', STR_PAD_LEFT);

// Check if serial already exists (safety check)
$stmt = $conn->prepare("SELECT id FROM serial_numbers WHERE serial_code = ?");
$stmt->bind_param("s", $newSerialCode);
$stmt->execute();
$checkResult = $stmt->get_result();

if ($checkResult->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'Serial code already exists. Please try again.']);
    $stmt->close();
    $conn->close();
    exit;
}
$stmt->close();

// Insert new serial number with default values
$stmt = $conn->prepare("
    INSERT INTO serial_numbers 
    (serial_code, is_active, is_used, machine_id, used_by, company_name, used_at) 
    VALUES (?, 1, 0, NULL, NULL, NULL, NULL)
");
$stmt->bind_param("s", $newSerialCode);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Serial number generated successfully',
        'serial_code' => $newSerialCode
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to generate serial number']);
}

$stmt->close();
$conn->close();
?>