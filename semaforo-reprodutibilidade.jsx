import React, { useState, useMemo, useRef } from "react";

const BLOCOS = [
  {
    id: "dados",
    nome: "Dados",
    resumo: "O que mais trava o reuso. Vale peso 3 por item.",
    itens: [
      { id: "d1", peso: 3, texto: "Os dados estão depositados em repositório público, com link que abre?" },
      { id: "d2", peso: 3, texto: "Os dados têm identificador persistente (DOI ou código de acesso)?" },
      { id: "d3", peso: 2, texto: "Há licença de uso declarada para os dados?" },
      { id: "d4", peso: 3, texto: "Os dados por trás das figuras principais estão disponíveis?" },
    ],
  },
  {
    id: "codigo",
    nome: "Código e ambiente",
    resumo: "Sem isso, a análise não é repetível mesmo com os dados em mãos.",
    itens: [
      { id: "c1", peso: 3, texto: "Os scripts ou o código de análise estão disponíveis?" },
      { id: "c2", peso: 2, texto: "As versões de software e dependências estão declaradas?" },
    ],
  },
  {
    id: "metodo",
    nome: "Método e protocolo",
    resumo: "A parte narrativa da reprodutibilidade.",
    itens: [
      { id: "m1", peso: 2, texto: "O método está completo o suficiente para repetir, ou há link para protocolo detalhado?" },
      { id: "m2", peso: 1, texto: "Há registro prévio do protocolo, quando aplicável?", permiteNA: true },
    ],
  },
  {
    id: "acesso",
    nome: "Acesso e crédito",
    resumo: "Não afeta a reprodução em si, mas afeta quem consegue tentar.",
    itens: [
      { id: "a1", peso: 2, texto: "O artigo está acessível sem paywall (via OA ou preprint)?" },
      { id: "a2", peso: 1, texto: "Os autores têm ORCID e o financiamento está declarado?" },
    ],
  },
];

const TODOS_ITENS = BLOCOS.flatMap((b) => b.itens.map((i) => ({ ...i, bloco: b.id })));

const VALOR = { sim: 1, parcial: 0.5, nao: 0 };
const ROTULO = { sim: "Sim", parcial: "Parcial", nao: "Não", na: "N/A" };

function corDoVeredito(pct) {
  if (pct === null) return "#5C6B66";
  if (pct >= 75) return "#2E7D57";
  if (pct >= 40) return "#C08419";
  return "#A8323C";
}

function nomeDoVeredito(pct) {
  if (pct === null) return "Sem avaliação";
  if (pct >= 75) return "Reprodutível";
  if (pct >= 40) return "Reprodutível em parte";
  return "Não verificável";
}

