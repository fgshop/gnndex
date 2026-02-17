-- Create trade_simulation_configs table
CREATE TABLE `trade_simulation_configs` (
  `id` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(191) NOT NULL,
  `feature` VARCHAR(191) NOT NULL DEFAULT 'test-trade-simulator',
  `is_enabled` BOOLEAN NOT NULL DEFAULT false,
  `interval_pool` JSON NOT NULL,
  `mode` VARCHAR(191) NOT NULL DEFAULT 'SIMULATION_ONLY',
  `next_run_at` DATETIME(3) NULL,
  `last_run_at` DATETIME(3) NULL,
  `run_count` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `trade_simulation_configs_symbol_key`(`symbol`),
  INDEX `trade_simulation_configs_is_enabled_next_run_at_idx`(`is_enabled`, `next_run_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create trade_simulation_logs table
CREATE TABLE `trade_simulation_logs` (
  `id` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(191) NOT NULL,
  `selected_interval_min` INTEGER NOT NULL,
  `scheduled_at` DATETIME(3) NOT NULL,
  `executed_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'SIMULATED',
  `message` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `trade_simulation_logs_symbol_created_at_idx`(`symbol`, `created_at` DESC),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign keys
ALTER TABLE `trade_simulation_configs`
  ADD CONSTRAINT `trade_simulation_configs_symbol_fkey`
  FOREIGN KEY (`symbol`) REFERENCES `coin_listings`(`symbol`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `trade_simulation_logs`
  ADD CONSTRAINT `trade_simulation_logs_symbol_fkey`
  FOREIGN KEY (`symbol`) REFERENCES `trade_simulation_configs`(`symbol`)
  ON DELETE CASCADE ON UPDATE CASCADE;
