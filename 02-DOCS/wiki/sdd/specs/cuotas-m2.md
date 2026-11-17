---
title: Spec — Cuotas del período (M2)
type: sdd-spec
slug: cuotas-m2
status: implemented
branch: main
created: 2026-11-16
approved: 2026-11-16
implemented: 2026-11-16
---

# Spec — Cuotas del período (M2)

## Problem & why

M1 entregó el padrón de socios. Pero el club no cobra si no hay una cuota que
cobrar: hoy no existe la "cuota de noviembre" como entidad. El tesorero tiene
que recordar, fuera del sistema, cuánto vale la cuota del mes y quién la debe.
M2 define el período de cuota (monto y vencimiento) y deja calculable quién
debe y cuánto.

## Cost of not building it

Sin período de cuota no hay referencia para M3 (pagos): un pago no sabe a qué
mes ni a qué monto corresponde. La morosidad (M4) no tiene qué comparar. El
sistema se queda en un padrón sin cobranza.

## The cheapest alternative

Anotar el monto y el vencimiento en un campo de configuración y calcular la
deuda "a mano" en cada pantalla. Funciona para un mes, pero no deja historia
(no se sabe cuánto valía la cuota de marzo cuando en julio se revisa), y cada
módulo reimplementaría el mismo cálculo con riesgo de discrepar.

## Goals

- El tesorero crea un período de cuota (mes, vencimiento) y el sistema lo
  registra de forma única e historiable.
- Cada período tiene un monto por tipo de socio, tomado de los niveles de
  cuota (ACTIVO, MEMBRESIA, BECADO).
- Dado un período, el sistema calcula quién debe y cuánto: un socio activo
  debe si no tiene ese período cubierto por un pago.
- El tesorero ve los períodos creados y su estado (cuántos socios deben).

## Non-goals / out of scope

- Registro y aprobación de pagos (M3). M2 solo deja la deuda calculable.
- El estado de cuenta completo por socio (M4).
- Importación de cuotas históricas desde planillas (M5).
- Recordatorios por correo (M4/M5).
- Editar el monto de un período ya cerrado con pagos (se decide en M3).

## Users & context

El tesorero, con sesión iniciada, preparando la cobranza del mes: define cuánto
se paga y hasta cuándo, y ve a cuántos socios les toca pagar.

## What the user can do

Un usuario con sesión válida puede:

- Crear un período de cuota para un mes (AAAA-MM) con una fecha de vencimiento.
- Ver la lista de períodos creados y, para cada uno, cuántos socios deben.
- Ver, para un período, qué socios deben (RUT, nombre, tipo, monto) y cuáles
  ya lo tienen cubierto.

## What result they get

Al crear el período de noviembre, el sistema muestra cuántos socios activos
deben esa cuota y el monto que a cada uno le corresponde según su tipo. La
lista de períodos queda historiada, así en meses posteriores se sabe cuánto
valía cada cuota.

## What it must respect

- Los montos son enteros en CLP (constitución, principio 3).
- El período se identifica `AAAA-MM`, único (un solo período por mes).
- La deuda se deriva del padrón: socio activo sin pago para ese período debe;
  socio inactivo no debe (constitución, principio 15).
- El monto por tipo sale de `nivel_cuota`; no se duplica en el período.
- Toda ruta de cuotas exige sesión válida (constitución, principio 7).
- Un período no puede crearse dos veces para el mismo mes.

## How it proves it

Cada criterio de aceptación tiene comprobación ejecutable: peticiones reales
contra el sistema (crear período, duplicado, calcular deuda) y una suite de
tests automatizada (`npm test`). La evidencia queda en el documento de
verificación y en un script re-ejecutable.

## Behaviour

- **Principal:** el tesorero crea el período 2026-11 con vencimiento el día 10;
  el sistema lista los socios activos que deben y su monto.
- **Borde:** un período para un mes ya existente se rechaza; un período sin
  socios activos muestra deuda vacía.
- **Error:** período mal formado se rechaza; operación sin sesión se rechaza.

## Acceptance criteria

- **AC1** — Dado un usuario sin sesión, cuando consulta las cuotas, entonces
  recibe rechazo (no autorizado).
- **AC2** — Dado un período nuevo (AAAA-MM + vencimiento), cuando se crea,
  entonces queda registrado y aparece en la lista de períodos.
- **AC3** — Dado un período ya existente para el mismo mes, cuando se intenta
  crear de nuevo, entonces se rechaza.
- **AC4** — Dado un período y el padrón de socios, cuando se calcula la deuda,
  entonces lista solo los socios activos sin pago para ese período, cada uno
  con su monto según tipo.
- **AC5** — Dado un socio inactivo, cuando se calcula la deuda de un período,
  entonces no aparece en la lista.
- **AC6** — Dado un período mal formado (mes inválido), cuando se crea, entonces
  se rechaza.
- **AC7** — Dado un período y un socio con pago registrado para ese mes, cuando
  se calcula la deuda, entonces ese socio no aparece como deudor.

## Points to clarify

- **suposición tomada** — el monto de la cuota de un período se toma de
  `nivel_cuota` según el `estado` del socio (ACTIVO→nivel ACTIVO, MEMBRESIA→
  nivel MEMBRESIA, BECADO→nivel BECADO). *Base:* el esquema ya separa
  `nivel_cuota` ("cuánto paga cada tipo") del `socio.estado`. *Riesgo:* si el
  club quiere un monto distinto por mes aunque el nivel no cambie, habría que
  permitir sobrescribir el monto en el período.
- **suposición tomada** — el vencimiento se guarda como día del mes (1–31),
  no como fecha completa. *Base:* el plan dice "vencimiento el día 10".
  *Riesgo:* meses con menos días (febrero) necesitan validación de día válido.
- **decisión diferida** — cargar los montos reales de `nivel_cuota` (ACTIVO/
  MEMBRESIA/BECADO). Los valores se definen con la tesorería; M2 usa montos
  de prueba hasta M5.
- **área no formulable** — qué pasa cuando un socio cambia de tipo a mitad de
  período; sospecho que hay una pregunta y todavía no sé enunciarla.

## Revisions

_(append-only)_
