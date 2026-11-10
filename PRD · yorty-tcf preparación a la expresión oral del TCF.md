# PRD · yorty-tcf: preparación a la expresión oral del TCF

Nov 8, 2026 · @Yorty

## Resumen y contexto

yorty-tcf pasa de ser un simulador de examen sin memoria a una plataforma multiusuario que convierte cada sesión de expresión oral del TCF en aprendizaje medible: evaluación CECRL por criterio, transcripción corregida, historial de progreso y modelo y API key elegidos por cada usuario.

**Estado actual** (repositorio privado `yorty-tcf-livekit`):

- Monorepo Turborepo + pnpm: Next.js 15 (`apps/web`), NestJS (`apps/api`) y tipos y schemas Zod compartidos (`packages/shared`).
- El examinador habla con el candidato mediante OpenAI Realtime por WebRTC directo desde el navegador (`@openai/agents`). La API solo emite el `client_secret` efímero con una única `OPENAI_API_KEY` del servidor.
- Cubre la expresión oral del TCF (tareas 1 a 3, ejercicios en SQLite generados desde un CSV) y las secciones A y B del TEF.
- No hay usuarios, no se guardan los intentos y hay un solo fichero de test.

**Por qué se rehace:** en el portafolio, este proyecto es el que demuestra voz en tiempo real, LLM multiproveedor, seguridad de secretos, evals y control de costes. Hoy solo demuestra la primera. Va segundo en el orden del portafolio porque reutiliza la autenticación y la plantilla de resubuild.

## Objetivos, no objetivos y métricas

**Objetivos**

1. Que un candidato pueda practicar la expresión oral del TCF (3 tareas, 12 minutos) y reciba al terminar un nivel CECRL estimado con comentarios por criterio.
2. Que cada usuario vea su progreso: historial de intentos, comparación entre intentos del mismo tema y panel por tarea.
3. Que cada usuario use su propia API key y su modelo, guardados de forma segura, sin cambiar el flujo WebRTC.
4. Que la calidad de la evaluación sea medible con evals frente a un corrector humano.

**No objetivos**

- Comprensión oral, comprensión escrita, expresión escrita y cualquier otra prueba del TCF.
- El TEF (se elimina).
- Emitir una nota oficial o presentarse como afiliado a France Éducation international.
- Pagos o planes de suscripción en esta versión.
- App móvil nativa.

**Métricas de éxito**

| Métrica | Objetivo | Cómo se mide |
| --- | --- | --- |
| Acuerdo de nivel con el corrector | ≥ 70 % de coincidencia exacta y ≥ 95 % a un nivel de distancia | Suite de evals sobre respuestas de nivel conocido |
| Tiempo hasta la evaluación | ≤ 30 s tras terminar la tarea | Traza entre fin de sesión y evaluación guardada |
| Fugas de API key | 0 respuestas que devuelvan la key al navegador | Test de API y revisión del bundle |
| Aislamiento entre usuarios | 0 accesos a intentos de otro usuario | Tests de autorización en CI |
| Coste registrado | 100 % de los intentos con minutos Realtime y tokens | Consulta sobre `exam_attempts` |
| Cobertura de la API | ≥ 80 % en Codecov | CI en cada PR |

Los umbrales de acuerdo son una propuesta inicial; se ajustan cuando exista la primera línea base de evals.

## Usuarios y casos de uso

**Usuario principal:** candidato al TCF (inmigración, nacionalidad o estudios) que quiere practicar la expresión oral con un examinador realista y saber en qué nivel está. **Usuario secundario:** quien revisa el portafolio (reclutador o entrevistador técnico), que debe entender el producto en 30 segundos desde el README o la demo.

| Caso de uso | Historia | Prioridad |
| --- | --- | --- |
| Examen completo | Como candidato, quiero hacer las 3 tareas seguidas con el tiempo oficial para simular el día del examen. | P0 |
| Práctica libre | Como candidato, quiero practicar una tarea concreta para trabajar mi punto débil. | P0 |
| Evaluación | Como candidato, quiero ver mi nivel CECRL estimado y comentarios por criterio al terminar cada tarea. | P0 |
| Transcripción corregida | Como candidato, quiero ver mis frases con los errores marcados y una versión mejorada al lado. | P0 |
| Cuenta y API key | Como usuario, quiero registrarme y usar mi propia API key y mi modelo. | P0 |
| Historial y progreso | Como candidato, quiero ver mis intentos anteriores y mi evolución por tarea. | P1 |
| Repetir un tema | Como candidato, quiero repetir un tema y comparar los dos intentos. | P1 |
| Grabación | Como candidato, quiero volver a escuchar mi respuesta, si doy permiso para grabarla. | P2 |
| Segundo proveedor de voz | Como usuario, quiero elegir Gemini Live en lugar de OpenAI Realtime. | P2 |

