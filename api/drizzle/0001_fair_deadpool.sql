CREATE TABLE `periodo_cuota` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`periodo` varchar(7) NOT NULL,
	`dia_vencimiento` tinyint NOT NULL,
	`created_at` int NOT NULL,
	CONSTRAINT `periodo_cuota_id` PRIMARY KEY(`id`),
	CONSTRAINT `periodo_cuota_periodo_idx` UNIQUE(`periodo`)
);
