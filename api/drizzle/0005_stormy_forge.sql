CREATE TABLE `felicitacion_cumpleanos` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`id_socio` int unsigned NOT NULL,
	`anio` smallint NOT NULL,
	`email` varchar(255) NOT NULL,
	`enviado_at` int NOT NULL,
	CONSTRAINT `felicitacion_cumpleanos_id` PRIMARY KEY(`id`),
	CONSTRAINT `felicitacion_socio_anio_idx` UNIQUE(`id_socio`,`anio`)
);
--> statement-breakpoint
CREATE INDEX `felicitacion_socio_idx` ON `felicitacion_cumpleanos` (`id_socio`);