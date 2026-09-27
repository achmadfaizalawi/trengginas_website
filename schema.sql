-- TRENGGINAS WQMS - Database Schema
-- Struktur tabel saja (tanpa data), siap diimport lewat phpMyAdmin
-- untuk membuat database baru yang masih kosong.
--
-- Generated from a phpMyAdmin dump (structure only, data stripped)
-- Server version: 10.11.19-MariaDB-cll-lve

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tred1873_wqms`
--

-- --------------------------------------------------------

--
-- Table structure for table `sensor_data_2min_avg`
--

DROP TABLE IF EXISTS `sensor_data_2min_avg`;

CREATE TABLE `sensor_data_2min_avg` (
  `id` int(11) NOT NULL,
  `2min_timestamp` datetime DEFAULT NULL,
  `trengginas_id` varchar(50) DEFAULT NULL,
  `avg_ph` decimal(10,2) DEFAULT NULL,
  `avg_cod` decimal(10,2) DEFAULT NULL,
  `avg_tss` decimal(10,2) DEFAULT NULL,
  `avg_ammonia` decimal(10,2) DEFAULT NULL,
  `avg_debit` decimal(10,2) DEFAULT NULL,
  `avg_temperature` decimal(10,2) DEFAULT NULL,
  `avg_do` decimal(10,2) DEFAULT NULL,
  `avg_bod` decimal(10,2) DEFAULT NULL,
  `avg_tds` decimal(10,2) DEFAULT NULL,
  `avg_turbidity` decimal(10,2) DEFAULT NULL,
  `avg_nitrate` decimal(10,2) DEFAULT NULL,
  `avg_water_level` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sensor_data_daily_avg`
--

DROP TABLE IF EXISTS `sensor_data_daily_avg`;

CREATE TABLE `sensor_data_daily_avg` (
  `id` int(11) NOT NULL,
  `day_timestamp` date DEFAULT NULL,
  `trengginas_id` varchar(50) DEFAULT NULL,
  `avg_ph` decimal(10,2) DEFAULT NULL,
  `avg_cod` decimal(10,2) DEFAULT NULL,
  `avg_tss` decimal(10,2) DEFAULT NULL,
  `avg_ammonia` decimal(10,2) DEFAULT NULL,
  `avg_debit` decimal(10,2) DEFAULT NULL,
  `avg_temperature` decimal(10,2) DEFAULT NULL,
  `avg_do` decimal(10,2) DEFAULT NULL,
  `avg_bod` decimal(10,2) DEFAULT NULL,
  `avg_tds` decimal(10,2) DEFAULT NULL,
  `avg_turbidity` decimal(10,2) DEFAULT NULL,
  `avg_nitrate` decimal(10,2) DEFAULT NULL,
  `avg_water_level` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sensor_data_hourly_avg`
--

DROP TABLE IF EXISTS `sensor_data_hourly_avg`;

CREATE TABLE `sensor_data_hourly_avg` (
  `id` int(11) NOT NULL,
  `hour_timestamp` datetime DEFAULT NULL,
  `trengginas_id` varchar(50) DEFAULT NULL,
  `avg_ph` decimal(10,2) DEFAULT NULL,
  `avg_cod` decimal(10,2) DEFAULT NULL,
  `avg_tss` decimal(10,2) DEFAULT NULL,
  `avg_ammonia` decimal(10,2) DEFAULT NULL,
  `avg_debit` decimal(10,2) DEFAULT NULL,
  `avg_temperature` decimal(10,2) DEFAULT NULL,
  `avg_do` decimal(10,2) DEFAULT NULL,
  `avg_bod` decimal(10,2) DEFAULT NULL,
  `avg_tds` decimal(10,2) DEFAULT NULL,
  `avg_turbidity` decimal(10,2) DEFAULT NULL,
  `avg_nitrate` decimal(10,2) DEFAULT NULL,
  `avg_water_level` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `serial_numbers`
--

DROP TABLE IF EXISTS `serial_numbers`;

CREATE TABLE `serial_numbers` (
  `id` int(11) NOT NULL,
  `serial_code` varchar(50) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_used` tinyint(1) DEFAULT 0,
  `machine_id` varchar(100) DEFAULT NULL,
  `used_by` varchar(100) DEFAULT NULL,
  `company_name` varchar(100) DEFAULT NULL,
  `used_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stations`
--

DROP TABLE IF EXISTS `stations`;

CREATE TABLE `stations` (
  `id` int(11) NOT NULL,
  `trengginas_id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `latitude` varchar(50) DEFAULT NULL,
  `longitude` varchar(50) DEFAULT NULL,
  `status` enum('active','inactive','maintenance') DEFAULT 'active',
  `last_active` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `visible_params` text DEFAULT NULL,
  `timezone` enum('WIB','WITA','WIT') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `station_thresholds`
--

DROP TABLE IF EXISTS `station_thresholds`;

CREATE TABLE `station_thresholds` (
  `id` int(11) NOT NULL,
  `trengginas_id` varchar(50) NOT NULL,
  `parameter` varchar(50) NOT NULL,
  `min_safe` decimal(10,2) DEFAULT NULL COMMENT 'Nilai minimum aman (>=)',
  `max_safe` decimal(10,2) DEFAULT NULL COMMENT 'Nilai maximum aman (<=)',
  `min_warning` decimal(10,2) DEFAULT NULL COMMENT 'Nilai minimum warning (>=)',
  `max_warning` decimal(10,2) DEFAULT NULL COMMENT 'Nilai maximum warning (<=)',
  `enabled` tinyint(1) DEFAULT 1 COMMENT '1 = Aktif, 0 = Non-aktif',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(30) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('superuser','admin','operator') NOT NULL,
  `assigned_station_id` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `sensor_data_2min_avg`
--
ALTER TABLE `sensor_data_2min_avg`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_data` (`trengginas_id`,`2min_timestamp`);

--
-- Indexes for table `sensor_data_daily_avg`
--
ALTER TABLE `sensor_data_daily_avg`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_data` (`trengginas_id`,`day_timestamp`);

--
-- Indexes for table `sensor_data_hourly_avg`
--
ALTER TABLE `sensor_data_hourly_avg`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_data` (`trengginas_id`,`hour_timestamp`);

--
-- Indexes for table `serial_numbers`
--
ALTER TABLE `serial_numbers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `serial_code` (`serial_code`);

--
-- Indexes for table `stations`
--
ALTER TABLE `stations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `trengginas_id` (`trengginas_id`);

--
-- Indexes for table `station_thresholds`
--
ALTER TABLE `station_thresholds`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_threshold` (`trengginas_id`,`parameter`),
  ADD KEY `idx_trengginas` (`trengginas_id`),
  ADD KEY `idx_parameter` (`parameter`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `sensor_data_2min_avg`
--
ALTER TABLE `sensor_data_2min_avg`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `sensor_data_daily_avg`
--
ALTER TABLE `sensor_data_daily_avg`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `sensor_data_hourly_avg`
--
ALTER TABLE `sensor_data_hourly_avg`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `serial_numbers`
--
ALTER TABLE `serial_numbers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `stations`
--
ALTER TABLE `stations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `station_thresholds`
--
ALTER TABLE `station_thresholds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