## Alcance: limpieza previa

Antes de añadir funciones, el repositorio se reduce a lo que el producto es: solo expresión oral del TCF, sin LiveKit ni TEF.

**Nombre.** Renombrar el repositorio en GitHub (la URL antigua redirige), el paquete `yorty-tcf-livekit` y el scope `@yorty-tcf`. Candidatos: `parle-tcf` (deja claro que es solo oral) o `prepa-tcf`. El README incluye una nota de que no es oficial ni está afiliado a France Éducation international.

**Quitar LiveKit.** El código ya no lo usa; quedan restos en:

- `packages/shared/src/messages.ts` (comentario sobre canales de datos)
- bloques de referencia de `apps/api/config/service.yml`
- `README.md`, `.github/README.md`, `AGENTS.md`, `SERVICE_CONFIG.md`, `CHANGELOG.md`
- los comandos de `.claude/`
- revisar si el gateway de Socket.io sigue haciendo falta; si no, eliminarlo

**Quitar el TEF.** Borrar:

- la ruta `app/(app)/tef`, `tef-app-config.ts` y los componentes `tef-*`
- `config/tef-exercices` y su copia en `public/`
- los scripts `generate-tef-*`, `sync-tef-to-web` y `rename-tef-images`
- los YAML `tef-section-*`
- las ramas TEF de `exercise.service.ts` y `exam-session.service.ts`
- después, actualizar `EXERCISES.md`

**Criterio de hecho:** `grep -riE "livekit|\btef\b"` no devuelve resultados fuera del CHANGELOG histórico, y el build y los tests pasan. (Sin `\b`, «tef» aparece dentro de «plateforme».)

## Requisitos funcionales

**RF1 · Modos de sesión**

- RF1.1 Examen completo: tareas 1, 2 y 3 seguidas, con los tiempos oficiales y un temporizador visible.
- RF1.2 Práctica libre: el usuario elige la tarea y el tema; sin límite estricto de tiempo, con el tiempo oficial como referencia.
- RF1.3 El examinador Realtime sigue el guion de cada tarea y cierra la tarea al agotarse el tiempo.

**RF2 · Banco de ejercicios**

- RF2.1 Los ejercicios se cargan desde el CSV actual con un script de seed idempotente.
- RF2.2 Ampliar el banco de las tareas 2 y 3 a partir del CSV.
- RF2.3 El usuario puede repetir un tema concreto.

**RF3 · Evaluación por tarea**

- RF3.1 Al terminar cada tarea, la transcripción pasa por una rúbrica CECRL y se guarda un nivel estimado (A1 a C2).
- RF3.2 Comentarios por criterio: adecuación a la tarea, coherencia, vocabulario, gramática y fluidez, cada uno con su nivel y una o dos frases de mejora.
- RF3.3 En el examen completo se muestra además una estimación global.
- RF3.4 Toda evaluación muestra un aviso de que es orientativa y no oficial.
- RF3.5 La salida del modelo se valida con un schema Zod; si no lo cumple, se reintenta.

**RF4 · Transcripción corregida**

- RF4.1 Vista en dos columnas: frases del candidato con los errores marcados por tipo, y versión mejorada al lado.
- RF4.2 Las intervenciones del examinador se distinguen de las del candidato.

**RF5 · Historial y progreso**

- RF5.1 Cada intento guarda modo, tarea, tema, transcripción, duración, evaluación, modelo usado y coste.
- RF5.2 Panel de progreso por tarea con la evolución del nivel en el tiempo.
- RF5.3 Comparación lado a lado de dos intentos del mismo tema.
- RF5.4 El usuario puede borrar un intento o toda su cuenta con sus datos.

**RF6 · Grabación de audio (P2)**

- RF6.1 Desactivada por defecto; se activa con consentimiento explícito.
- RF6.2 Si se evalúa la pronunciación, se hace a partir del audio y con un aviso de que es aproximada; la transcripción sola no la refleja.

