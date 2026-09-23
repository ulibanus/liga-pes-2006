# Guía de Contribución — Regional T

¡Gracias por tu interés en colaborar con Regional T! Este documento establece las pautas y estándares técnicos necesarios para mantener la calidad, coherencia y seguridad del proyecto.

---

## 1. Antes de Escribir Código: Issue-Driven Development

Para evitar esfuerzos innecesarios o implementaciones que no se alineen con la visión y arquitectura del proyecto, seguimos un flujo guiado por issues:

- **Nueva funcionalidad o cambio arquitectónico:** Es obligatorio abrir un **Issue** previamente para discutir el problema, la justificación técnica y el diseño propuesto. Una vez alineados, se procede con la implementación.
- **Corrección de errores (Bugs):** Abre un issue describiendo los pasos para reproducir el fallo y el comportamiento esperado.
- **Cambios triviales:** Correcciones menores de redacción o errores tipográficos en la documentación pueden enviarse directamente mediante Pull Request sin necesidad de issue previo.

---

## 2. Cómo Empezar (Entorno Local)

Cualquier persona sin acceso de escritura directo al repositorio debe utilizar el modelo **Fork & Pull Request**:

1. **Haz un Fork** del repositorio a tu cuenta personal de GitHub haciendo clic en el botón "Fork" arriba a la derecha.
2. **Clona tu fork** localmente:
   ```bash
   git clone https://github.com/TU-USUARIO/liga-pes-2006.git
   cd liga-pes-2006
   ```
3. **Agrega el repositorio original** como `upstream` para mantenerte actualizado:
   ```bash
   git remote add upstream https://github.com/mateoAlonso06/liga-pes-2006.git
   ```
4. **Instala las dependencias** desde la raíz del proyecto (usamos npm workspaces):
   ```bash
   npm install
   ```
5. **Configura el backend** (base de datos local):
   ```bash
   cp api/.env.example api/.env
   # Edita api/.env y asigna un password en ADMIN_PASSWORD. Luego inicializa la BD:
   npm run db:init --prefix api
   ```
6. **Inicia el entorno de desarrollo** en terminales separadas:
   ```bash
   npm run dev --prefix api          # Levanta el backend en el puerto 3000
   npm run dev --prefix frontend/client # Levanta el frontend en el puerto 5173
   ```

---

## 3. Estrategia de Ramas (GitHub Flow)

El desarrollo se organiza bajo el modelo **GitHub Flow**, manteniendo `main` como rama principal y estable:

1. Crea siempre una nueva rama a partir de `main` actualizado:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <tipo>/<descripcion-corta>
   ```
2. Utiliza prefijos semánticos para nombrar ramas:
   - `feat/nombre-funcionalidad`: Nueva característica.
   - `fix/descripcion-bug`: Corrección de un fallo existente.
   - `refactor/modulo-afectado`: Reestructuración de código sin alterar su comportamiento externo.
   - `test/suite-afectada`: Incorporación o mejora de pruebas.
   - `chore/tarea-mantenimiento`: Actualización de dependencias, scripts o configuración.

---

## 4. Alcance y Tamaño de los Pull Requests (Atomic PRs)

Aplicamos el principio de **Responsabilidad Única (SRP)** a las contribuciones:

- **Un solo propósito:** Un Pull Request debe resolver un único problema o introducir una única funcionalidad. No mezcles refactorizaciones cosméticas, cambios de dependencias y lógica de negocio en la misma solicitud.
- **Tamaño recomendado:** Entre **200 y 400 líneas de código modificadas** como límite orientativo (excluyendo archivos generados o bloqueos de dependencias). Los PRs pequeños facilitan la revisión, aceleran el merge y minimizan los conflictos de integración.
- **Vinculación con el Issue:** Incluye en la descripción del PR la referencia correspondiente (por ejemplo: `Closes #12`).

---

## 5. Estándares Técnicos y Arquitectura

### Frontend: Dominio Desacoplado (Clean Architecture)
- Toda la lógica de negocio, cálculos de tablas, sorteos, fixtures y reglas de validación reside exclusivamente en funciones puras dentro de `frontend/client/src/domain/`.
- El código dentro de `domain/` **no debe importar React, hooks, estado de UI ni elementos del DOM**. Debe ser determinista y testeable de forma inmediata con el ejecutor nativo de pruebas (`node --test`).
- La capa de presentación (`components/`) y la capa de integración (`hooks/`) deben delegar las operaciones de cálculo al dominio.

### Backend: Consistencia y Persistencia
- Las rutas REST deben ubicarse en `api/src/routes/` y mantenerse agrupadas por recurso o entidad.
- Las consultas a la base de datos deben realizarse mediante el cliente de LibSQL (`@libsql/client`), empleando siempre **sentencias parametrizadas** para evitar vulnerabilidades de inyección SQL.

---

## 6. Seguridad y Gestión de Secretos

- **Prohibido subir credenciales:** Nunca confirmes archivos `.env`, tokens JWT, llaves privadas ni bases de datos con datos reales en el control de versiones.
- **Variables de entorno:** Si una nueva funcionalidad requiere una variable de entorno adicional, agrégala con un valor ficticio o descriptivo en `api/.env.example`.
- **Validación de entradas:** Toda ruta de la API que reciba información del usuario o cliente debe validar y sanear los tipos de datos recibidos antes de operar sobre ellos.

---

## 7. Estándar de Commits

Todos los mensajes de confirmación deben seguir la especificación de **Conventional Commits**:

```text
<tipo>(<alcance-opcional>): <descripción concisa en imperativo>
```

Ejemplos:
- `feat(torneos): add support for single elimination playoffs`
- `fix(proposals): prevent submitting negative goals`
- `test(domain): add unit test for standings tie-breaker rule`
- `refactor(api): extract auth verification middleware`

> ⚠️ **Atribución de código:** No incluyas líneas de atribución automática como `Co-Authored-By` ni referencias generadas por herramientas automatizadas de asistencia en los commits.

---

## 8. Criterios de Calidad (Definition of Done)

Antes de solicitar la revisión de tu Pull Request, asegúrate de que todos los siguientes pasos se cumplan localmente:

1. **Suite de pruebas en verde:**
   ```bash
   npm test
   ```
   Todas las pruebas unitarias y de integración existentes deben pasar sin excepciones.
2. **Nuevas pruebas:** Si agregas o modificas una regla de negocio en el dominio o un nuevo endpoint en el backend, debes incluir sus pruebas correspondientes.
3. **Análisis estático:**
   ```bash
   npm run lint
   ```
   No debe haber advertencias ni errores reportados por ESLint.
4. **Compilación estricta:**
   ```bash
   npm run build
   ```
   TypeScript debe compilar sin discrepancias de tipos.

---

## 9. Checklist del Contribuidor

Antes de marcar tu Pull Request como listo para revisión:

- [ ] Creé mi rama desde `main` actualizado con el prefijo correcto.
- [ ] La PR atiende o vincula un Issue previamente acordado (salvo cambios triviales).
- [ ] El cambio se limita a un único propósito y respeta el tamaño sugerido.
- [ ] No se incluyen secretos, contraseñas ni archivos `.env`.
- [ ] Las consultas a base de datos utilizan sentencias parametrizadas.
- [ ] Toda nueva regla de dominio cuenta con pruebas unitarias en `src/domain/`.
- [ ] Ejecuté `npm test`, `npm run lint` y `npm run build` con resultado exitoso.
- [ ] Mis commits utilizan la convención Conventional Commits sin etiquetas de co-autoría.
