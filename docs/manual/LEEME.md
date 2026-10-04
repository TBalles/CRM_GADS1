# Manual de usuario: cómo está hecho y cómo se regenera

El entregable es [`docs/Manual-de-usuario-Tuco-y-Nito.pdf`](../Manual-de-usuario-Tuco-y-Nito.pdf) (A4, para el
personal del proveedor). Todo lo que lo arma vive acá y en `scripts/manual/`, y se regenera con un comando.

```bash
npm run manual            # capturas + PDF
npm run manual:capturas   # solo las capturas (necesita la app andando y credenciales)
npm run manual:pdf        # solo el PDF (no necesita la app ni internet, salvo la primera vez por las fuentes)
```

## Qué hay

| Ruta | Qué es |
|---|---|
| `manual.html` | La tapa, el índice y el hueco `<!--#capitulos-->`. |
| `capitulos/NN-*.html` | Un archivo por capítulo (22 capítulos y 3 apéndices). Se incluyen en orden de nombre. |
| `manual.css` | La hoja de estilos de impresión: A4, tokens de la app, encabezado y pie como márgenes de página. |
| `capturas/` | Las capturas (PNG, o JPEG q85 si el PNG pasa de ~260 KB). Se commitean. |
| `pendientes.json` | Las figuras que no se pudieron capturar la última vez y por qué. |
| `fuentes/` | Varela Round, Plus Jakarta Sans y JetBrains Mono, guardadas para generar sin conexión. Licencia SIL OFL 1.1: el texto está en [`fuentes/OFL.txt`](./fuentes/OFL.txt) (los avisos de copyright de cada familia están en el repositorio de Google Fonts, ver la nota de ese archivo). |
| `../../scripts/manual/figuras.mjs` | La lista de figuras: cómo se llega a cada pantalla y qué tiene que haber en ella. |
| `../../scripts/manual/capturas.mjs` | Saca las capturas con Playwright. |
| `../../scripts/manual/generar.mjs` | Arma el PDF. |
| `_manual.generado.html` | Intermedio que arma `generar.mjs` (ignorado por git). |

## Las capturas

```bash
MANUAL_BASE_URL=http://localhost:3000 \
MANUAL_EMAIL=… MANUAL_PASSWORD=… \
MANUAL_EMAIL_VENDEDOR=… MANUAL_PASSWORD_VENDEDOR=… \
npm run manual:capturas
# opcionales: MANUAL_EMAIL_SUPERADMIN / MANUAL_PASSWORD_SUPERADMIN, y --solo=login,tablero
```

- Las credenciales **solo** se pasan por entorno; no se escriben en ningún archivo (el repositorio es público).
  La cuenta de demostración y su contraseña están en el comentario de `supabase/seeds/demo_catedra.sql`.
- Tema claro, 1440 × 900 (390 de ancho en las de celular), horario y locale de Argentina.
- **Solo navegación**: se abren formularios para fotografiarlos y se cierran; no se guarda, crea, envía ni borra nada.
- El script oculta dos cosas que no son de la pantalla: el indicador de Next en desarrollo y los avisos
  «Se activa al aplicar la migración…».
- Qué pasa con lo que no está: cada figura tiene un `esperar` (un texto o un elemento que prueba que la pantalla es la
  de verdad). Si no aparece, la figura queda en `pendientes.json` con su motivo y el PDF muestra el recuadro
  **«Captura pendiente»**. La próxima corrida, con la pantalla disponible, la llena sola.

### Qué hace falta para completar las pendientes

| Figuras | Qué falta |
|---|---|
| Canchas, licitación, recambio en 1 clic, presupuesto guardado | **Ya capturadas** (base migrada y demo del rubro cargada). Para rehacerlas en otra base: `supabase/aplicar/aplicar_0008_a_0012.sql` y `supabase/seeds/demo_rubro.sql` (o `npm run demo:rubro` si no hay SQL Editor) |
| Botones de IA | `ANTHROPIC_API_KEY` en el `.env` de la app (y reiniciarla) |
| Panel de plataforma | `MANUAL_EMAIL_SUPERADMIN` y `MANUAL_PASSWORD_SUPERADMIN` |

## El PDF

Los marcadores del PDF se corrigen al final con `scripts/manual/outline.py` (necesita Python con `pymupdf`; si no está, `generar.mjs` avisa y deja el PDF igual, con el índice y las páginas intactos pero algún título de marcador sin su espacio).

`generar.mjs` completa la matriz de permisos y la tabla de pantallas **leyendo `src/lib/permisos.ts` y
`src/lib/navegacion.ts`** (siempre coinciden con la aplicación), pone cada captura a una escala común (1178 px de
contenido = 170 mm) y arma el índice con los **números de página reales**: imprime cada capítulo por separado, suma
sus páginas y, al final, comprueba que la suma coincide con las páginas del PDF completo (si no, falla).

Para agregar una figura: sumá su entrada en `scripts/manual/figuras.mjs` y un
`<figure data-fig="id"><figcaption>Texto</figcaption></figure>` en el capítulo. `npm test` verifica que las dos
listas coincidan (`src/lib/manual.check.ts`).
