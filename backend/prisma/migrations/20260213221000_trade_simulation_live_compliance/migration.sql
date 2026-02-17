-- Extend admin permission enum values
ALTER TABLE `admin_permission_grants`
  MODIFY `permission` ENUM(
    'USER_READ',
    'ORDER_READ',
    'WALLET_LEDGER_READ',
    'WITHDRAWAL_READ',
    'WITHDRAWAL_APPROVE',
    'WITHDRAWAL_REJECT',
    'WITHDRAWAL_BROADCAST',
    'WITHDRAWAL_CONFIRM',
    'WITHDRAWAL_FAIL',
    'BALANCE_ADJUST',
    'AUDIT_LOG_READ',
    'SUPPORT_TICKET_READ',
    'SUPPORT_TICKET_REPLY',
    'ADMIN_PERMISSION_READ',
    'ADMIN_PERMISSION_WRITE',
    'COMPLIANCE_APPROVE'
  ) NOT NULL;

-- Create trade_simulation_compliance_requests table
CREATE TABLE `trade_simulation_compliance_requests` (
  `id` VARCHAR(191) NOT NULL,
  `symbol` VARCHAR(191) NOT NULL,
  `requested_mode` VARCHAR(191) NOT NULL DEFAULT 'LIVE_MARKET',
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `requested_by_user_id` VARCHAR(191) NOT NULL,
  `requested_reason` TEXT NOT NULL,
  `reviewed_by_user_id` VARCHAR(191) NULL,
  `review_reason` TEXT NULL,
  `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewed_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `trade_simulation_compliance_requests_symbol_status_requested_at_idx`(`symbol`, `status`, `requested_at` DESC),
  INDEX `trade_simulation_compliance_requests_requested_by_user_id_requested_at_idx`(`requested_by_user_id`, `requested_at` DESC),
  INDEX `trade_simulation_compliance_requests_reviewed_by_user_id_reviewed_at_idx`(`reviewed_by_user_id`, `reviewed_at` DESC),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `trade_simulation_compliance_requests`
  ADD CONSTRAINT `trade_simulation_compliance_requests_symbol_fkey`
  FOREIGN KEY (`symbol`) REFERENCES `coin_listings`(`symbol`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `trade_simulation_compliance_requests`
  ADD CONSTRAINT `trade_simulation_compliance_requests_requested_by_user_id_fkey`
  FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `trade_simulation_compliance_requests`
  ADD CONSTRAINT `trade_simulation_compliance_requests_reviewed_by_user_id_fkey`
  FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Bootstrap compliance approval permission to existing admin users
INSERT INTO `admin_permission_grants` (`id`, `user_id`, `permission`, `granted_by_user_id`)
SELECT REPLACE(UUID(), '-', ''), u.`id`, 'COMPLIANCE_APPROVE', u.`id`
FROM `users` u
WHERE u.`role` = 'ADMIN'
  AND NOT EXISTS (
    SELECT 1
    FROM `admin_permission_grants` ap
    WHERE ap.`user_id` = u.`id`
      AND ap.`permission` = 'COMPLIANCE_APPROVE'
  );
