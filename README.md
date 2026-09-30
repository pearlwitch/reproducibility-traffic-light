# Semáforo da Reprodutibilidade

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23043457.svg)](https://doi.org/10.5281/zenodo.23043457)

Triagem de reprodutibilidade de artigos científicos baseada nos princípios FAIR. Em cerca de cinco minutos, você descobre se um artigo oferece condições mínimas de verificação e reuso, antes de investir semanas construindo um projeto em cima dele.

**Experimente:** [link do artefato publicado](https://claude.ai/public/artifacts/6c37ec32-646a-4106-94da-116bfcce8cbe)

## Como funciona

A triagem tem dez perguntas, agrupadas em quatro blocos com pesos diferentes. Cada item é respondido como *sim* (1), *parcial* (0,5) ou *não* (0), multiplicado pelo seu peso. Itens marcados como não aplicáveis saem do cálculo.

| Bloco | Pergunta | Peso | FAIR |
| --- | --- | :---: | :---: |
| Dados | Os dados estão depositados em repositório público, com link que abre? | 3 | A |
| Dados | Os dados têm identificador persistente (DOI ou código de acesso)? | 3 | F |
| Dados | Há licença de uso declarada para os dados? | 2 | R |
| Dados | Os dados por trás das figuras principais estão disponíveis? | 3 | A |
| Código e ambiente | Os scripts ou o código de análise estão disponíveis? | 3 | R |
| Código e ambiente | As versões de software e dependências estão declaradas? | 2 | I |
| Método e protocolo | O método está completo o suficiente para repetir, ou há link para protocolo detalhado? | 2 | R |
| Método e protocolo | Há registro prévio do protocolo, quando aplicável? | 1 | F |
| Acesso e crédito | O artigo está acessível sem paywall (via OA ou preprint)? | 2 | A |
| Acesso e crédito | Os autores têm ORCID e o financiamento está declarado? | 1 | F |

Os dados pesam 11 dos 22 pontos possíveis, porque são o que de fato trava o reuso.

### Veredito

| Pontuação | Veredito | O que fazer |
| --- | --- | --- |
| 75% ou mais | Reprodutível | Cite o conjunto de dados pelo DOI próprio e siga. |
| 40% a 74% | Reprodutível em parte | Procure material suplementar, preprint e repositórios de terceiros antes de escrever ao autor. |
| Abaixo de 40% | Não verificável | Trate o artigo como referência conceitual; a ferramenta gera um pedido pronto ao autor correspondente. |

### Regras de avaliação

- **"Available upon request" conta como *não*.** A declaração dá aparência de abertura sem garantir acesso.
- **Acesso controlado conta como *parcial*.** Dados sensíveis com procedimento de solicitação documentado seguem boa prática; FAIR não é sinônimo de aberto.

## Papel da inteligência artificial

Um modelo de linguagem pode ler o artigo (PDF ou texto colado) e preencher um rascunho das dez respostas, exibindo para cada uma a justificativa e o trecho do artigo que a sustentou. **O veredito é sempre do avaliador humano**, que confirma ou corrige cada item. O relatório final registra a origem de cada resposta: IA confirmada, IA corrigida pelo avaliador, ou avaliador.

A ferramenta funciona integralmente em modo manual, sem a IA.

## Modos de uso

- **Avaliar um artigo:** triagem de artigo de terceiros antes de usá-lo como base de um projeto.
- **Avaliar meu manuscrito:** o mesmo checklist aplicado ao próprio trabalho, antes da submissão.

O relatório pode ser baixado em Markdown.

## Arquivos

- `semaforo-reprodutibilidade.jsx` — componente React com a ferramenta completa, sem dependências além do React.

## Como citar

Use o botão *Cite this repository* no GitHub ou os metadados em [`CITATION.cff`](CITATION.cff). 

## Licença

Código sob licença [MIT](LICENSE).

## Contexto

Produto digital do trabalho final da disciplina **Introdução à Ciência Aberta**, Fundação Oswaldo Cruz (Fiocruz), 2026.

## Referência

WILKINSON, M. D. et al. The FAIR Guiding Principles for scientific data management and stewardship. **Scientific Data**, London, v. 3, art. 160018, 2016. DOI: 10.1038/sdata.2016.18.
