CREATE TABLE `socio_estado_historial` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`id_socio` int unsigned NOT NULL,
	`estado_anterior` varchar(20),
	`estado_nuevo` varchar(20) NOT NULL,
	`tipo_cuota_anterior` varchar(20),
	`tipo_cuota_nuevo` varchar(20) NOT NULL,
	`motivo` varchar(255),
	`fecha` int NOT NULL,
	`usuario_id` varchar(64),
	CONSTRAINT `socio_estado_historial_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `solicitud_becado` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`id_socio` int unsigned NOT NULL,
	`fecha_nacimiento` date NOT NULL,
	`estado` varchar(20) NOT NULL DEFAULT 'PENDIENTE',
	`fecha_solicitud` int NOT NULL,
	`fecha_resolucion` int,
	`usuario_id` varchar(64),
	CONSTRAINT `solicitud_becado_id` PRIMARY KEY(`id`),
	CONSTRAINT `solicitud_becado_unico_pendiente` UNIQUE(`id_socio`,`estado`)
);
--> statement-breakpoint
ALTER TABLE `socio` MODIFY COLUMN `estado` varchar(20) NOT NULL DEFAULT 'ACTIVO';--> statement-breakpoint
ALTER TABLE `socio` ADD `tipo_cuota` varchar(20) DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `socio` ADD `monto_cuota` int DEFAULT 15000 NOT NULL;--> statement-breakpoint
ALTER TABLE `socio` ADD `fecha_cambio_estado` date;--> statement-breakpoint
ALTER TABLE `socio` ADD `fecha_cambio_tipo_cuota` date;--> statement-breakpoint
ALTER TABLE `socio` ADD `motivo_cambio_tipo_cuota` varchar(255);--> statement-breakpoint
CREATE INDEX `socio_estado_historial_socio_idx` ON `socio_estado_historial` (`id_socio`);--> statement-breakpoint
CREATE INDEX `socio_estado_historial_fecha_idx` ON `socio_estado_historial` (`fecha`);--> statement-breakpoint
CREATE INDEX `solicitud_becado_socio_idx` ON `solicitud_becado` (`id_socio`);--> statement-breakpoint
CREATE INDEX `solicitud_becado_estado_idx` ON `solicitud_becado` (`estado`);--> statement-breakpoint
CREATE INDEX `socio_tipo_cuota_idx` ON `socio` (`tipo_cuota`);--> statement-breakpoint
CREATE INDEX `socio_estado_idx` ON `socio` (`estado`);