export default function SemaforoReprodutibilidade() {
  const [modo, setModo] = useState("terceiro");
  const [aba, setAba] = useState("texto");
  const [texto, setTexto] = useState("");
  const [pdf, setPdf] = useState(null);
  const [referencia, setReferencia] = useState("");
  const [respostas, setRespostas] = useState({});
  const [analise, setAnalise] = useState({});
  const [editados, setEditados] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState({});
  const inputArquivo = useRef(null);

  const respondidos = TODOS_ITENS.filter((i) => respostas[i.id]);
  const validos = respondidos.filter((i) => respostas[i.id] !== "na");

  const pontuacao = useMemo(() => {
    if (validos.length === 0) return null;
    const max = validos.reduce((s, i) => s + i.peso, 0);
    const obtido = validos.reduce((s, i) => s + i.peso * VALOR[respostas[i.id]], 0);
    return Math.round((obtido / max) * 100);
  }, [respostas, validos]);

  const porBloco = useMemo(
    () =>
      BLOCOS.map((b) => {
        const itens = b.itens.filter((i) => respostas[i.id] && respostas[i.id] !== "na");
        if (itens.length === 0) return { ...b, pct: null };
        const max = itens.reduce((s, i) => s + i.peso, 0);
        const obtido = itens.reduce((s, i) => s + i.peso * VALOR[respostas[i.id]], 0);
        return { ...b, pct: Math.round((obtido / max) * 100) };
      }),
    [respostas]
  );

  const faltando = TODOS_ITENS.filter((i) => respostas[i.id] === "nao" || respostas[i.id] === "parcial");

  function responder(id, valor) {
    setRespostas((r) => ({ ...r, [id]: valor }));
    if (analise[id] && analise[id].resposta !== valor) {
      setEditados((e) => ({ ...e, [id]: true }));
    } else {
      setEditados((e) => ({ ...e, [id]: false }));
    }
  }

  async function lerPdfBase64(arquivo) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = () => rej(new Error("Falha ao ler o arquivo"));
      r.readAsDataURL(arquivo);
    });
  }

  async function chamarLote(itens, conteudoBase) {
    const lista = itens
      .map((i) => `- id "${i.id}": ${i.texto}${i.permiteNA ? " (use \"na\" se o desenho do estudo não comporta registro prévio)" : ""}`)
      .join("\n");

    const instrucao = `Você avalia a reprodutibilidade de um artigo científico. Procure ativamente pelas seções de disponibilidade de dados, disponibilidade de código, materiais suplementares, agradecimentos e financiamento — elas costumam ficar no fim do texto e são decisivas.

Responda cada item abaixo:
${lista}

Regras:
- "sim" apenas quando há evidência explícita no texto. "Available upon request" NÃO é "sim", é "nao".
- "parcial" quando há menção incompleta, link sem identificador, ou disponibilidade condicionada.
- "nao" quando não há menção ou o acesso é restrito.
- Se a informação simplesmente não aparece no material fornecido, use "nao" e diga isso na justificativa.

Devolva SOMENTE um array JSON, sem markdown, sem crases, sem texto antes ou depois. Formato exato:
[{"id":"...","resposta":"sim|parcial|nao|na","justificativa":"até 20 palavras","trecho":"citação curta do artigo, até 15 palavras, ou vazio"}]`;

    const content = [...conteudoBase, { type: "text", text: instrucao }];

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await resp.json();
    const bruto = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    const inicio = bruto.indexOf("[");
    const fim = bruto.lastIndexOf("]");
    return JSON.parse(bruto.slice(inicio, fim + 1));
  }

  async function analisar() {
    setErro("");
    if (aba === "texto" && texto.trim().length < 200) {
      setErro("Cole ao menos alguns parágrafos do artigo, incluindo o fim do texto.");
      return;
    }
    if (aba === "pdf" && !pdf) {
      setErro("Escolha um arquivo PDF.");
      return;
    }

    setCarregando(true);
    try {
      let conteudoBase;
      if (aba === "pdf") {
        setProgresso("Lendo o PDF");
        const b64 = await lerPdfBase64(pdf);
        conteudoBase = [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
        ];
      } else {
        conteudoBase = [{ type: "text", text: `Artigo avaliado:\n\n${texto}` }];
      }

      const lote1 = TODOS_ITENS.slice(0, 5);
      const lote2 = TODOS_ITENS.slice(5);

      setProgresso("Verificando dados e código");
      const r1 = await chamarLote(lote1, conteudoBase);
      setProgresso("Verificando método, acesso e crédito");
      const r2 = await chamarLote(lote2, conteudoBase);

      const mapa = {};
      const novas = {};
      [...r1, ...r2].forEach((r) => {
        if (!TODOS_ITENS.some((i) => i.id === r.id)) return;
        mapa[r.id] = r;
        novas[r.id] = r.resposta;
      });

      setAnalise(mapa);
      setRespostas((atual) => ({ ...atual, ...novas }));
      setEditados({});
      setAberto(Object.fromEntries(Object.keys(mapa).map((k) => [k, true])));
    } catch (e) {
      setErro("A análise não chegou até o fim. Tente de novo, ou responda os itens manualmente — o checklist funciona sem a IA.");
    } finally {
      setCarregando(false);
      setProgresso("");
    }
  }

  function limpar() {
    setRespostas({});
    setAnalise({});
    setEditados({});
    setAberto({});
    setErro("");
  }

  const emailAutor = `Assunto: Acesso aos dados de ${referencia || "[referência do artigo]"}

Prezado(a) autor(a) correspondente,

Li com interesse o artigo ${referencia || "[referência]"} e pretendo usá-lo como base para uma investigação em andamento.

Não localizei ${faltando.length > 0 ? faltando.slice(0, 3).map((f) => f.texto.replace(/\?$/, "").toLowerCase()).join("; ") : "os materiais necessários para reprodução"}.

Seria possível disponibilizar esse material, ainda que sob acordo de uso? Tenho interesse em depositá-lo citando a autoria original, caso haja concordância.

Agradeço a atenção,
[seu nome] — [instituição] — [ORCID]`;

  function gerarRelatorio() {
    const linhas = [];
    linhas.push(`# Semáforo da Reprodutibilidade`);
    linhas.push("");
    linhas.push(`**Artigo avaliado:** ${referencia || "não informado"}`);
    linhas.push(`**Modo:** ${modo === "terceiro" ? "avaliação de artigo de terceiros" : "autoavaliação de manuscrito"}`);
    linhas.push(`**Data:** ${new Date().toLocaleDateString("pt-BR")}`);
    linhas.push(`**Veredito:** ${nomeDoVeredito(pontuacao)} — ${pontuacao === null ? "sem itens respondidos" : pontuacao + "%"}`);
    linhas.push(`**Itens respondidos:** ${respondidos.length} de ${TODOS_ITENS.length}`);
    linhas.push("");
    BLOCOS.forEach((b) => {
      const bl = porBloco.find((x) => x.id === b.id);
      linhas.push(`## ${b.nome}${bl.pct !== null ? ` — ${bl.pct}%` : ""}`);
      linhas.push("");
      linhas.push("| Item | Peso | Resposta | Origem | Justificativa |");
      linhas.push("| --- | --- | --- | --- | --- |");
      b.itens.forEach((i) => {
        const r = respostas[i.id];
        const origem = !analise[i.id] ? "avaliador" : editados[i.id] ? "IA, corrigida pelo avaliador" : "IA, confirmada";
        const just = analise[i.id] ? analise[i.id].justificativa.replace(/\|/g, "/") : "—";
        linhas.push(`| ${i.texto.replace(/\|/g, "/")} | ${i.peso} | ${r ? ROTULO[r] : "não respondido"} | ${r ? origem : "—"} | ${just} |`);
      });
      linhas.push("");
    });
    if (faltando.length > 0) {
      linhas.push("## O que está faltando");
      linhas.push("");
      faltando.forEach((f) => linhas.push(`- ${f.texto.replace(/\?$/, "")}`));
      linhas.push("");
    }
    linhas.push("---");
    linhas.push("");
    linhas.push("Relatório gerado com o Semáforo da Reprodutibilidade. As respostas sugeridas por modelo de linguagem foram revisadas por avaliador humano antes da emissão.");
    return linhas.join("\n");
  }

  function baixarRelatorio() {
    const blob = new Blob([gerarRelatorio()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-reprodutibilidade.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const cor = corDoVeredito(pontuacao);

  return (
    <div className="raiz">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

        .raiz {
          --tinta: #12302A;
          --papel: #EEF1F0;
          --papel-alto: #F8FAF9;
          --linha: #C9D3CF;
          --suave: #5C6B66;
          --acento: #1F5E52;
          background: var(--papel);
          color: var(--tinta);
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          min-height: 100%;
          padding: 28px 22px 56px;
          line-height: 1.5;
        }
        .raiz * { box-sizing: border-box; }

        .cabeca { max-width: 1120px; margin: 0 auto 26px; }
        .titulo {
          font-family: 'Newsreader', Georgia, serif;
          font-size: clamp(30px, 4.4vw, 46px);
          font-weight: 500;
          line-height: 1.05;
          letter-spacing: -0.015em;
          margin: 0 0 10px;
        }
        .subtitulo {
          max-width: 62ch;
          color: var(--suave);
          font-size: 15px;
          margin: 0 0 18px;
        }

        .modos { display: inline-flex; border: 1px solid var(--linha); border-radius: 2px; overflow: hidden; background: var(--papel-alto); }
        .modos button {
          font: inherit; font-size: 13px; padding: 7px 14px; border: 0; background: transparent;
          color: var(--suave); cursor: pointer;
        }
        .modos button[data-on="true"] { background: var(--tinta); color: var(--papel-alto); }
        .modos button:focus-visible { outline: 2px solid var(--acento); outline-offset: -2px; }

        .grade { max-width: 1120px; margin: 0 auto; display: grid; gap: 26px; grid-template-columns: 1fr; align-items: start; }
        @media (min-width: 940px) { .grade { grid-template-columns: 360px 1fr; } }
        @media (min-width: 940px) { .coluna-esq { position: sticky; top: 20px; } }

        .painel { background: var(--papel-alto); border: 1px solid var(--linha); padding: 18px; }
        .painel + .painel { margin-top: 18px; }

        .rotulo { font-size: 13px; font-weight: 600; margin: 0 0 10px; }

        .abas { display: flex; gap: 0; margin-bottom: 12px; border-bottom: 1px solid var(--linha); }
        .abas button {
          font: inherit; font-size: 13px; padding: 7px 12px; border: 0; background: transparent;
          color: var(--suave); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .abas button[data-on="true"] { color: var(--tinta); font-weight: 600; border-bottom-color: var(--acento); }

        textarea, input[type="text"] {
          width: 100%; font: inherit; font-size: 13px; padding: 9px 10px;
          border: 1px solid var(--linha); background: #fff; color: var(--tinta); border-radius: 2px;
        }
        textarea { min-height: 150px; resize: vertical; line-height: 1.45; }
        textarea:focus, input:focus { outline: 2px solid var(--acento); outline-offset: -1px; }

        .arquivo {
          border: 1px dashed var(--linha); background: #fff; padding: 22px 14px; text-align: center;
          font-size: 13px; color: var(--suave); cursor: pointer; border-radius: 2px;
        }
        .arquivo:hover { border-color: var(--acento); color: var(--tinta); }

        .botao {
          font: inherit; font-size: 14px; font-weight: 500; padding: 10px 16px;
          background: var(--tinta); color: var(--papel-alto); border: 0; border-radius: 2px; cursor: pointer;
        }
        .botao:disabled { opacity: 0.45; cursor: default; }
        .botao.secundario { background: transparent; color: var(--tinta); border: 1px solid var(--linha); }
        .botao:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }

        .aviso { font-size: 12.5px; color: #A8323C; margin-top: 10px; }
        .nota { font-size: 12px; color: var(--suave); margin-top: 10px; }

        .veredito-nome { font-family: 'Newsreader', Georgia, serif; font-size: 27px; font-weight: 500; line-height: 1.1; }
        .veredito-num { font-size: 13px; color: var(--suave); margin-top: 3px; }

        .barra-linha { display: grid; grid-template-columns: 118px 1fr 38px; gap: 10px; align-items: center; font-size: 12.5px; margin-top: 9px; }
        .trilho { height: 7px; background: #DDE4E1; border-radius: 1px; overflow: hidden; }
        .preenche { height: 100%; }
        .num-bloco { text-align: right; color: var(--suave); font-variant-numeric: tabular-nums; }

        .bloco { margin-bottom: 30px; }
        .bloco-cabeca { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 1.5px solid var(--tinta); padding-bottom: 7px; margin-bottom: 4px; }
        .bloco-nome { font-family: 'Newsreader', Georgia, serif; font-size: 22px; font-weight: 500; margin: 0; }
        .bloco-resumo { font-size: 12.5px; color: var(--suave); margin: 0 0 14px; }

        .item { border-bottom: 1px solid var(--linha); padding: 15px 0; }
        .item-topo { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .item-texto { font-size: 14.5px; max-width: 60ch; margin: 0; }
        .peso { font-size: 11px; color: var(--suave); white-space: nowrap; padding-top: 3px; }

        .opcoes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
        .opcoes button {
          font: inherit; font-size: 12.5px; padding: 5px 13px; cursor: pointer;
          border: 1px solid var(--linha); background: #fff; color: var(--suave); border-radius: 2px;
        }
        .opcoes button[data-on="true"] { color: #fff; border-color: transparent; font-weight: 500; }
        .opcoes button:focus-visible { outline: 2px solid var(--acento); outline-offset: 1px; }

        .ia { margin-top: 11px; border-left: 2px solid var(--linha); padding: 2px 0 2px 12px; }
        .ia-cabeca { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11.5px; color: var(--suave); }
        .ia-cabeca button { font: inherit; font-size: 11.5px; background: none; border: 0; color: var(--acento); cursor: pointer; padding: 0; text-decoration: underline; }
        .marca { border: 1px solid var(--linha); padding: 1px 6px; border-radius: 2px; }
        .marca[data-tipo="editado"] { border-color: #C08419; color: #8A5E0C; }
        .ia-corpo { font-size: 13px; margin-top: 6px; }
        .trecho { font-family: 'Newsreader', Georgia, serif; font-size: 14px; color: var(--tinta); margin-top: 5px; }

        .passos li { font-size: 13.5px; margin-bottom: 8px; max-width: 66ch; }
        .passos { padding-left: 18px; margin: 0; }

        pre.email {
          background: #fff; border: 1px solid var(--linha); padding: 12px; font-size: 12px;
          font-family: 'IBM Plex Sans', sans-serif; white-space: pre-wrap; margin: 10px 0 0; line-height: 1.5;
          max-height: 230px; overflow: auto;
        }

        .rodape { max-width: 1120px; margin: 34px auto 0; font-size: 12px; color: var(--suave); border-top: 1px solid var(--linha); padding-top: 14px; max-width: 1120px; }

        @media (prefers-reduced-motion: no-preference) {
          .preenche { transition: width 320ms ease; }
        }
      `}</style>

      <div className="cabeca">
        <h1 className="titulo">Semáforo da Reprodutibilidade</h1>
        <p className="subtitulo">
          Dez perguntas para saber, em cinco minutos, se vale investir tempo num artigo — antes de descobrir
          na terceira semana que os dados estão disponíveis apenas mediante solicitação.
        </p>
        <div className="modos" role="group" aria-label="Modo de avaliação">
          <button data-on={modo === "terceiro"} onClick={() => setModo("terceiro")}>
            Avaliar um artigo
          </button>
          <button data-on={modo === "proprio"} onClick={() => setModo("proprio")}>
            Avaliar meu manuscrito
          </button>
        </div>
      </div>

      <div className="grade">
        <div className="coluna-esq">
          <div className="painel">
            <p className="rotulo">Artigo</p>
            <input
              type="text"
              placeholder="Referência ou DOI (aparece no relatório)"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />

            <div className="abas" style={{ marginTop: 14 }} role="tablist">
              <button role="tab" data-on={aba === "texto"} onClick={() => setAba("texto")}>
                Colar texto
              </button>
              <button role="tab" data-on={aba === "pdf"} onClick={() => setAba("pdf")}>
                Enviar PDF
              </button>
            </div>

            {aba === "texto" ? (
              <>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Cole o texto do artigo. Inclua o fim: declarações de disponibilidade de dados e código costumam ficar lá."
                />
                <p className="nota">
                  Colar de PDF em duas colunas embaralha o texto. Se o resultado vier estranho, use o modo PDF.
                </p>
              </>
            ) : (
              <>
                <div className="arquivo" onClick={() => inputArquivo.current && inputArquivo.current.click()}>
                  {pdf ? pdf.name : "Escolher arquivo PDF"}
                </div>
                <input
                  ref={inputArquivo}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => setPdf(e.target.files[0] || null)}
                />
                <p className="nota">O layout é preservado, o que ajuda a encontrar notas de rodapé e legendas.</p>
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button className="botao" onClick={analisar} disabled={carregando}>
                {carregando ? progresso || "Analisando" : "Preencher com IA"}
              </button>
              <button className="botao secundario" onClick={limpar} disabled={carregando}>
                Limpar respostas
              </button>
            </div>

            {erro && <p className="aviso">{erro}</p>}
            <p className="nota">
              A IA preenche um rascunho e mostra o trecho que sustentou cada resposta. Você decide o veredito final —
              e pode responder tudo à mão, sem usar a IA.
            </p>
          </div>

          <div className="painel">
            <div className="veredito-nome" style={{ color: cor }}>
              {nomeDoVeredito(pontuacao)}
            </div>
            <div className="veredito-num">
              {pontuacao === null
                ? "Responda ao menos um item"
                : `${pontuacao}% dos pontos possíveis · ${respondidos.length} de ${TODOS_ITENS.length} itens respondidos`}
            </div>

            <div style={{ marginTop: 16 }}>
              {porBloco.map((b) => (
                <div className="barra-linha" key={b.id}>
                  <span>{b.nome}</span>
                  <span className="trilho">
                    <span
                      className="preenche"
                      style={{
                        width: `${b.pct === null ? 0 : b.pct}%`,
                        background: corDoVeredito(b.pct),
                      }}
                    />
                  </span>
                  <span className="num-bloco">{b.pct === null ? "—" : b.pct}</span>
                </div>
              ))}
            </div>

            <button className="botao secundario" style={{ marginTop: 16, width: "100%" }} onClick={baixarRelatorio}>
              Baixar relatório (.md)
            </button>
          </div>
        </div>

        <div>
          {BLOCOS.map((b) => (
            <section className="bloco" key={b.id}>
              <div className="bloco-cabeca">
                <h2 className="bloco-nome">{b.nome}</h2>
                <span className="peso">
                  peso total {b.itens.reduce((s, i) => s + i.peso, 0)}
                </span>
              </div>
              <p className="bloco-resumo">{b.resumo}</p>

              {b.itens.map((i) => {
                const r = respostas[i.id];
                const a = analise[i.id];
                const opcoes = i.permiteNA ? ["sim", "parcial", "nao", "na"] : ["sim", "parcial", "nao"];
                return (
                  <div className="item" key={i.id}>
                    <div className="item-topo">
                      <p className="item-texto">{i.texto}</p>
                      <span className="peso">peso {i.peso}</span>
                    </div>

                    <div className="opcoes">
                      {opcoes.map((o) => (
                        <button
                          key={o}
                          data-on={r === o}
                          onClick={() => responder(i.id, o)}
                          style={
                            r === o
                              ? {
                                  background:
                                    o === "sim"
                                      ? "#2E7D57"
                                      : o === "parcial"
                                      ? "#C08419"
                                      : o === "nao"
                                      ? "#A8323C"
                                      : "#5C6B66",
                                }
                              : undefined
                          }
                        >
                          {ROTULO[o]}
                        </button>
                      ))}
                    </div>

                    {a && (
                      <div className="ia">
                        <div className="ia-cabeca">
                          <span className="marca" data-tipo={editados[i.id] ? "editado" : "ia"}>
                            {editados[i.id] ? "corrigido por você" : "sugestão da IA"}
                          </span>
                          <button onClick={() => setAberto((s) => ({ ...s, [i.id]: !s[i.id] }))}>
                            {aberto[i.id] ? "ocultar evidência" : "ver evidência"}
                          </button>
                        </div>
                        {aberto[i.id] && (
                          <div className="ia-corpo">
                            {a.justificativa}
                            {a.trecho ? <div className="trecho">“{a.trecho}”</div> : null}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}

          <section className="bloco">
            <div className="bloco-cabeca">
              <h2 className="bloco-nome">Próximos passos</h2>
            </div>
            <p className="bloco-resumo">
              O checklist diagnostica. Esta parte é o que fazer com o diagnóstico.
            </p>

            {pontuacao === null && (
              <p style={{ fontSize: 14, color: "#5C6B66" }}>
                Responda os itens acima e as recomendações aparecem aqui.
              </p>
            )}

            {pontuacao !== null && modo === "proprio" && (
              <ol className="passos">
                {faltando.length === 0 ? (
                  <li>Nada a corrigir pelo checklist. Antes de submeter, confira se os links de repositório abrem numa janela anônima.</li>
                ) : (
                  faltando.map((f) => (
                    <li key={f.id}>
                      Resolver antes de submeter: {f.texto.replace(/\?$/, "").replace(/^Os |^O |^Há |^As /, "")}.
                    </li>
                  ))
                )}
                <li>
                  Deposite dados e código no Zenodo ou OSF e cite o DOI no próprio manuscrito, não só nos agradecimentos.
                </li>
                <li>
                  Declare versões exatas de software. Num trabalho de dinâmica molecular, isso inclui campo de força,
                  versão do motor de simulação e arquivos de parâmetro.
                </li>
              </ol>
            )}

            {pontuacao !== null && modo === "terceiro" && pontuacao >= 75 && (
              <ol className="passos">
                <li>Cite o conjunto de dados separadamente do artigo, pelo DOI próprio. Quem abre dados só recebe crédito se for citado.</li>
                <li>Registre a versão do dataset que você baixou — repositórios permitem atualização.</li>
                <li>Guarde o relatório junto das suas notas de leitura, como registro da triagem.</li>
              </ol>
            )}

            {pontuacao !== null && modo === "terceiro" && pontuacao >= 40 && pontuacao < 75 && (
              <ol className="passos">
                <li>Procure o material suplementar no site do periódico: parte do que falta costuma estar lá, fora do PDF.</li>
                <li>Verifique se existe preprint da mesma equipe, que às vezes traz anexos que o artigo final perdeu.</li>
                <li>Procure repositórios de terceiros: bancos temáticos, PDB, GEO, Dryad, dependendo do tipo de dado.</li>
                <li>Se ainda faltar o essencial, use o pedido ao autor abaixo.</li>
              </ol>
            )}

            {pontuacao !== null && modo === "terceiro" && pontuacao < 40 && (
              <ol className="passos">
                <li>Trate o artigo como referência conceitual, não como base de reuso, até que o material apareça.</li>
                <li>Escreva ao autor correspondente. O modelo abaixo já vem preenchido com o que faltou.</li>
                <li>Registre a data do pedido. Sem resposta em 30 dias, isso vira informação relevante para a sua própria seção de métodos.</li>
              </ol>
            )}

            {pontuacao !== null && modo === "terceiro" && pontuacao < 75 && (
              <>
                <p className="rotulo" style={{ marginTop: 20 }}>Pedido ao autor correspondente</p>
                <pre className="email">{emailAutor}</pre>
                <button
                  className="botao secundario"
                  style={{ marginTop: 10 }}
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(emailAutor)}
                >
                  Copiar mensagem
                </button>
              </>
            )}
          </section>
        </div>
      </div>

      <p className="rodape">
        Protótipo. A pontuação é uma triagem, não um juízo sobre a qualidade científica do artigo — um estudo pode ser
        excelente e ainda assim não ser reproduzível a partir do que foi publicado.
      </p>
    </div>
  );
}
