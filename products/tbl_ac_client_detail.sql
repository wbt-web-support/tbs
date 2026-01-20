-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 08, 2026 at 07:14 AM
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
-- Table structure for table `tbl_ac_client_detail`
--

CREATE TABLE `tbl_ac_client_detail` (
  `id` int(11) NOT NULL,
  `client_id` bigint(20) NOT NULL,
  `pro_ac_id` bigint(20) NOT NULL,
  `pro_ac_brand_id` bigint(20) NOT NULL,
  `pro_ac_title` varchar(150) NOT NULL,
  `pro_ac_subtitle` varchar(150) NOT NULL,
  `pro_base_price` varchar(150) NOT NULL,
  `pro_ac_width` varchar(50) NOT NULL,
  `pro_ac_height` varchar(50) NOT NULL,
  `pro_ac_depth` varchar(50) NOT NULL,
  `pro_warranty` varchar(50) NOT NULL,
  `pro_cooling_power` varchar(50) NOT NULL,
  `pro_heating_power` varchar(50) NOT NULL,
  `pro_ac_features` longtext NOT NULL,
  `pro_image` varchar(256) NOT NULL,
  `pro_subimage` varchar(256) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Dumping data for table `tbl_ac_client_detail`
--

INSERT INTO `tbl_ac_client_detail` (`id`, `client_id`, `pro_ac_id`, `pro_ac_brand_id`, `pro_ac_title`, `pro_ac_subtitle`, `pro_base_price`, `pro_ac_width`, `pro_ac_height`, `pro_ac_depth`, `pro_warranty`, `pro_cooling_power`, `pro_heating_power`, `pro_ac_features`, `pro_image`, `pro_subimage`, `created_at`, `updated_at`) VALUES
(2, 288, 4, 5, 'Mitsubishi Electric AY - MSZ-AY25VGK', 'Mitsubishi Electric AY - MSZ-AY25VGK', '2000.00', '798', '299', '245', '5', '2.50', '2.80', 'test', 'https://aircon-images.b-cdn.net/Mitsubishi-Electric-AY-MSZ-AY25VGK.png', '', '2026-01-07 11:26:57', '2026-01-07 12:35:09'),
(3, 288, 5, 3, 'Toshiba Hoari - RAS-B10N4KVRG-E', 'Our Unique and Efficient solution for bedrooms and small areas.', '2000.00', '300', '987', '210', '2', '2.50', '3.20', 'test', 'https://aircon-images.b-cdn.net/Toshiba-Hoari-RAS-B10N4KVRG-E.png', '', '2026-01-07 11:30:34', '2026-01-07 11:30:44');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tbl_ac_client_detail`
--
ALTER TABLE `tbl_ac_client_detail`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tbl_ac_client_detail`
--
ALTER TABLE `tbl_ac_client_detail`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
