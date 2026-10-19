/* ==========================================================
   SCRIPT.JS - a lógica da página (corre dentro do browser)

   O site NÃO fala com a Steam. Fala com o nosso servidor (server.js),
   que pede os dados à Steam e os devolve.

   Estrutura do ficheiro:
     1. Ligar aos elementos do HTML
     2. Funções auxiliares
     3. Guardar a lista de jogos seguidos
     4. Desenhar os cartões
     5. Ações (pesquisar, seguir, remover, atualizar)
     6. Arranque
   ========================================================== */


/* ---------- 1. LIGAR AOS ELEMENTOS DO HTML ---------- */

// document.getElementById("x") procura no HTML o elemento com id="x".
// Guardamos cada um numa variável para o podermos alterar mais tarde.
const caixaPesquisa     = document.getElementById("caixaPesquisa");      // o <input>
const botaoPesquisar    = document.getElementById("botaoPesquisar");     // o botão
const divResultados     = document.getElementById("resultados");         // onde vão os resultados
const divSeguidos       = document.getElementById("seguidos");           // onde vão os seguidos
const ultimaAtualizacao = document.getElementById("ultimaAtualizacao");  // texto da hora
const contaSeguidos     = document.getElementById("contaSeguidos");      // contador de seguidos
const contaResultados   = document.getElementById("contaResultados");    // contador de resultados


/* ---------- 2. FUNÇÕES AUXILIARES ---------- */

// Converte um número em texto de euros. Ex: 24.99 -> "24,99 €"
function paraEuros(valor) {
  // toFixed(2): força 2 casas decimais (24.5 -> "24.50")
  // replace(".", ","): troca o ponto por vírgula, como em Portugal
  return valor.toFixed(2).replace(".", ",") + " €";
}

// Devolve o endereço da imagem de capa de um jogo.
// A Steam guarda sempre as imagens neste formato, usando o ID do jogo.
function imagemDoJogo(id) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
}

// Devolve a data de hoje em formato português. Ex: "11/10/2026"
function hoje() {
  return new Date().toLocaleDateString("pt-PT");
}

// Segurança: o nome do jogo vem da internet. Se tivesse código HTML malicioso
// e o inseríssemos diretamente na página, ele seria executado.
// Aqui metemos o texto num elemento como TEXTO (textContent), e lemos de volta
// como HTML (innerHTML): os caracteres especiais ficam "neutralizados".
function escapar(texto) {
  const div = document.createElement("div");   // cria um <div> que não aparece na página
  div.textContent = texto;
  return div.innerHTML;
}

// Cria o HTML de uma linha da tabela de detalhes.
// "classe = ''" é um valor por defeito: se não passarmos classe, fica vazio.
function linhaDetalhe(nome, valor, classe = "") {
  return `<div><dt>${nome}</dt><dd class="${classe}">${valor}</dd></div>`;
}


/* ---------- 3. GUARDAR A LISTA DE JOGOS SEGUIDOS ---------- */
/* Usamos o localStorage: uma pequena memória do browser que guarda dados
   mesmo depois de fechares a página. Só aceita TEXTO.

   Cada jogo seguido é um objeto:
     { id, nome, precoInicial, minimo, dataInicio }
     - precoInicial: o preço no dia em que começaste a seguir
     - minimo:       o preço mais baixo que o site já viu                  */

function lerSeguidos() {
  // getItem devolve o texto guardado (ou null se não houver nada).
  // JSON.parse converte esse texto de volta numa lista.
  // "|| []" -> se não houver nada guardado, usa uma lista vazia.
  return JSON.parse(localStorage.getItem("seguidos")) || [];
}

function guardarSeguidos(lista) {
  // JSON.stringify converte a lista em texto, para o localStorage a aceitar.
  localStorage.setItem("seguidos", JSON.stringify(lista));
}


/* ---------- 4. DESENHAR OS CARTÕES ---------- */

