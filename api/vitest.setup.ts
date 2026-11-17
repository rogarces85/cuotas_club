/**
 * Setup de vitest: carga api/.env (dotenv) y apunta las pruebas de
 * integración a la base de descarte `osorno_runners_v2_test` ANTES de que se
 * importe el cliente de BD (cuyo singleton lee las variables al primer acceso).
 *
 * La base de prueba se migra por separado: `DB_NAME=osorno_runners_v2_test
 * npm run db:migrate -w api`.
 */
import 'dotenv/config';

process.env.DB_NAME = 'osorno_runners_v2_test';
