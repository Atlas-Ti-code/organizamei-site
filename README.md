# OrganizaMEI

Seu negócio organizado. Suas decisões mais claras.

## Como abrir
Abra o `index.html` no navegador (duplo clique). Não precisa instalar nada.
A fonte vem do Google Fonts; sem internet, o navegador usa uma fonte do sistema.

## Arquivos
- `index.html`: estrutura das telas (Início, Lançamentos, Categorias, Relatórios, Dicas, Configurações)
- `style.css`: identidade visual, tema escuro/claro e layout responsivo
- `script.js`: dados, cálculos, gráficos (SVG feito à mão) e navegação

## Como funciona
Os lançamentos ficam salvos no `localStorage` do navegador.
Fluxo: você lança → o sistema calcula (entradas, saídas, resultado, margem) → o dashboard atualiza.
Os dados de exemplo ficam no topo do `script.js` (SEED_MES_ATUAL e SEED_HISTORICO), já dentro do teto do MEI (R$ 81 mil/ano).
