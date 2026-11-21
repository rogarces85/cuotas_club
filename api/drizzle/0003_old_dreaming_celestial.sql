CREATE TABLE `config_club` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`clave` varchar(60) NOT NULL,
	`valor` varchar(500),
	`created_at` int NOT NULL,
	`updated_at` int NOT NULL,
	CONSTRAINT `config_club_id` PRIMARY KEY(`id`),
	CONSTRAINT `config_club_clave_idx` UNIQUE(`clave`)
);
--> statement-breakpoint
CREATE TABLE `logo_club` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`ruta` varchar(255) NOT NULL,
	`mime` varchar(100) NOT NULL,
	`bytes` int unsigned NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`activo` tinyint NOT NULL DEFAULT 1,
	`created_at` int NOT NULL,
	CONSTRAINT `logo_club_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `pago` MODIFY COLUMN `updated_at` int NOT NULL;--> statement-breakpoint
ALTER TABLE `categoria_egreso` ADD `created_at` int NOT NULL;--> statement-breakpoint
ALTER TABLE `comprobante` ADD `nombre_archivo` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `gasto_fijo` ADD `created_at` int NOT NULL;