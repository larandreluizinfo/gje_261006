# AGENTS — Regras obrigatórias para agentes

## 1. Commit + push obrigatório
- TODA alteração em arquivo (código, docs, config) DEVE ser commitada e pushada.
- Nunca deixe alterações apenas locais / sem commit / sem push.
- Ao final de qualquer tarefa que altere arquivos: rode `git status`, `git add`, `git commit` e `git push`.

## 2. Fluxo padrão
1. `git status` para ver o que mudou
2. `git add <arquivos>` (ou `git add -A` se for para incluir tudo intencionalmente)
3. `git commit -m "<tipo>: <descrição curta>"` (ex: `feat: adiciona página inicial`, `fix: corrige link`, `docs: atualiza README`)
4. `git push origin main` (ou `git push` se o upstream já estiver configurado)
5. Confirmar com `git status` que ficou tudo limpo (`nothing to commit, working tree clean`) e que o push foi aceito.

## 3. Regras
- Não faça `git push --force`, não altere histórico, não use `--no-verify` sem motivo.
- Não commite segredos (tokens, senhas, `.env` real). Use `.env.example` se precisar.
- Se `git push` falhar (ex: autenticação, remote ausente, branch protegida), NÃO encerre a tarefa como concluída: reporte o erro exato e o comando que falhou.
- Branch principal: `main`. Remote padrão: `origin`.
