CREATE TABLE `categoria_egreso` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`nombre` varchar(80) NOT NULL,
	CONSTRAINT `categoria_egreso_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comprobante` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`id_pago` int unsigned NOT NULL,
	`ruta` varchar(255) NOT NULL,
	`mime` varchar(100) NOT NULL,
	`bytes` int unsigned NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`estado` varchar(30) NOT NULL DEFAULT 'PENDIENTE',
	`created_at` int NOT NULL,
	CONSTRAINT `comprobante_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cuenta_bancaria` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`banco` varchar(80) NOT NULL,
	`tipo` varchar(30) NOT NULL,
	`numero` varchar(40) NOT NULL,
	`titular` varchar(160) NOT NULL,
	`rut` varchar(12) NOT NULL,
	`email` varchar(255),
	`created_at` int NOT NULL,
	CONSTRAINT `cuenta_bancaria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `egreso` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`id_categoria` int unsigned,
	`fecha` date NOT NULL,
	`monto` int NOT NULL,
	`descripcion` varchar(255) NOT NULL,
	`boleta_ruta` varchar(255),
	`created_at` int NOT NULL,
	CONSTRAINT `egreso_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gasto_fijo` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`descripcion` varchar(160) NOT NULL,
	`monto` int NOT NULL,
	`periodicidad` varchar(30) NOT NULL,
	`activo` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `gasto_fijo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimiento_bancario` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`fecha` date NOT NULL,
	`monto` int NOT NULL,
	`descripcion` varchar(255) NOT NULL,
	`referencia` varchar(120),
	`created_at` int NOT NULL,
	CONSTRAINT `movimiento_bancario_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nivel_cuota` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`nombre` varchar(80) NOT NULL,
	`monto_clp` int NOT NULL,
	`tipo` varchar(20) NOT NULL,
	`activo` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `nivel_cuota_id` PRIMARY KEY(`id`),
	CONSTRAINT `nivel_cuota_codigo_idx` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `otro_ingreso` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`fecha` date NOT NULL,
	`monto` int NOT NULL,
	`descripcion` varchar(255) NOT NULL,
	`origen` varchar(60),
	`created_at` int NOT NULL,
	CONSTRAINT `otro_ingreso_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pago` (
	`id_pago` int unsigned AUTO_INCREMENT NOT NULL,
	`codigo_pago` varchar(30),
	`id_socio` int unsigned NOT NULL,
	`rut` varchar(12) NOT NULL,
	`nombre_snapshot` varchar(160) NOT NULL,
	`anio` smallint NOT NULL,
	`sexo` varchar(20),
	`estado` varchar(30) NOT NULL DEFAULT 'PENDIENTE',
	`situacion` varchar(30),
	`fecha_pago` date NOT NULL,
	`total_pago` int NOT NULL,
	`valor_cuota` int NOT NULL,
	`tipo_cuota` enum('ACTIVO','MEMBRESIA','BECADO','OTRO') NOT NULL,
	`meses_cantidad` int unsigned NOT NULL,
	`meses_detalle` varchar(120),
	`observacion` varchar(255),
	`origen` enum('manual','banco','historico') NOT NULL DEFAULT 'manual',
	`created_at` int NOT NULL,
	CONSTRAINT `pago_id_pago` PRIMARY KEY(`id_pago`)
);
--> statement-breakpoint
CREATE TABLE `pago_mes` (
	`id_pago_mes` int unsigned AUTO_INCREMENT NOT NULL,
	`id_pago` int unsigned NOT NULL,
	`id_socio` int unsigned NOT NULL,
	`rut` varchar(12) NOT NULL,
	`periodo` varchar(7) NOT NULL,
	`created_at` int NOT NULL,
	CONSTRAINT `pago_mes_id_pago_mes` PRIMARY KEY(`id_pago_mes`)
);
--> statement-breakpoint
CREATE TABLE `socio` (
	`id_socio` int unsigned AUTO_INCREMENT NOT NULL,
	`rut` varchar(12) NOT NULL,
	`nombre` varchar(160) NOT NULL,
	`anio` smallint NOT NULL,
	`sexo` varchar(20),
	`estado` varchar(30) NOT NULL DEFAULT 'ACTIVO',
	`activo` tinyint NOT NULL DEFAULT 1,
	`email` varchar(255),
	`telefono` varchar(30),
	`created_at` int NOT NULL,
	`updated_at` int NOT NULL,
	CONSTRAINT `socio_id_socio` PRIMARY KEY(`id_socio`),
	CONSTRAINT `socio_rut_idx` UNIQUE(`rut`)
);
--> statement-breakpoint
CREATE TABLE `usuario_rol` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`rol` enum('DIRECTIVA','TESORERO','SOCIO') NOT NULL,
	`created_at` int NOT NULL,
	CONSTRAINT `usuario_rol_id` PRIMARY KEY(`id`),
	CONSTRAINT `usuario_rol_user_idx` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scope` text,
	`password` text,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `egreso_fecha_idx` ON `egreso` (`fecha`);--> statement-breakpoint
CREATE INDEX `mov_bancario_fecha_idx` ON `movimiento_bancario` (`fecha`);--> statement-breakpoint
CREATE INDEX `pago_socio_idx` ON `pago` (`id_socio`);--> statement-breakpoint
CREATE INDEX `pago_rut_idx` ON `pago` (`rut`);--> statement-breakpoint
CREATE INDEX `pago_fecha_idx` ON `pago` (`fecha_pago`);--> statement-breakpoint
CREATE INDEX `pago_mes_pago_idx` ON `pago_mes` (`id_pago`);--> statement-breakpoint
CREATE INDEX `pago_mes_socio_periodo_idx` ON `pago_mes` (`id_socio`,`periodo`);--> statement-breakpoint
CREATE INDEX `socio_nombre_idx` ON `socio` (`nombre`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);