**RF7 · Cuentas**

- RF7.1 Registro e inicio de sesión con email y OAuth mediante Better Auth en NestJS, reutilizando lo hecho en resubuild.
- RF7.2 Verificación de email y recuperación de contraseña.

**RF8 · Proveedor, modelo y API key por usuario**

- RF8.1 El usuario guarda su API key; nunca vuelve al navegador, ni siquiera enmascarada más allá de los últimos 4 caracteres.
- RF8.2 Configuración por usuario: modelo realtime y voz para el oral, modelo de texto para la corrección.
- RF8.3 Botón «probar conexión» que valida la key con una llamada mínima.
- RF8.4 La API descifra la key solo para pedir el `client_secret` efímero; el flujo WebRTC del navegador no cambia.
- RF8.5 Capa de proveedores: OpenAI Realtime en la primera versión, Gemini Live como segundo proveedor de voz, Vercel AI SDK para la corrección.

**RF9 · Límites de coste**

- RF9.1 Registrar minutos de Realtime y tokens por intento.
- RF9.2 Límites configurables por usuario (minutos al día o coste al mes); al alcanzarlos, la sesión no arranca y se explica por qué.

## Requisitos no funcionales

| Área | Requisito |
| --- | --- |
| Cifrado de secretos | API keys cifradas con AES-256-GCM, IV aleatorio por registro y la clave maestra fuera de la base de datos (variable de entorno o gestor de secretos). Rotación de la clave maestra posible sin perder datos. |
| Exposición de secretos | Ningún endpoint devuelve la key descifrada; los logs y Sentry la filtran. El navegador solo recibe el `client_secret` efímero. |
| Autorización | Cada consulta filtra por `userId`; un usuario nunca lee ni modifica intentos, transcripciones ni ajustes de otro. |
| Privacidad | Audio solo con consentimiento; borrado de cuenta elimina intentos, transcripciones, evaluaciones, audio y keys. Política de privacidad en la web. |
| Rendimiento | Evaluación disponible en ≤ 30 s tras terminar una tarea; la sesión de voz arranca en ≤ 3 s tras pulsar «empezar». |
| Resiliencia | Si la evaluación falla, el intento se guarda igualmente y la evaluación se puede relanzar. Si se corta el WebRTC, se guarda lo transcrito hasta ese momento. |
| Observabilidad | Logs estructurados y Sentry en web y API, con el coste por intento como atributo. |
| Accesibilidad | Navegación por teclado y contraste AA en las vistas de resultado e historial. |
| Idioma de la interfaz | Interfaz en francés; la evaluación y los comentarios también en francés. |
| Estándares del portafolio | README de 30 segundos con GIF, diagrama de arquitectura, demo o vídeo, `docker compose up`, `.env.example`, ADR, licencia y CHANGELOG. |

## Arquitectura y modelo de datos

Se mantiene el monorepo y el flujo de voz actual; lo nuevo es la capa de usuarios, la persistencia en PostgreSQL y el pipeline de evaluación posterior a cada tarea.

| Pieza | Tecnología | Cambio |
| --- | --- | --- |
| Web | Next.js 15 (`apps/web`) | Nuevas vistas: ajustes de proveedor, resultado, historial, comparación |
| API | NestJS (`apps/api`) | Módulos `auth`, `provider-settings`, `attempts`, `evaluation`, `usage` |
| Compartido | Zod (`packages/shared`) | Schemas de evaluación, intento y ajustes |
| Voz | OpenAI Realtime por WebRTC (`@openai/agents`) | Sin cambios en el navegador; el `client_secret` se pide con la key del usuario |
| Corrección | Vercel AI SDK + schema Zod | Nuevo |
| Base de datos | PostgreSQL + Drizzle | Sustituye a SQLite; reutiliza el paquete `db` de resubuild, que también usa Drizzle |
| Auth | Better Auth | Nuevo, reutilizado de resubuild |
| Audio (P2) | S3 compatible (R2 / MinIO) | Nuevo |

**Tablas**

