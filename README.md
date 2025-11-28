# GesTalent Portal

Versión Node/Express + MongoDB del portal GesTalent con:

- Registro de candidatos + carga de CV (paso obligatorio).
- Evaluación inicial de competencias (solo para correos registrados).
- Cuestionario Big Five 132 (ítems desde Big_Five_132_GesTalent.xlsx).
- Panel interno con login (configurable en .env) para ver:
  - Candidatos.
  - Evaluaciones de competencias.
  - Resultados Big Five.

## Uso

1. Descomprimir el proyecto.
2. Copiar .env.example a .env y ajustar credenciales / URI de Mongo.
3. Ejecutar:

   npm install
   npm start

4. Rutas:

- Portal: http://localhost:4000/
- Evaluación competencias: http://localhost:4000/evaluacion.html
- Big Five 132: http://localhost:4000/bigfive.html
- Panel admin: http://localhost:4000/admin.html