// Cria o cartão de UM jogo e devolve-o.
//   jogo   -> { id, nome, preco, precoOriginal, desconto }
//   opcoes -> { textoBotao, classeBotao, aoClicar, extra }
//             "aoClicar" é uma função: o que acontece quando o botão é clicado.
//             "extra" são linhas de detalhe adicionais (só para os seguidos).
function criarCartao(jogo, opcoes) {

  // Duas perguntas que vamos usar várias vezes (valem true ou false):
  const temPreco = jogo.preco !== null && jogo.preco !== undefined;
  const emPromocao = temPreco && jogo.desconto > 0;   // "&&" = "e"

  // --- Bloco do preço: depende de o jogo ser grátis, estar em promoção, ou não ---
  let htmlPreco;            // o texto HTML do preço
  let htmlPoupanca = "";    // a linha "Poupas X €" (vazia por defeito)
  let etiqueta = "";        // a etiqueta "-50%" (vazia por defeito)

  if (!temPreco) {
    // Caso 1: grátis ou sem preço
    htmlPreco = `<span class="gratis">Grátis / sem preço</span>`;
  } else if (emPromocao) {
    // Caso 2: em promoção -> preço novo, preço antigo, poupança e etiqueta
    htmlPreco = `<span class="preco">${paraEuros(jogo.preco)}</span>
                 <span class="antigo">${paraEuros(jogo.precoOriginal)}</span>`;
    htmlPoupanca = `<p class="poupanca">Poupas ${paraEuros(jogo.precoOriginal - jogo.preco)}</p>`;
    etiqueta = `<span class="etiqueta">-${jogo.desconto}%</span>`;
  } else {
    // Caso 3: preço normal, sem promoção
    htmlPreco = `<span class="preco normal">${paraEuros(jogo.preco)}</span>`;
  }

  // --- Tabela de detalhes ---
  let detalhes = "";
  if (temPreco) {
    detalhes += linhaDetalhe("Preço normal", paraEuros(jogo.precoOriginal));
    detalhes += linhaDetalhe("Em promoção", emPromocao ? "Sim ✅" : "Não");
  }
  // Junta as linhas extra, se existirem ("opcoes.extra || ''" evita escrever "undefined").
  detalhes += opcoes.extra || "";

  // --- Monta o cartão ---
  // createElement cria um elemento HTML novo, ainda fora da página.
  const cartao = document.createElement("article");
  cartao.className = "cartao";   // a classe CSS que lhe dá o aspeto

  // innerHTML define o HTML que está dentro do elemento.
  // Os `${...}` (template literals) inserem valores no meio do texto.
  // onerror: se a imagem não carregar, esconde-a em vez de mostrar um ícone partido.
  cartao.innerHTML = `
    <div class="capa">
      <img src="${imagemDoJogo(jogo.id)}" alt="" onerror="this.style.display='none'">
      ${etiqueta}
    </div>
    <div class="corpo">
      <h3 class="titulo">
        <a href="https://store.steampowered.com/app/${jogo.id}" target="_blank">${escapar(jogo.nome)}</a>
      </h3>
      <div class="bloco-preco">${htmlPreco}</div>
      ${htmlPoupanca}
      <dl class="detalhes">${detalhes}</dl>

      <!-- Zona dos requisitos: começa escondida (atributo "hidden").
           É preenchida quando se clica em "Requisitos do PC". -->
      <div class="requisitos" hidden></div>

      <!-- Dois botões lado a lado -->
      <div class="botoes">
        <button class="btn-req secundario">📋 Requisitos do PC</button>
        <button class="btn-acao ${opcoes.classeBotao || ""}">${opcoes.textoBotao}</button>
      </div>
    </div>
  `;

  // Agora há dois botões, por isso procuramos cada um pela sua classe.
  // Botão principal (Seguir / Remover):
  cartao.querySelector(".btn-acao").addEventListener("click", opcoes.aoClicar);
  // Botão dos requisitos: abre/fecha a zona dos requisitos deste cartão.
  cartao.querySelector(".btn-req").addEventListener("click", () => alternarRequisitos(cartao, jogo.id));

  return cartao;   // devolve o cartão pronto; quem chamou decide onde o põe
}

// Cria as linhas de detalhe extra dos jogos seguidos.
//   seguido -> o que guardámos no browser (precoInicial, minimo, dataInicio)
//   jogo    -> os dados atuais (com o preço de agora)
function detalhesDeSeguido(seguido, jogo) {
  // Se o jogo não tem preço, não há nada a comparar.
  if (jogo.preco === null || jogo.preco === undefined) return "";

  let html = "";
  html += linhaDetalhe(`Preço em ${seguido.dataInicio}`, paraEuros(seguido.precoInicial));
  html += linhaDetalhe("Mais baixo que vi", paraEuros(seguido.minimo));

  // Variação = preço de agora - preço de quando começámos a seguir.
  const diferenca = jogo.preco - seguido.precoInicial;

  // Math.abs dá o valor absoluto (sem sinal). Comparamos com 0,005 em vez de 0
  // porque números decimais em JavaScript têm pequenos erros de arredondamento.
  if (Math.abs(diferenca) < 0.005) {
    html += linhaDetalhe("Variação", "Sem alteração");
  } else if (diferenca < 0) {
    // Negativo = o preço desceu (bom!) -> verde
    html += linhaDetalhe("Variação", `▼ ${paraEuros(-diferenca)}`, "desce");
  } else {
    // Positivo = o preço subiu -> vermelho
    html += linhaDetalhe("Variação", `▲ ${paraEuros(diferenca)}`, "sobe");
  }
  return html;
}


