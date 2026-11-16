import { relations, sql } from "drizzle-orm";
import { mysqlTable, varchar, text, datetime, boolean, index } from "drizzle-orm/mysql-core";

// Tablas de autenticación de Better Auth.
//
// GENERADO con el generador oficial de Better Auth (scripts/generate-auth-schema.mjs),
// luego MODIFICADO a mano por compatibilidad con MariaDB 10.4:
//   - Las columnas de fecha usan `datetime` (no `timestamp`). MariaDB 10.4 con
//     explicit_defaults_for_timestamp=OFF rechaza varias columnas `timestamp`
//     combinadas con DEFAULT now(): ERROR 1067 "Invalid default value".
//     `datetime` no tiene ese comportamiento de auto-inicialización.
//   - Las relaciones usan `relations()` (API de drizzle-orm 0.45), no
//     `defineRelationsPart` (API de drizzle-orm 1.x que el generador asume).
//
// Si se regenera el esquema, volver a aplicar estas dos modificaciones.

export const user = mysqlTable("user", {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: datetime('created_at', { fsp: 3 }).default(sql`(CURRENT_TIMESTAMP(3))`).notNull(),
  updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`(CURRENT_TIMESTAMP(3))`).$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
});

export const session = mysqlTable("session", {
  id: varchar('id', { length: 36 }).primaryKey(),
  expiresAt: datetime('expires_at', { fsp: 3 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  createdAt: datetime('created_at', { fsp: 3 }).default(sql`(CURRENT_TIMESTAMP(3))`).notNull(),
  updatedAt: datetime('updated_at', { fsp: 3 }).$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index("session_userId_idx").on(table.userId),
]);

export const account = mysqlTable("account", {
  id: varchar('id', { length: 36 }).primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: datetime('access_token_expires_at', { fsp: 3 }),
  refreshTokenExpiresAt: datetime('refresh_token_expires_at', { fsp: 3 }),
  scope: text('scope'),
  password: text('password'),
  createdAt: datetime('created_at', { fsp: 3 }).default(sql`(CURRENT_TIMESTAMP(3))`).notNull(),
  updatedAt: datetime('updated_at', { fsp: 3 }).$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
}, (table) => [
  index("account_userId_idx").on(table.userId),
]);

export const verification = mysqlTable("verification", {
  id: varchar('id', { length: 36 }).primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(),
  value: text('value').notNull(),
  expiresAt: datetime('expires_at', { fsp: 3 }).notNull(),
  createdAt: datetime('created_at', { fsp: 3 }).default(sql`(CURRENT_TIMESTAMP(3))`).notNull(),
  updatedAt: datetime('updated_at', { fsp: 3 }).default(sql`(CURRENT_TIMESTAMP(3))`).$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
}, (table) => [
  index("verification_identifier_idx").on(table.identifier),
]);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
