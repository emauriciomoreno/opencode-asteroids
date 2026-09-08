---
description: Crea un git worktree en .worktrees/ con nombre derivado del argumento
---

Crea un git worktree siguiendo estas reglas exactas:

1. El usuario pasó este argumento (puede contener espacios o estar vacío):

$ARGUMENTS

2. Analiza el argumento y deriva el nombre del worktree en kebab-case:
   minúsculas, palabras separadas por guiones, sin espacios, sin acentos,
   solo letras y números. Basa el nombre únicamente en ese argumento.
3. Si el argumento está vacío, pregunta al usuario el nombre antes de continuar.
4. Ejecuta exactamente este comando, sustituyendo <nombre-del-worktree>
   por el nombre derivado:

   git worktree add ".worktrees/<nombre-del-worktree>"

Reglas estrictas:
- NO cambies de directorio de trabajo.
- NO hagas nada adicional: sin commits, sin checkout, sin editar archivos,
  sin abrir el worktree.
- Solo ejecuta el comando de creación y reporta el resultado.
