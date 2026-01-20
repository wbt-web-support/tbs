-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 08, 2026 at 07:15 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `quote_builder_pro`
--

-- --------------------------------------------------------

--
-- Table structure for table `tbl_battery_storage_details_client`
--

CREATE TABLE `tbl_battery_storage_details_client` (
  `id` int(11) NOT NULL,
  `client_id` int(11) NOT NULL,
  `battery_storage_id` int(11) NOT NULL,
  `brand_id` int(11) NOT NULL,
  `battery_storage_title` varchar(265) NOT NULL,
  `power` varchar(50) NOT NULL,
  `warranty` varchar(50) NOT NULL,
  `base_price` varchar(550) NOT NULL,
  `height` varchar(50) NOT NULL,
  `width` varchar(50) NOT NULL,
  `depth` varchar(50) NOT NULL,
  `battery_storage_features` longtext NOT NULL,
  `additional_batteries` longtext DEFAULT NULL,
  `description` varchar(550) NOT NULL,
  `image` varchar(550) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Dumping data for table `tbl_battery_storage_details_client`
--

INSERT INTO `tbl_battery_storage_details_client` (`id`, `client_id`, `battery_storage_id`, `brand_id`, `battery_storage_title`, `power`, `warranty`, `base_price`, `height`, `width`, `depth`, `battery_storage_features`, `additional_batteries`, `description`, `image`, `created_at`, `updated_at`) VALUES
(23, 283, 9, 11, 'CM4100 ', '4.1', '10', '25000', '20', '10', '10', '4.03kWh Capacity.| Scalable to 28.21 kWh.| 90% Depth of Discharge| Wide Temperature Tolerance.', '[{\"name\":\"1 battery\",\"price\":\"100\"},{\"name\":\"2 battery\",\"price\":\"200\"}]', 'dummy', 'https://solar-images.b-cdn.net/BatteryStorage/CM4100.png', '2025-06-20 05:59:23', '2025-07-22 12:04:15'),
(27, 288, 9, 11, 'CM4100 ', '4.1', '10', '1125', '350', '570', '380', '4.03kWh Capacity.| Scalable to 28.21 kWh.| 90% Depth of Discharge| Wide Temperature Tolerance.', '[{\"name\":\"6kW hybird inverter\",\"price\":\"245.00\"},{\"name\":\"10.5kW hybird inverter\",\"price\":\"500.00\"}]', 'The FOX CM4100 is a 4.1kW Cube Master, which is required in the installation of a Fox Energy Cube Battery Storage System. ', 'https://solar-images.b-cdn.net/BatteryStorage/CM4100.png', '2025-07-17 11:48:29', '2025-10-08 07:02:41'),
(28, 283, 12, 11, 'ECS2800', '2.76', '10', '1125', '20', '10', '20', '4.03kWh Capacity.| Scalable to 28.21 kWh.| Wide Temperature Tolerance.| Easy Installation.', '[{\"name\":\"1 battery\",\"price\":\"100\"}]', 'dummy', 'https://solar-images.b-cdn.net/BatteryStorage/ECS2800.png', '2025-07-17 13:08:37', '2025-07-22 12:04:57'),
(30, 288, 16, 11, 'ECS4800', '4.66', '10', '1400', '386', '570', '380', '4.66kWh capacity.| Scalable to 32.61kWh.| 90% Depth of Discharge.| Large temperature tolerance.', '[{\"name\":\"6kW hybird inverter\",\"price\":\"500.00\"},{\"name\":\"10.5kW hybird inverter\",\"price\":\"802.00\"}]', 'dummy', 'https://solar-images.b-cdn.net/BatteryStorage/ECS4800.png', '2025-09-11 06:34:36', '2025-10-08 07:03:19');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tbl_battery_storage_details_client`
--
ALTER TABLE `tbl_battery_storage_details_client`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tbl_battery_storage_details_client`
--
ALTER TABLE `tbl_battery_storage_details_client`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