| Tabla | Campos principales |
| --- | --- |
| `users` | id, email, nombre, creado (y las tablas propias de Better Auth: sesiones, cuentas, verificaciones) |
| `provider_settings` | user\_id, proveedor, api\_key\_cifrada, iv, auth\_tag, últimos 4, modelo\_realtime, voz, modelo\_texto, verificado\_en |
| `exercises` | id, tarea (1-3), tema, consigna, origen (fila del CSV) |
| `exam_attempts` | id, user\_id, modo, exercise\_id, empezado, terminado, duración\_s, proveedor, modelo, minutos\_realtime, tokens\_entrada, tokens\_salida, coste\_estimado, audio\_key |
| `transcripts` | id, attempt\_id, orden, hablante (examinador o candidato), texto, versión\_corregida, errores (JSON) |
| `evaluations` | id, attempt\_id, nivel\_global, niveles por criterio, comentarios (JSON), modelo\_corrector, versión\_rúbrica |

`exercises` se añade a las cinco tablas del plan para cargar el CSV en PostgreSQL. `versión_rúbrica` permite comparar evaluaciones hechas con rúbricas distintas.

## Calidad: evals y tests

**Evals de evaluación.** Un conjunto de transcripciones de ejemplo con nivel CECRL conocido (puntuadas por un corrector) se pasa por cada modelo de corrección. Se mide:

- coincidencia exacta de nivel y coincidencia a un nivel de distancia;
- acuerdo por criterio;
- estabilidad: la misma transcripción evaluada 5 veces debe dar el mismo nivel;
- coste y latencia por evaluación.

Los resultados se publican en el README como tabla por modelo y se ejecutan en CI cuando cambia la rúbrica o el prompt.

**Tests**

| Capa | Qué se prueba | Herramienta |
| --- | --- | --- |
| Cifrado | Ida y vuelta, IV distinto por registro, fallo con auth\_tag alterado, rotación de clave maestra | Jest |
| Autorización | Ningún usuario lee ni modifica intentos, transcripciones ni ajustes de otro | Jest + PostgreSQL en contenedor |
| Servicio de sesión | Emisión del `client_secret` con la key del usuario, límites de coste, key ausente o inválida | Jest con el proveedor simulado |
| Evaluación | Validación del schema, reintento ante salida inválida, guardado aunque falle | Jest |
| Seed | El script del CSV es idempotente | Jest |
| Extremo a extremo | Registro, configurar key, examen completo, ver resultado e historial | Playwright con la sesión realtime simulada |
| Bundle | Ninguna key ni cliente de proveedor con secreto en el bundle web | Test de build |

## Fases y criterios de aceptación

Cada fase termina con un criterio verificable antes de empezar la siguiente; la fase 0 es corta y desbloquea todo lo demás.

&#91;embedded content: hoja de ruta · 4 fases y sus criterios de aceptación\]

Las fases 0 a 2 forman la primera versión publicable; la fase 3 es lo que convierte el proyecto en una pieza fuerte de portafolio de IA.

## Riesgos y decisiones abiertas

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| La evaluación del LLM no coincide con un corrector | El usuario recibe un nivel engañoso | Evals con línea base, versión de rúbrica, aviso de que es orientativa |
| Pocas respuestas de ejemplo con nivel conocido | Evals poco fiables | Empezar con un conjunto pequeño y documentado; ampliarlo con cada fase |
| La transcripción de Realtime tiene errores propios | Se penalizan errores que el candidato no cometió | Mostrar la transcripción y advertir que proviene del reconocimiento de voz |
| Coste de Realtime alto en el examen completo | Facturas inesperadas para el usuario | Coste visible antes y después de la sesión, límites por usuario |
| Fuga de una API key | Pérdida de confianza y coste para el usuario | AES-256-GCM, clave maestra fuera de la base, tests de bundle y de logs |
| Diferencias entre proveedores de voz | Gemini Live no encaja en la abstracción | Diseñar la interfaz de proveedor con OpenAI y validar con Gemini antes de cerrarla |
| Confusión con el examen oficial | Riesgo de marca | Nombre no oficial y nota de no afiliación en README y web |

**Decisiones abiertas**

- [x] Nombre definitivo: `parle-tcf`.
- [x] El gateway de Socket.io se elimina; el estado de la evaluación se consulta por polling.
- [x] Idioma de la interfaz: solo francés.
- [ ] Quién hace de corrector para crear las respuestas de referencia de las evals.
- [ ] Valores de los límites de coste por defecto.
- [x] La grabación de audio se queda en P2.
