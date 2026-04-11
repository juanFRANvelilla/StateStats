# State Stats

## Acerca de este proyecto

**State Stats** es una aplicación web **solo frontend** que muestra un **mapa interactivo de Estados Unidos** con datos **demográficos y socioeconómicos** por estado (censo ACS). El usuario puede explorar estados, seleccionarlos, comparar métricas y alternar vista lista / mapa; en móvil el mapa y el listado se adaptan con un panel inferior deslizable.

### Resumen del flujo de datos

1. **Geometrías (mapa)**  
   Los contornos de los estados se obtienen de un **GeoJSON** versionado en el repo (`assets/us-states.geojson`), cargado por HTTP desde el propio sitio.

2. **Datos demográficos**  
   El servicio `UsaStatesService` solicita a la **API del Census** el conjunto **ACS 5 años** (American Community Survey), dataset `2023/acs/acs5`, ámbito `state:*`, con variables como población total, renta mediana, pobreza, empleo, valor de vivienda, alquiler mediano, titulación universitaria y cobertura sanitaria (según los campos `B01…` configurados en la URL).

3. **Enriquecimiento en cliente**  
   La aplicación **combina** geometría y filas del censo en el navegador, colorea el mapa (coropletas), alimenta la lista de estados y el modal de comparación. **Turf** se usa para operaciones espaciales (intersecciones, diferencias, puntos en polígono, etc.) sobre las geometrías.

4. **Persistencia local**  
   Preferencias como estados seleccionados, modo de vista, polígonos dibujados o personalizados y vista del mapa se guardan en **`localStorage`** (`AppPersistenceService`), sin servidor.

---

## Frontend (aplicación Angular)

- **Stack**: **Angular 18** (standalone), **Angular Material**, **Bootstrap 5** + **Bootstrap Icons**, **OpenLayers** (mapa, capas tesela y vectoriales), **ol-ext** (p. ej. transformación de geometrías), **Turf.js**, **RxJS**, **TypeScript**.
- **Mapa**: capas base (p. ej. OSM / XYZ), estilos por datos, selección de estados, herramientas de dibujo y edición según la implementación en `usa-map`.
- **UI**: lista de estados con búsqueda y detalle, comparación entre estados (`CompareModalService`), diálogos Material, tema claro/oscuro (`ThemeService`), textos multiidioma (`LanguageService`).
- **API externa**: únicamente **HTTPS hacia `api.census.gov`**; es un servicio público y **no requiere API key** para el uso básico descrito en el código.

---

## Estructura del repositorio

```
demo-open-layers/    # nombre de carpeta local; paquete npm: state-stats
├── src/app/         # Componentes (mapa, listas, comparación, diálogos), servicios, modelos
├── src/assets/      # GeoJSON de estados y recursos estáticos
├── k8s/             # Chart Helm (Deployment, Service, Ingress, probes en /healthz)
├── Dockerfile       # Build multi-stage (Node → Nginx, puerto 8080)
└── Jenkinsfile      # CI (imagen publicada en Harbor, alineada con el chart)
```

---

## Instalación y comandos

| Requisito | Versión indicativa |
|-----------|-------------------|
| Node.js | Compatible con Angular 18 |
| npm | Incluido con Node |

```bash
npm install
npm start          # http://localhost:4200/
npm run build      # salida en dist/state-stats/browser/ (según builder de aplicación)
npm test           # tests unitarios
```

**Docker** (imagen local):

```bash
docker build -t state-stats:local .
```

**Helm** (ajusta `k8s/values.yaml` o `values-pro.yaml`: namespace, registry, host, cert-manager):

```bash
helm upgrade --install state-stats-front ./k8s -f k8s/values.yaml -n <namespace> --create-namespace
```

Detalles adicionales de despliegue (tags de imagen, `appVersion`, Jenkins/Kaniko) coinciden con lo documentado previamente en este repo: alinear el tag de la imagen con `Chart.yaml` o `--set` en CI.
