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
-- Table structure for table `tbl_solar_details_client`
--

CREATE TABLE `tbl_solar_details_client` (
  `id` int(11) NOT NULL,
  `Client_id` int(11) DEFAULT NULL,
  `solar_id` int(11) DEFAULT NULL,
  `brand_id` int(11) DEFAULT NULL,
  `solar_main_title` varchar(550) DEFAULT NULL,
  `solar_cost` varchar(550) DEFAULT NULL,
  `most_popular_checked` varchar(50) DEFAULT NULL,
  `solar_description` varchar(550) DEFAULT NULL,
  `solarProperties` longtext DEFAULT NULL,
  `warranty` varchar(50) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `solar_image` varchar(550) DEFAULT NULL,
  `currency` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Dumping data for table `tbl_solar_details_client`
--

INSERT INTO `tbl_solar_details_client` (`id`, `Client_id`, `solar_id`, `brand_id`, `solar_main_title`, `solar_cost`, `most_popular_checked`, `solar_description`, `solarProperties`, `warranty`, `quantity`, `solar_image`, `currency`, `created_at`, `updated_at`) VALUES
(4, 266, 3, 2, 'Neostar 2S', '95', NULL, 'Global Leading Solar Manufacters, Our most cost effective option, offering excellent performance at a great price point.', 'Partial shading optimization.|High temperature restriction and micro-crack resistance.|Front grid free, ensuring roof safety, reducing module failure rate.|Efficiency: up to 23.6%.', '25', 1, 'https://solar-images.b-cdn.net/Trina/VertexN-550W.png', NULL, '2025-01-13 11:22:16', '2025-01-13 11:22:16'),
(5, 266, 2, 2, 'Neostar 2S', '86.8', NULL, 'Aiko Neostar 2S ABC N-Type Full Black Glass-Folie Module carries High power output, High efficiency and optimized Balance of system (BOS)', 'Partial shading optimization.|High temperature restriction and micro-crack resistance.|Front grid free, ensuring roof safety, reducing module failure rate.|Efficiency: up to 23.6%.', '25', 1, 'https://solar-images.b-cdn.net/Aiko/AikoNeostar2S-445W.png', NULL, '2025-01-13 11:24:48', '2025-01-13 11:24:48'),
(6, 266, 11, 3, 'Vertex N', '95', 'Yes', 'Global Leading Solar Manufacters, Our most cost effective option, offering excellent performance at a great price point.', 'Designed for compatibility with existing mainstream system components.|Lower temperature coefficient (-0.30%) and operating temperature.|Greenhouse Gases Emissions Verification.|High reliability.', '25', 1, 'https://solar-images.b-cdn.net/Trina/VertexN-550W.png', '$', '2025-01-14 06:16:26', '2025-01-14 07:22:08');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tbl_solar_details_client`
--
ALTER TABLE `tbl_solar_details_client`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tbl_solar_details_client`
--
ALTER TABLE `tbl_solar_details_client`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
