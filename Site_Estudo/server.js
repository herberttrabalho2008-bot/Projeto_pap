/* ==========================================================
   SERVER.JS - o servidor (corre no teu computador, com Node.js)

   Para que serve?
     1. Mostra o site (entrega os ficheiros da pasta "public" ao browser)
     2. Pede preços à Steam e passa-os ao site

   Porque é que precisamos de um servidor?
     A Steam não deixa que o browser lhe peça dados diretamente
     (essa regra chama-se CORS). Mas um servidor Node.js não tem
     essa restrição. Por isso o fluxo é:
         Browser  ->  o nosso servidor  ->  Steam
         Browser  <-  o nosso servidor  <-  Steam
 <>
   Estrutura do ficheiro:
     1. Importar módulos e configuração
     2. Funções que falam com a Steam
     3. O servidor (as "rotas")
   ========================================================== */


/* ---------- 1. IMPORTAR MÓDULOS E CONFIGURAÇÃO ---------- */

// "require" carrega um módulo que já vem incluído no Node.js.
// "const" cria uma variável que não pode ser reatribuída.
const http = require("http");   // permite criar um servidor web
const fs   = require("fs");     // "file system": permite ler ficheiros do disco
const path = require("path");   // ajuda a montar caminhos de ficheiros

// A "porta" é como o número de uma porta de casa: identifica o nosso
// servidor no computador. O endereço final é http://localhost:3000
const PORTA = 3000;

// __dirname é uma variável especial do Node: a pasta onde este ficheiro está.
// path.join junta pedaços de caminho. Resultado: .../monitor-node/public
const PASTA_PUBLICA = path.join(__dirname, "public");

// Dicionário (objeto) que liga a extensão do ficheiro ao seu "tipo".
// O browser precisa deste tipo para saber se recebeu HTML, CSS ou JavaScript.
// "charset=utf-8" garante que os acentos aparecem bem.
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
};


/* ---------- 2. FUNÇÕES QUE FALAM COM A STEAM ---------- */

// "async" marca uma função que espera por coisas lentas (como a internet).
// Dentro dela podemos usar "await" para esperar pela resposta.

// Procura jogos pelo nome.
async function pesquisarSteam(termo) {

  // Montamos o endereço do pedido:
  //   term=...     o que o utilizador escreveu
  //   cc=pt        "country code": preços de Portugal (em euros)
  //   l=portuguese idioma
  // encodeURIComponent converte espaços e acentos em formato seguro para URLs
  // (ex: "elden ring" passa a "elden%20ring").
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(termo)}&cc=pt&l=portuguese`;

  // fetch faz o pedido à internet. "await" espera até a Steam responder.
  const resposta = await fetch(url);

  // A resposta vem em texto. .json() converte esse texto em objetos JavaScript.
  const dados = await resposta.json();

  // dados.items é a lista de jogos. Se não existir, usamos [] (lista vazia)
  // com o operador "||" ("ou"), para o código não dar erro.
  return (dados.items || [])

    // .filter() fica só com os itens que passam no teste.
    // Aqui: só os que são "app" (jogos), sem DLCs ou outras coisas.
    .filter(j => j.type === "app")

    // .map() transforma cada item noutro formato, mais simples para nós.
    .map(j => {
      const p = j.price;   // objeto com o preço; não existe em jogos grátis

      return {
        id: j.id,
        nome: j.name,

        // Operador "condição ? valorSeVerdade : valorSeFalso".
        // A Steam dá preços em CÊNTIMOS (2499 = 24,99 €), por isso dividimos por 100.
        // Se não há preço (p é undefined), devolvemos null.
        preco: p ? p.final / 100 : null,
        precoOriginal: p ? p.initial / 100 : null,

        // Calcula a % de desconto: 1 - (preço final / preço original).
        // Ex: 50 / 100 = 0,5  ->  1 - 0,5 = 0,5  ->  50%.
        // Math.round arredonda para número inteiro.
        // A condição "p.initial > 0" evita dividir por zero.
        desconto: p && p.initial > 0
          ? Math.round((1 - p.final / p.initial) * 100)
          : 0,
      };
    });
}

// Recebe uma lista de IDs e devolve o preço atual de cada jogo.
async function precosSteam(ids) {

  // ids.join(",") junta a lista num texto: [1, 2, 3] -> "1,2,3"
  // filters=price_overview pede só a parte dos preços (e permite
  // pedir vários jogos de uma vez, o que a Steam não deixa de outra forma).
  const url = `https://store.steampowered.com/api/appdetails?appids=${ids.join(",")}&cc=pt&filters=price_overview`;

  const resposta = await fetch(url);
  const dados = await resposta.json();

  // Vamos construir um objeto onde a "chave" é o ID e o valor é o preço.
  // Exemplo do resultado: { "1145360": { preco: 24.99, ... }, "292030": null }
  const resultado = {};

  // .forEach() repete o código para cada elemento da lista.
  ids.forEach(id => {

    // O "?." (encadeamento opcional) significa "se existir, continua; se não, devolve undefined".
    // Sem ele, o código dava erro quando um jogo não vem na resposta.
    const p = dados[id]?.data?.price_overview;

    resultado[id] = p
      ? { preco: p.final / 100, precoOriginal: p.initial / 100, desconto: p.discount_percent }
      : null;   // null = jogo grátis ou sem preço
  });

  return resultado;
}


