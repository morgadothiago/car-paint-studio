# Car Paint Studio

Aplicativo Electron para simular a pintura de um carro. Você envia fotos e vídeos, o app gera um modelo 3D, extrai a paleta de cores e deixa pintar a lataria com três tons (base, brilho máximo e sombra).

## Requisitos

- Node.js 20 ou mais novo
- macOS com Apple Silicon para a fotogrametria local (Object Capture). O resto roda em qualquer sistema.

## Como rodar

```
npm install
npm run build:native   # compila a ferramenta de fotogrametria (só macOS)
npm run dev
```

## Funcionalidades

- Modelo 3D por fotogrametria local (grátis, macOS) ou pela API da Meshy (paga, chave própria)
- Pintura com 3 tons, acabamentos e tolerância de cor, só na lataria
- Pincel de proteção em 3D para rodas, frisos e vidros
- Interior (bancos, painel, console, volante, portas, tapete), vista por dentro e raio-X
- Biblioteca local de modelos, com cache para não gastar créditos de novo
- Consulta de dados por placa (API Placas, token próprio) e tabela FIPE
- Base local de cores de fábrica, com importação por CSV (`data/cores-fabrica-br.csv`)

## Chaves de API

As chaves ficam salvas só no seu computador (`settings.json` na pasta de dados do app) e nunca vão para o repositório. No MCP da Meshy (`.mcp.json`), use a variável de ambiente `MESHY_API_KEY`.

## Dados de cores

Os hex em `data/cores-fabrica-br.csv` são estimativas (coluna `source = estimado`). Os fabricantes não publicam esses valores.
