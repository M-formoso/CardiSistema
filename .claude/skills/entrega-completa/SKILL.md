---
name: entrega-completa
description: Regla obligatoria de ejecución para cualquier tarea de desarrollo en este proyecto. Úsala SIEMPRE que se pida crear, modificar o agregar una funcionalidad, componente, tool, skill, pantalla, endpoint, script o cualquier cambio de código o interfaz, aunque el usuario no lo mencione. Obliga a desarrollar la tarea de principio a fin, exactamente como fue ordenada, de forma realmente funcional y verificada, sin dejar código a medias, placeholders, stubs ni restos que ensucien el código o la interfaz.
---

# Entrega completa y funcional

## Principio central

Una tarea se **termina** o no se empieza. Nunca se entrega algo a medias.

El usuario no quiere código "en el aire": ni funciones sin conectar, ni botones que no hacen nada, ni pantallas vacías, ni TODOs, ni mocks que simulan funcionar. Todo lo que se agregue debe funcionar de verdad, de punta a punta, tal cual fue pedido.

## Antes de escribir código

1. **Entender la orden exacta.** Reformula internamente qué pidió el usuario, con sus palabras. Hacé exactamente eso: ni menos, ni algo distinto, ni extras no pedidos.
2. **Explorar el proyecto.** Leé los archivos, patrones, estilos y convenciones existentes antes de tocar nada. Reutilizá lo que ya existe en lugar de duplicar.
3. **Planificar completo.** Listá todos los archivos y pasos necesarios (lógica, UI, estado, rutas, datos, estilos, integración). Si el plan no cabe en una sola pasada, dividilo en pasos que, **cada uno, dejen el proyecto funcionando**.
4. **Si hay una duda real que cambia el resultado, preguntá antes de empezar.** Una pregunta clara al inicio es mejor que una suposición que deje todo mal. Si la duda es menor, asumí lo más razonable y dejalo escrito en el resumen final.
5. **Si la tarea no se puede completar** (falta una credencial, una dependencia, información o una decisión del usuario), **no la empieces a medias**. Decilo de entrada y explicá qué falta.

## Mientras desarrollás

- Implementá la funcionalidad **completa**, conectada de extremo a extremo (de la interfaz a la lógica y los datos, y de vuelta).
- **Prohibido dejar**:
  - `TODO`, `FIXME`, `// implementar luego`, `pass`, `throw new Error("not implemented")`.
  - Datos falsos, mocks o valores hardcodeados que simulen funcionar, salvo que el usuario lo pida explícitamente.
  - Funciones, componentes, archivos o estilos creados pero no usados.
  - Botones, menús, campos o secciones en la interfaz que no hagan nada.
  - Código comentado, `console.log` de depuración o archivos temporales.
- **Respetá el código existente.** Seguí el estilo, la estructura y las convenciones del proyecto. No refactorices ni reformatees lo que no tiene relación con la tarea.
- **No ensucies la interfaz.** No agregues elementos visuales, textos o secciones que el usuario no pidió. Lo nuevo debe verse integrado y coherente con el diseño actual.
- **Cubrí los casos reales**: estados de carga, errores, datos vacíos y entradas inválidas, de modo que la funcionalidad no se rompa en uso normal.
- **No amplíes el alcance.** Si ves algo adicional que convendría mejorar, anotalo en el resumen final como sugerencia; no lo implementes sin permiso.

## Antes de dar la tarea por terminada (verificación obligatoria)

No digas "listo" hasta cumplir todo esto:

1. **Ejecutá y probá** lo desarrollado: corré la app, los tests, el build, el linter y el chequeo de tipos que existan en el proyecto. Si es una interfaz, verificá que se renderice y que los flujos funcionen.
2. **Corregí todo error o warning** que hayas introducido. No entregues con errores pendientes.
3. **Revisá el diff completo** y eliminá todo resto: código muerto, imports sin usar, logs, archivos temporales, comentarios de prueba.
4. **Contrastá con la orden original**: confirmá punto por punto que lo pedido está hecho y funciona.
5. **Verificá que no rompiste nada existente.**

## Si algo falla o se complica

- No dejes el trabajo a medias ni lo maquilles. Seguí hasta resolverlo.
- Si es imposible completarlo, **revertí tus cambios parciales** para que el proyecto quede limpio y funcional, y explicá con claridad qué bloqueó la tarea y qué se necesita para continuar.
- **Nunca declares como terminado algo que no probaste o que no funciona.** Es preferible reportar honestamente un bloqueo que entregar algo roto.

## Reporte final

Al terminar, respondé de forma breve y concreta:

- **Qué se hizo** (archivos creados o modificados).
- **Cómo se verificó** (qué se ejecutó y qué resultado dio).
- **Suposiciones tomadas**, si las hubo.
- **Sugerencias opcionales**, sin haberlas implementado.

Si algo no quedó completo, debe decirse de forma explícita al principio del reporte.