// Os requisitos vêm da Steam em formato HTML, por exemplo:
//   "<strong>Mínimo:</strong><br><ul><li>SO: Windows 10</li><li>RAM: 8 GB</li></ul>"
// Esta função converte isso em texto simples, com uma linha por requisito.
// Texto simples é mais seguro de mostrar na página do que HTML vindo de fora.
function limparHTML(html) {
  if (!html) return null;   // se não existir, devolve null

  return html
    .replace(/<br\s*\/?>/gi, "\n")   // <br> (quebra de linha) -> nova linha
    .replace(/<\/li>/gi, "\n")       // o fim de cada item de lista -> nova linha
    .replace(/<[^>]+>/g, "")         // apaga todas as restantes tags (tudo entre < e >)
    .replace(/&nbsp;/g, " ")         // converte códigos HTML em caracteres normais
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/^(Mínimos?|Minimum|Recomendados?|Recommended):?\s*/i, "")  // tira o título do início
    .replace(/\n{3,}/g, "\n\n")      // 3 ou mais linhas vazias seguidas -> só 1
    .trim();                         // tira espaços e linhas vazias no início e no fim
}

// "Cache": guarda as respostas já recebidas, para não pedirmos à Steam
// o mesmo jogo várias vezes (a Steam limita os pedidos).
const cacheDetalhes = {};

// Devolve os detalhes de UM jogo (descrição, géneros, requisitos...).
async function detalhesSteam(id) {

  // Se já temos este jogo guardado na cache, devolvemos logo.
  if (cacheDetalhes[id]) return cacheDetalhes[id];

  // Sem "filters=": pedimos o jogo completo (só dá para um jogo de cada vez).
  const url = `https://store.steampowered.com/api/appdetails?appids=${id}&cc=pt&l=portuguese`;
  const resposta = await fetch(url);
  const dados = await resposta.json();

  const d = dados[id]?.data;   // os dados do jogo (ou undefined se não existirem)
  if (!d) return null;

  // pc_requirements é um objeto { minimum, recommended }.
  // Em jogos sem requisitos a Steam devolve uma lista vazia [], por isso o "|| {}".
  const req = d.pc_requirements || {};

  const resultado = {
    descricao: d.short_description || "",
    generos: (d.genres || []).map(g => g.description),   // [{description:"Ação"}] -> ["Ação"]
    lancamento: d.release_date?.date || null,
    metacritic: d.metacritic?.score ?? null,   // "??" só usa null se o valor não existir (0 conta como valor)
    minimos: limparHTML(req.minimum),
    recomendados: limparHTML(req.recommended),
  };

  cacheDetalhes[id] = resultado;   // guarda na cache para a próxima vez
  return resultado;
}


/* ---------- 3. O SERVIDOR ---------- */

