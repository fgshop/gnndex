-- Create coin_listings table
CREATE TABLE `coin_listings` (
  `id` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(191) NOT NULL,
  `base_asset` VARCHAR(191) NOT NULL,
  `quote_asset` VARCHAR(191) NOT NULL,
  `chart_source` VARCHAR(32) NOT NULL DEFAULT 'BINANCE',
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `coin_listings_symbol_key`(`symbol`),
  INDEX `coin_listings_is_active_display_order_symbol_idx`(`is_active`, `display_order`, `symbol`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create internal_candles table
CREATE TABLE `internal_candles` (
  `id` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(191) NOT NULL,
  `interval` VARCHAR(32) NOT NULL,
  `open_time` DATETIME(3) NOT NULL,
  `close_time` DATETIME(3) NOT NULL,
  `open` DECIMAL(36, 18) NOT NULL,
  `high` DECIMAL(36, 18) NOT NULL,
  `low` DECIMAL(36, 18) NOT NULL,
  `close` DECIMAL(36, 18) NOT NULL,
  `volume` DECIMAL(36, 18) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `internal_candles_unique_symbol_interval_open_time`(`symbol`, `interval`, `open_time`),
  INDEX `internal_candles_symbol_interval_open_time_idx`(`symbol`, `interval`, `open_time` DESC),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key
ALTER TABLE `internal_candles`
  ADD CONSTRAINT `internal_candles_symbol_fkey`
  FOREIGN KEY (`symbol`) REFERENCES `coin_listings`(`symbol`)
  ON DELETE CASCADE ON UPDATE CASCADE;
