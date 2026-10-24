# Migración de SQLite a PostgreSQL con Docker

## Descripción

El backend de Vialtros fue configurado para utilizar PostgreSQL como base de datos dentro del entorno Docker.

La configuración de conexión se realiza mediante variables de entorno para evitar valores sensibles o configuraciones fijas dentro del código.

## Configuración

Antes de iniciar los contenedores, se debe crear el archivo `.env` a partir de `.env.example`.

En PowerShell:

```powershell
Copy-Item .env.example .env