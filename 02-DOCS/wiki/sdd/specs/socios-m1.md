---
title: Spec — Administración de socios (M1)
type: sdd-spec
slug: socios-m1
status: approved
branch: main
created: 2026-11-16
approved: 2026-11-16
---

# Spec — Administración de socios (M1)

## Problem & why

El sistema arranca, autentica y muestra el panel del club, pero no tiene datos
que administrar: el padrón de socios vive todavía en una planilla y en una base
legada que nadie edita desde el sistema. Sin un módulo de socios no hay a quién
asignarle una cuota (M2), registrarle un pago (M3) ni cobrarle (M4). M1 entrega
el padrón administrable dentro del sistema.

## Cost of not building it

El padrón queda fuera del sistema y cada módulo siguiente (cuotas, pagos,
morosidad) no tiene entidad de referencia. La directiva vuelve a la planilla
para saber quién es socio y el sistema de cobro nunca arranca de verdad.

## The cheapest alternative

Seguir con la planilla de Excel. No resuelve nada: no se busca, no se filtra,
no alimenta cuotas ni pagos, y el error humano (RUT mal escrito, duplicados)
se repite. Es justamente lo que el sistema viene a reemplazar.

## Goals

- Un socio se registra, se busca y se edita desde el sistema.
- El RUT identifica unívocamente a cada socio, normalizado.
- Dar de baja un socio no borra su historial: queda inactivo.
- El padrón es consultable por la directiva con sesión iniciada.

## Non-goals / out of scope

- Importación de los 54 socios reales (M5, en el PC de casa).
- Categorías de cuota y montos por tipo (M2).
- Historial de pagos del socio en su ficha (M3/M4).
- Roles por operación (quién es tesorero): el control fino es del módulo de
  usuarios y roles. M1 exige solo sesión válida.
- Edición de la identidad de acceso (cuenta de login) de un socio.

## Users & context

La directiva (presidente, tesorero) con sesión iniciada, administrando el
padrón del club para poder cobrar cuotas.

## What the user can do

Cualquier usuario con sesión válida puede:

- Ver la lista de socios y buscarlos por RUT o nombre.
- Filtrar por estado y por situación activo/inactivo.
- Dar de alta un socio con sus datos (RUT, nombre, año, sexo, estado,
  email, teléfono).
- Editar esos datos.
- Dar de baja a un socio (lo deja inactivo, sin borrarlo).

## What result they get

Una tabla del padrón con, por socio: RUT (con formato legible), nombre, año,
estado y situación activo/inactivo, con acciones de editar y dar de baja. El
alta y la edición se hacen desde un formulario con validación inmediata; un RUT
duplicado o mal formado se rechaza con un mensaje claro.

## What it must respect

- El RUT se guarda normalizado (sin puntos ni guion, dígito verificador en
  mayúscula) y es único (constitución, principio 4).
- La baja es lógica, nunca borrado físico (constitución, principio 15).
- Ninguna operación del padrón responde sin sesión válida (constitución,
  principio 7).
- Los montos no intervienen aquí, pero cuando aparezcan son enteros en CLP
  (constitución, principio 3).
- El formulario y el servidor validan con la misma regla (constitución,
  principio 2).

## How it proves it

Cada criterio de aceptación tiene una comprobación ejecutable cuyo resultado
queda registrado: peticiones reales contra el sistema en marcha (crear,
buscar, editar, dar de baja, duplicar, RUT inválido, sin sesión) y una prueba
en navegador real de la pantalla de socios. La evidencia (salida de cada
comprobación) se guarda en el documento de verificación.

## Behaviour

- **Principal:** un socio se crea, aparece en la lista, se busca por RUT o
  nombre, se edita y se da de baja (queda inactivo).
- **Borde:** búsqueda sin resultados muestra un estado vacío; paginación
  cuando el padrón excede una página.
- **Error:** RUT duplicado se rechaza; RUT mal formado se rechaza; operación
  sin sesión se rechaza; dar de baja a un socio ya inactivo se rechaza.

## Acceptance criteria

- **AC1** — Dado un usuario sin sesión, cuando consulta el padrón, entonces
  recibe rechazo (no autorizado) y no ve datos.
- **AC2** — Dado un socio nuevo con RUT normalizado, cuando se da de alta,
  entonces queda en el padrón y aparece en la lista.
- **AC3** — Dado un RUT ya existente, cuando se intenta dar de alta, entonces
  el alta se rechaza con un mensaje claro.
- **AC4** — Dado un RUT mal formado, cuando se intenta guardar (alta o
  edición), entonces se rechaza con un mensaje claro.
- **AC5** — Dada una búsqueda por fragmento de RUT o nombre, cuando se ejecuta,
  entonces devuelve solo los socios que coinciden.
- **AC6** — Dado un socio, cuando se da de baja, entonces queda marcado
  inactivo y su registro sigue existiendo.
- **AC7** — Dado un socio ya inactivo, cuando se intenta dar de baja otra vez,
  entonces la operación se rechaza.

## Points to clarify

- **decisión diferida** — control de rol por operación (escritura reservada a
  tesorero/directiva). Fuera de M1; pertenece al módulo de usuarios y roles.
- **suposición tomada** — la lista admite paginación de 25 por página. *Base:*
  el padrón tiene 54 socios; una página única alcanza hoy, pero el criterio no
  depende de eso. *Riesgo:* si el club crece mucho, el tamaño de página se
  vuelve una decisión de producto.

## Revisions

_(append-only)_