// Cria o HTML de um bloco de requisitos (ex: "Mínimos" ou "Recomendados").
function blocoRequisitos(titulo, texto) {
  // Se a Steam não indicou requisitos, mostramos "Não indicado".
  // escapar() protege o texto, como vimos acima.
  return `<div class="req-bloco">
            <h4>${titulo}</h4>
            <p>${texto ? escapar(texto) : "Não indicado"}</p>
          </div>`;
}

// Abre ou fecha a zona de requisitos de um cartão.
//   cartao -> o cartão onde se clicou
//   id     -> o ID do jogo na Steam
async function alternarRequisitos(cartao, id) {
  const caixa = cartao.querySelector(".requisitos");
  const botao = cartao.querySelector(".btn-req");

  // Se a caixa está visível (hidden é false), fecha-a e termina.
  if (!caixa.hidden) {
    caixa.hidden = true;
    botao.textContent = "📋 Requisitos do PC";
    return;
  }

  // Caso contrário, abre-a.
  caixa.hidden = false;
  botao.textContent = "▲ Esconder requisitos";

  // "dataset" permite guardar notas num elemento HTML.
  // Se já carregámos os dados antes, não voltamos a pedir ao servidor.
  if (caixa.dataset.carregado) return;

  caixa.textContent = "A carregar...";

  try {
    const resposta = await fetch(`/api/detalhes?id=${id}`);
    const d = await resposta.json();

    // O servidor devolve null se a Steam não tiver dados deste jogo.
    if (!d) {
      caixa.textContent = "Sem informação disponível.";
      return;
    }

    // Monta a lista de informações extra, só com as que existem.
    // O ".join(' · ')" junta os itens separados por um ponto.
    const info = [];
    if (d.generos.length > 0) info.push(d.generos.join(", "));
    if (d.lancamento)         info.push("Lançamento: " + d.lancamento);
    if (d.metacritic !== null) info.push("Metacritic: " + d.metacritic);

    caixa.innerHTML = `
      <p class="req-descricao">${escapar(d.descricao)}</p>
      <p class="req-info">${escapar(info.join(" · "))}</p>
      <div class="req-colunas">
        ${blocoRequisitos("Mínimos", d.minimos)}
        ${blocoRequisitos("Recomendados", d.recomendados)}
      </div>
    `;
    caixa.dataset.carregado = "sim";   // marca como carregado

  } catch (erro) {
    caixa.textContent = "Erro ao carregar os requisitos.";
    console.error(erro);
  }
}


/* ---------- 5. AÇÕES ---------- */

// Pesquisar jogos pelo nome.
async function pesquisar() {
  // .value é o texto da caixa; .trim() remove espaços no início e no fim.
  const termo = caixaPesquisa.value.trim();
  if (termo === "") return;   // caixa vazia: sai da função sem fazer nada

  // Mensagem de espera enquanto a resposta não chega.
  divResultados.innerHTML = `<p class="vazio">A carregar...</p>`;
  contaResultados.textContent = "";

  try {
    // Pede ao NOSSO servidor (o endereço começa por "/", ou seja, o mesmo site).
    const resposta = await fetch(`/api/pesquisar?termo=${encodeURIComponent(termo)}`);
    const jogos = await resposta.json();   // lista de jogos

    if (jogos.length === 0) {
      divResultados.innerHTML = `<p class="vazio">Nenhum jogo encontrado.</p>`;
      return;
    }

    divResultados.innerHTML = "";               // limpa a mensagem "A carregar..."
    contaResultados.textContent = jogos.length; // mostra quantos resultados há

    // Para cada jogo, cria um cartão e põe-no na página.
    jogos.forEach(jogo => {
      const cartao = criarCartao(jogo, {
        textoBotao: "⭐ Seguir",
        aoClicar: () => seguir(jogo),   // "() =>" cria uma função pequena, executada só no clique
      });
      divResultados.appendChild(cartao);   // appendChild coloca o cartão dentro da div
    });

  } catch (erro) {
    // Se algo falhar (ex: servidor desligado), avisamos o utilizador.
    divResultados.innerHTML = `<p class="vazio">Erro ao contactar o servidor.</p>`;
    console.error(erro);   // e mostramos o erro na consola do browser (F12)
  }
}

