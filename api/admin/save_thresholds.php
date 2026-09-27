<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

// ========== KONEKSI DATABASE ==========
require_once __DIR__ . '/../config.php';

// ========== TERIMA DATA ==========
$json_input = file_get_contents('php://input');
$data = json_decode($json_input, true);

$trengginas_id = $data['trengginas_id'] ?? '';
$thresholds = $data['thresholds'] ?? [];

// ========== VALIDASI ==========
if (empty($trengginas_id)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Trengginas ID wajib diisi!"]);
    exit;
}

// Cek station exists
$check = $conn->prepare("SELECT id FROM stations WHERE trengginas_id = ? LIMIT 1");
$check->bind_param("s", $trengginas_id);
$check->execute();
if ($check->get_result()->num_rows === 0) {
    http_response_code(404);
    echo json_encode(["status" => "error", "message" => "Stasiun tidak ditemukan!"]);
    exit;
}
$check->close();

// ========== PROSES SAVE ==========
$conn->begin_transaction();

try {
    // Hapus threshold lama untuk station ini
    $delete = $conn->prepare("DELETE FROM station_thresholds WHERE trengginas_id = ?");
    $delete->bind_param("s", $trengginas_id);
    $delete->execute();
    $delete->close();
    
    // Insert threshold baru
    $insert = $conn->prepare("
        INSERT INTO station_thresholds 
        (trengginas_id, parameter, min_safe, max_safe, min_warning, max_warning, enabled) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    
    $saved_count = 0;
    
    // Deklarasi variables untuk bind_param (avoid "pass by reference" warning)
    $null_value = null;
    $zero_value = 0;
    $one_value = 1;
    
    foreach ($thresholds as $param => $values) {
        // Flexible enabled check - handle integer, string, boolean
        $enabled_raw = $values['enabled'] ?? 0;
        
        // Convert ke integer: true/1/"1" → 1, false/0/"0" → 0
        if (is_bool($enabled_raw)) {
            $enabled = $enabled_raw ? 1 : 0;
        } else {
            $enabled = (int)$enabled_raw;
        }
        
        // Tetap save meskipun disabled (untuk track history)
        if ($enabled === 0) {
            $insert->bind_param("ssddddi", 
                $trengginas_id, 
                $param, 
                $null_value, 
                $null_value, 
                $null_value, 
                $null_value, 
                $zero_value
            );
            
            if ($insert->execute()) {
                $saved_count++;
            }
            continue;
        }
        
        // Parse threshold values
        $min_safe = isset($values['min_safe']) && $values['min_safe'] !== '' ? floatval($values['min_safe']) : null;
        $max_safe = isset($values['max_safe']) && $values['max_safe'] !== '' ? floatval($values['max_safe']) : null;
        $min_warning = isset($values['min_warning']) && $values['min_warning'] !== '' ? floatval($values['min_warning']) : null;
        $max_warning = isset($values['max_warning']) && $values['max_warning'] !== '' ? floatval($values['max_warning']) : null;
        
        // Validasi: minimal ada 1 nilai threshold jika enabled
        if ($min_safe === null && $max_safe === null && $min_warning === null && $max_warning === null) {
            continue;
        }
        
        $insert->bind_param("ssddddi", 
            $trengginas_id, 
            $param, 
            $min_safe, 
            $max_safe, 
            $min_warning, 
            $max_warning, 
            $one_value
        );
        
        if ($insert->execute()) {
            $saved_count++;
        }
    }
    
    $insert->close();
    $conn->commit();
    
    echo json_encode([
        "status" => "success", 
        "message" => "Ambang batas berhasil disimpan",
        "data" => [
            "trengginas_id" => $trengginas_id,
            "saved_parameters" => $saved_count
        ]
    ]);
    
} catch (Exception $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Gagal menyimpan: " . $e->getMessage()
    ]);
}

$conn->close();
?>