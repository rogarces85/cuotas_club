ALTER TABLE `pago` ADD COLUMN `updated_at` int NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `pago` SET `updated_at` = `created_at` WHERE `updated_at` = 0;
