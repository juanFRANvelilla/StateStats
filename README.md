# StateStats

Mapa interactivo de Estados Unidos con datos demográficos (Angular + OpenLayers).

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.8.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/state-stats/` directory.

## Docker

Imagen multi-stage (Node Chainguard → build Angular, Nginx Chainguard → estáticos en el puerto **8080**, `/healthz` para probes).

```bash
docker build -t state-stats:local .
```

## Kubernetes (Helm)

Misma estructura que el front de ZgzEmergencyMap: chart en `k8s/` con `Deployment`, `Service`, `Ingress`, volúmenes tmpfs para nginx y probes HTTP en `/healthz`.

La imagen que despliega el chart es `{{ registry }}/state-stats:{{ appVersion }}` (coincide con el `Jenkinsfile`: `harbor.server.local/danielbeltejar/state-stats`). Ajusta `appVersion` en `k8s/Chart.yaml` o usa `--set` / `--set-string` en CI para el tag del build.

Ajusta `k8s/values.yaml` o `k8s/values-pro.yaml` (namespace, `registry`, host del Ingress, issuers de cert-manager) y despliega:

```bash
helm upgrade --install state-stats-front ./k8s -f k8s/values.yaml -n <namespace> --create-namespace
# Producción:
# helm upgrade --install state-stats-front ./k8s -f k8s/values-pro.yaml -n <namespace>
```

**Jenkins / Kaniko**: el `Jenkinsfile` publica en Harbor con el nombre `danielbeltejar/state-stats`; alinea el tag con el que use Helm (`appVersion` en `Chart.yaml` o `--set` en CI).

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