// Função auxiliar: envia uma resposta em formato JSON ao browser.
//   res     -> o objeto da resposta (é por aqui que "falamos" com o browser)
//   estado  -> código HTTP (200 = tudo bem, 404 = não encontrado, 500 = erro)
//   objeto  -> os dados a enviar
function enviarJSON(res, estado, objeto) {
  res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8" });  // cabeçalhos
  res.end(JSON.stringify(objeto));   // stringify: objeto -> texto JSON. end() envia e termina.
}

// http.createServer recebe uma função que corre A CADA PEDIDO do browser.
//   req -> o pedido (o que o browser quer)
//   res -> a resposta (o que vamos devolver)
const servidor = http.createServer(async (req, res) => {

  // req.url é só o caminho (ex: "/api/pesquisar?termo=hades").
  // new URL(...) separa-o em partes (caminho e parâmetros), mais fácil de usar.
  const url = new URL(req.url, `http://localhost:${PORTA}`);

  // try/catch: se algo falhar lá dentro (ex: sem internet), o "catch"
  // trata do erro em vez de o servidor deixar de funcionar.
  try {

    // --- Rota 1: /api/pesquisar?termo=hades ---
    // Uma "rota" é um caminho a que o servidor sabe responder.
    if (url.pathname === "/api/pesquisar") {
      // searchParams.get lê o valor de "termo". Se não existir, usa "" (vazio).
      const termo = url.searchParams.get("termo") || "";
      // "return" termina aqui o tratamento deste pedido.
      return enviarJSON(res, 200, await pesquisarSteam(termo));
    }

    // --- Rota 2: /api/precos?ids=1145360,292030 ---
    if (url.pathname === "/api/precos") {
      const ids = (url.searchParams.get("ids") || "")
        .split(",")                       // "1,2,3" -> ["1", "2", "3"]
        .filter(id => /^\d+$/.test(id));  // fica só com os que são números (segurança)
      return enviarJSON(res, 200, await precosSteam(ids));
    }

    // --- Rota 3: /api/detalhes?id=1145360 ---
    // Devolve os detalhes de um jogo: descrição, géneros, requisitos de hardware...
    if (url.pathname === "/api/detalhes") {
      const id = url.searchParams.get("id") || "";
      if (!/^\d+$/.test(id)) {   // o ID tem de ser só números (segurança)
        return enviarJSON(res, 400, { erro: "ID inválido" });   // 400 = pedido mal feito
      }
      return enviarJSON(res, 200, await detalhesSteam(id));
    }

    // --- Qualquer outro caminho: tenta entregar um ficheiro da pasta "public" ---
    // Se o caminho for "/", entregamos o index.html (a página inicial).
    const nome = url.pathname === "/" ? "/index.html" : url.pathname;
    const ficheiro = path.join(PASTA_PUBLICA, nome);

    // Segurança: impede pedidos como "/../server.js" que tentariam
    // sair da pasta "public" e ler outros ficheiros do computador.
    if (!ficheiro.startsWith(PASTA_PUBLICA)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Proibido");
    }

    // Lê o ficheiro do disco. Quando terminar, corre a função com (erro, conteudo).
    fs.readFile(ficheiro, (erro, conteudo) => {

      if (erro) {
        // Ficheiro não existe: respondemos 404 e mostramos o caminho procurado,
        // o que ajuda a descobrir erros na estrutura das pastas.
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Ficheiro não encontrado: " + ficheiro);
      }

      // path.extname devolve a extensão (ex: ".css"). Procuramos o tipo no dicionário TIPOS.
      const tipo = TIPOS[path.extname(ficheiro)] || "text/plain";
      res.writeHead(200, { "Content-Type": tipo });
      res.end(conteudo);   // envia o conteúdo do ficheiro ao browser
    });

  } catch (erro) {
    // Se algo correr mal, mostramos o erro no terminal (para ti)
    // e avisamos o browser com o código 500 ("erro no servidor").
    console.error(erro);
    enviarJSON(res, 500, { erro: "Erro ao contactar a Steam" });
  }
});

// Liga o servidor à porta. A função corre quando o servidor está pronto.
servidor.listen(PORTA, () => {
  console.log(`Servidor a funcionar em http://localhost:${PORTA}`);
});