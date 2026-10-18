# hacksis-card-validator

SDK de navegador que extrae por OCR los datos del **frente de carnés universitarios PUCP** (diseño estandarizado). Todo se procesa localmente en el navegador, sin servicios externos de OCR.

> **El OCR no verifica la autenticidad del carné.** Un resultado `recognized` solo indica que los campos tienen un formato plausible y buena confianza de lectura. `flags.authenticityVerified` es siempre `false`.

## Estado

Las regiones de lectura están **calibradas con un único escaneo** y son provisionales. Valida con más carnés antes de usarlo en producción.

## Requisitos

- Navegador (usa Canvas, `document` y `File`). **No funciona en Node puro.**
- Conexión a internet en la primera lectura: Tesseract.js descarga su worker, el núcleo WASM y `spa.traineddata` desde un CDN.
- Imagen del carné **encuadrada al borde y sin inclinación** (escaneo o foto recortada). Mínimo 600×350 px.

---

## Integración en un proyecto host

### 1. Generar el paquete (en este repo)

```bash
npm install
npm run pack:local
```

Se crea `hacksis-card-validator-<versión>.tgz` en la raíz.

### 2. Instalarlo en el proyecto host

Copia el `.tgz` al repo host, por ejemplo en `vendor/`, haz commit para que todo el equipo lo tenga e instálalo:

```bash
npm install ./vendor/hacksis-card-validator-0.1.0.tgz
```

`tesseract.js` llega solo, porque es dependencia del SDK. El `package.json` del host quedará con algo como:

```json
"hacksis-card-validator": "file:vendor/hacksis-card-validator-0.1.0.tgz"
```

**Al actualizar el SDK, sube la versión** en su `package.json` (`0.1.1`, etc.). Si reemplazas el `.tgz` conservando el mismo nombre, el `package-lock.json` del host guarda el hash anterior y `npm install` falla con `EINTEGRITY`. Cuando haya varios consumidores, un registro privado (GitHub Packages, Verdaccio, etc.) es más cómodo que pasarse el archivo.

### 3. Ejecutarlo solo en el navegador

| Entorno del host | Qué hacer |
|---|---|
| SPA (Vite, React, Vue, Angular) | Funciona directamente. |
| Next.js, Nuxt u otro con SSR | Cargarlo solo en cliente (`"use client"` o `import()` dinámico dentro de un efecto). Si se importa en el servidor, falla. |
| Backend Node | No puede ejecutarlo. El OCR corre en el navegador y al servidor solo se envía `res.data`. |

### 4. Red y políticas de seguridad

Por defecto, Tesseract.js carga recursos externos. Si el host usa **CSP** o un firewall corporativo, hay que permitir:

- `cdn.jsdelivr.net` (worker y núcleo WASM)
- `tessdata.projectnaptha.com` (datos de idioma)
- Workers creados desde `blob:`

Verifica la lista exacta en la pestaña Red del navegador durante la primera lectura. Para funcionar **sin internet** hay que alojar esos archivos y pasar `workerPath`, `corePath` y `langPath` a `createWorker`. Hoy el SDK no expone esas opciones y habría que añadirlas a `CardValidatorParams`.

### 5. Configuración del proyecto host

- **Bundler moderno:** Vite o webpack 5 resuelven el ESM sin configuración extra.
- **TypeScript:** con `moduleResolution` en `Bundler`, `Node16` o `NodeNext` los tipos se resuelven por `exports`. Con el antiguo `"node"` también funciona, porque `package.json` declara `types`.
- Importa **solo** desde `"hacksis-card-validator"`. Los módulos internos no son accesibles.

### 6. Ejemplo en React

```tsx
import { useEffect, useRef } from "react";
import { CardValidatorOCR } from "hacksis-card-validator";

export function CardUpload() {
  // Una instancia por componente: el primer send() carga el motor, los demás lo reutilizan.
  const validatorRef = useRef<CardValidatorOCR | null>(null);
  if (!validatorRef.current) validatorRef.current = new CardValidatorOCR();

  // dispose() al desmontar, no después de cada lectura.
  useEffect(() => {
    const validator = validatorRef.current;
    return () => void validator?.dispose();
  }, []);

  async function onFileSelected(file: File) {
    const res = await validatorRef.current!
      .setFile(file)
      .setParams({ language: "spa", includeFieldDetails: true })
      .send();

    if (res.flags.hasError) {
      console.error(res.error);
    } else if (res.flags.recognized) {
      guardar(res.data);
    } else {
      pedirRevision(res.data, res.fieldsToReview);
    }
  }

  return (
    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void onFileSelected(f);
      }}
    />
  );
}
```

`guardar` y `pedirRevision` son funciones del host.

### Checklist para quien integra

1. Copiar el `.tgz` e instalarlo.
2. Importar solo desde `"hacksis-card-validator"`.
3. Ejecutarlo en cliente.
4. Permitir los dominios del CDN, o alojar los archivos de Tesseract.
5. Crear una instancia, reutilizarla y llamar a `dispose()` al terminar.
6. Gestionar `hasError`, `needsReview` y `unrecognized`.
7. Pedir al usuario una imagen encuadrada al borde del carné.
8. No tratar `recognized` como prueba de identidad.

### Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| `EINTEGRITY` al instalar | Se reemplazó el `.tgz` sin cambiar la versión. Sube la versión. |
| `document is not defined` / `window is not defined` | El SDK se importó en el servidor (SSR). Cárgalo solo en cliente. |
| Se queda en "Procesando…" y la consola muestra errores de red o CSP | El navegador no puede descargar los recursos de Tesseract. Revisa el punto 4. |
| Muchos campos en `needs_review` con fotos de celular | La foto está inclinada o con márgenes. Las regiones son fijas. |