// Seguir um jogo: guarda-o com o preço de hoje como ponto de partida.
function seguir(jogo) {
  const lista = lerSeguidos();

  // .some() devolve true se ALGUM elemento passar no teste.
  // Assim evitamos seguir o mesmo jogo duas vezes.
  if (!lista.some(j => j.id === jogo.id)) {
    lista.push({            // push adiciona ao fim da lista
      id: jogo.id,
      nome: jogo.nome,
      precoInicial: jogo.preco,
      minimo: jogo.preco,   // no início, o mínimo é o preço atual
      dataInicio: hoje(),
    });
    guardarSeguidos(lista);
  }
  mostrarSeguidos();   // atualiza o ecrã
}

// Deixar de seguir um jogo.
function deixarDeSeguir(id) {
  // .filter() mantém só os jogos com ID diferente do que queremos remover.
  guardarSeguidos(lerSeguidos().filter(j => j.id !== id));
  mostrarSeguidos();
}

// Mostrar os jogos seguidos, com os preços atuais.
async function mostrarSeguidos() {
  const lista = lerSeguidos();
  contaSeguidos.textContent = lista.length || "";   // se for 0, não mostra nada

  // Se não segue nenhum jogo, mostra uma mensagem e termina.
  if (lista.length === 0) {
    divSeguidos.innerHTML = `<p class="vazio">Ainda não segues nenhum jogo. Pesquisa um e carrega em "Seguir".</p>`;
    ultimaAtualizacao.textContent = "";
    return;
  }

  try {
    // .map() cria uma lista nova só com os IDs; .join(",") junta-os num texto.
    const ids = lista.map(j => j.id).join(",");

    // Pede ao servidor os preços atuais de todos os jogos de uma só vez.
    const resposta = await fetch(`/api/precos?ids=${ids}`);
    const precos = await resposta.json();   // { "id": { preco, precoOriginal, desconto } }

    // Atualiza os dados guardados de cada jogo.
    lista.forEach(j => {
      const p = precos[j.id];
      if (!p) return;   // sem preço novo, passa ao próximo

      // Jogos seguidos antes desta versão não têm preço inicial: preenchemos agora.
      if (j.precoInicial == null) { j.precoInicial = p.preco; j.dataInicio = hoje(); }

      // Se o preço de agora é mais baixo do que o mínimo guardado, é o novo mínimo.
      if (j.minimo == null || p.preco < j.minimo) j.minimo = p.preco;
    });
    guardarSeguidos(lista);

    // Desenha os cartões.
    divSeguidos.innerHTML = "";
    lista.forEach(j => {

      // Junta o nome (guardado no browser) com o preço atual (vindo da Steam).
      // "...x" (spread) copia as propriedades de x para o novo objeto.
      // Se o jogo não tiver preço, usamos { preco: null }.
      const jogo = { id: j.id, nome: j.nome, ...(precos[j.id] || { preco: null }) };

      const cartao = criarCartao(jogo, {
        textoBotao: "Remover",
        classeBotao: "remover",
        aoClicar: () => deixarDeSeguir(j.id),
        extra: detalhesDeSeguido(j, jogo),
      });
      divSeguidos.appendChild(cartao);
    });

    // Mostra a hora da atualização (só horas e minutos).
    ultimaAtualizacao.textContent =
      "Atualizado às " + new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  } catch (erro) {
    divSeguidos.innerHTML = `<p class="vazio">Erro ao carregar os jogos seguidos.</p>`;
    console.error(erro);
  }
}


/* ---------- 6. ARRANQUE ---------- */
/* Até aqui só definimos funções. É aqui que as ligamos ao que o utilizador faz. */

// Quando se clica no botão, pesquisa.
botaoPesquisar.addEventListener("click", pesquisar);

// Quando se carrega numa tecla dentro da caixa, vê qual foi. Se for Enter, pesquisa.
// "e" é o evento; e.key diz qual foi a tecla.
caixaPesquisa.addEventListener("keydown", (e) => {
  if (e.key === "Enter") pesquisar();
});

// Assim que a página abre, mostra os jogos que já seguias.
mostrarSeguidos();

// setInterval repete uma função de X em X milissegundos.
// 30 minutos * 60 segundos * 1000 milissegundos = 1 800 000 ms.
setInterval(mostrarSeguidos, 30 * 60 * 1000);