---

## Uso

```ts
import { CardValidatorOCR } from "hacksis-card-validator";

const validator = new CardValidatorOCR();

const res = await validator
  .setFile(file)
  .setParams({ language: "spa", includeFieldDetails: true })
  .send();

if (res.flags.hasError) {
  console.error(res.error);
} else if (res.flags.recognized) {
  guardar(res.data);
} else {
  pedirRevision(res.data, res.fieldsToReview);
}

await validator.dispose(); // al dejar de usar el validador
```

Para una sola lectura:

```ts
import { validateCard } from "hacksis-card-validator";

const res = await validateCard(file, { includeFieldDetails: true });
```

### Comportamiento

- `send()` **nunca lanza excepciones**: los fallos llegan en `res.error` y `flags.hasError`.
- El motor OCR se crea en el primer `send()` y se reutiliza. Libéralo con `dispose()` al desmontar, no después de cada lectura.
- Las llamadas concurrentes se encolan.
- `setParams()` reemplaza los parámetros; los no indicados vuelven a su valor por defecto.

## Parámetros

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `language` | `string` | `"spa"` | Idioma de Tesseract (3 letras, p. ej. `"spa+eng"`). |
| `includeFieldDetails` | `boolean` | `false` | Añade `details` con estado y confianza por campo. |
| `includeRawText` | `boolean` | `false` | Añade el texto OCR sin procesar a cada detalle. |
| `includeCropImages` | `boolean` | `false` | Añade el recorte enviado al OCR (data URL PNG, pesado). |

## Respuesta

```ts
interface CardValidatorResponse {
  status: "recognized" | "needs_review" | "unrecognized" | "error";
  flags: {
    recognized: boolean;
    needsReview: boolean;
    unrecognized: boolean;
    hasError: boolean;
    authenticityVerified: false;
  };
  data: CardData;            // todas las claves; "" si no se leyó
  fieldsToReview: string[];  // campos que no están "ok"
  warnings: string[];
  error: { code: "NO_FILE" | "INVALID_PARAMS" | "PROCESSING_ERROR"; message: string } | null;
  details?: FieldDetail[];   // solo si se pidió
}
```

`data` siempre contiene todas las claves. Para saber si un valor es fiable, consulta `fieldsToReview`, no solo si está vacío.

### Campos

`title1`, `title2`, `low_title`, `university`, `code`, `dni`, `lastname1`, `lastname2`, `name`, `faculty`, `degree`, `admission_period`, `day_expiration`, `month_expiration`, `year_expiration`.

El código único impreso en el carné (relieve decorativo) **no se extrae**: Tesseract no lo lee de forma fiable.

### Estado de cada campo (`details[].state`)

| Estado | Significado |
|---|---|
| `ok` | Formato válido y confianza suficiente. |
| `low_confidence` | Formato válido, confianza baja. |
| `invalid` | Hay texto, pero no cumple el formato; el valor se descarta. |
| `not_detected` | El OCR no devolvió texto útil. |

La confianza es la de **cada región**, no la global.

### Criterio de `status`

Campos requeridos: `code`, `dni`, `lastname1`, `name`, `faculty`, `degree`, `admission_period`, `day_expiration`, `month_expiration`, `year_expiration`.

- `recognized`: todos los requeridos están en `ok`.
- `unrecognized`: menos del 50 % de los requeridos tienen un valor utilizable.
- `needs_review`: cualquier otro caso.
- `error`: la ejecución falló.

Los campos no requeridos solo generan advertencias.

## Limitaciones

- Las regiones son fijas: con inclinación, perspectiva o bordes visibles, los recortes se desalinean. Una futura rectificación con OpenCV.js lo resolvería.
- El orden de la fecha de expiración (día / mes / año, de arriba abajo) está **sin confirmar** con el emisor.
- El formato de `code` y `dni` (8 dígitos) se asumió a partir de un ejemplo.
- Los umbrales de confianza son provisionales.
- Sin red no funciona, salvo que se alojen los archivos de Tesseract (ver punto 4).

---

## Desarrollo del SDK

```bash
npm install
npm run typecheck   # comprobar tipos
npm run build       # dist/index.js + dist/types
npm run pack:local  # build + .tgz para instalar en otro proyecto
```

Solo `src/index.ts` es público (`exports` del `package.json`). `core/`, `ocr/`, `image/` y `extraction/` son internos.

### Probar cambios

Este repo no incluye página de prueba. Usa un proyecto sandbox que instale el `.tgz`, igual que el host real:

```bash
# en este repo
npm run pack:local

# en el sandbox
npm install ../hacksis-card-validator/hacksis-card-validator-0.1.0.tgz
```

Si cambias el SDK sin subir la versión, borra `node_modules/hacksis-card-validator` en el sandbox antes de reinstalar.

### Calibrar las regiones

Las regiones están en `src/ocr/regions.ts`, definidas en píxeles sobre una imagen de referencia (`REFERENCE_SIZE`) y convertidas a coordenadas normalizadas (0–1). Para recalibrar, mide las cajas en píxeles sobre un carné encuadrado, ajusta las llamadas a `box(left, top, right, bottom)` y valida con 5 a 10 carnés distintos.

## Seguridad

- Usa `textContent`, no `innerHTML`, para mostrar texto reconocido.
- No tomes `recognized` como prueba de identidad ni de autenticidad.
