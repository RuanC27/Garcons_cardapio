
const SUPABASE_URL = "https://fmwmgoxjmcvsmfbcpfsj.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZJR2Z6gOfNO5rFhZb-RWwg_qvyY2b9Y";

const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json"
};

const $ = id => document.getElementById(id);

let pratos = [];
let carrinho = [];
let categoriaAtiva = "Todas";

let comandas = [];
let pedidosPorComanda = new Map();
let itensPorPedido = new Map();
let pratosPorId = new Map();
let comandaSelecionada = null;
let carregando = false;

const brl = valor => Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
});

const dataHora = valor => valor
    ? new Date(valor).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
    })
    : "—";

const seguro = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
})[c]);

async function api(caminho, opcoes = {}) {
    const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
        ...opcoes,
        headers: {
            ...headers,
            ...(opcoes.headers || {})
        }
    });

    const corpo = await resposta.text();

    if (!resposta.ok) {
        throw new Error(`Supabase (${resposta.status}): ${corpo}`);
    }

    return corpo ? JSON.parse(corpo) : null;
}

/* =========================
   CARDÁPIO E MONTAGEM
========================= */

async function carregarPratos() {
    $("mensagemPratos").textContent = "Carregando cardápio...";

    try {
        pratos = await api(
            "prato?select=id,nome,descricao,categoria,preco,imagem&order=nome.asc"
        ) || [];

        renderizarCategorias();
        renderizarPratos();

        $("mensagemPratos").textContent = pratos.length
            ? ""
            : "Nenhum prato cadastrado.";
    } catch (erro) {
        $("mensagemPratos").textContent =
            `Erro ao carregar pratos: ${erro.message}`;
        console.error(erro);
    }
}

function renderizarCategorias() {
    const categorias = [
        "Todas",
        ...new Set(pratos.map(p => p.categoria).filter(Boolean))
    ];

    $("categoriasPratos").innerHTML = categorias.map(categoria => `
        <button
            type="button"
            class="categoria-btn ${categoria === categoriaAtiva ? "ativa" : ""}"
            data-categoria="${seguro(categoria)}">
            ${seguro(categoria)}
        </button>
    `).join("");

    document.querySelectorAll("[data-categoria]").forEach(botao => {
        botao.addEventListener("click", () => {
            categoriaAtiva = botao.dataset.categoria;
            renderizarCategorias();
            renderizarPratos();
        });
    });
}

function renderizarPratos() {
    const pesquisa = $("pesquisaPratos").value
        .trim()
        .toLocaleLowerCase("pt-BR");

    const filtrados = pratos.filter(prato => {
        const categoriaOk =
            categoriaAtiva === "Todas" ||
            prato.categoria === categoriaAtiva;

        const texto =
            `${prato.nome} ${prato.descricao || ""} ${prato.categoria || ""}`
            .toLocaleLowerCase("pt-BR");

        return categoriaOk && texto.includes(pesquisa);
    });

    $("catalogoPratos").innerHTML = filtrados.map(prato => `
        <article class="prato-card">
            <img
                src="${seguro(prato.imagem || "https://via.placeholder.com/240x180?text=Sem+imagem")}"
                alt="${seguro(prato.nome)}"
                onerror="this.style.display='none'">

            <div class="prato-info">
                <h4>${seguro(prato.nome)}</h4>
                <p>${seguro(prato.descricao || prato.categoria || "")}</p>

                <div class="prato-rodape">
                    <span class="prato-preco">${brl(prato.preco)}</span>
                    <button
                        type="button"
                        class="adicionar-btn"
                        data-adicionar="${prato.id}">
                        + Adicionar
                    </button>
                </div>
            </div>
        </article>
    `).join("") || `
        <div class="vazio">
            <strong>Nenhum prato encontrado</strong>
            Tente outra pesquisa ou categoria.
        </div>
    `;

    document.querySelectorAll("[data-adicionar]").forEach(botao => {
        botao.addEventListener("click", () => {
            adicionarCarrinho(botao.dataset.adicionar);
        });
    });
}

function adicionarCarrinho(id) {
    const prato = pratos.find(p => String(p.id) === String(id));
    if (!prato) return;

    const existente = carrinho.find(
        item => String(item.prato.id) === String(id)
    );

    if (existente) {
        existente.quantidade++;
    } else {
        carrinho.push({ prato, quantidade: 1 });
    }

    renderizarCarrinho();
}

function alterarQuantidade(id, diferenca) {
    const item = carrinho.find(
        i => String(i.prato.id) === String(id)
    );

    if (!item) return;

    item.quantidade += diferenca;

    if (item.quantidade <= 0) {
        carrinho = carrinho.filter(
            i => String(i.prato.id) !== String(id)
        );
    }

    renderizarCarrinho();
}

function renderizarCarrinho() {
    const quantidade = carrinho.reduce(
        (soma, item) => soma + item.quantidade, 0
    );

    const total = carrinho.reduce(
        (soma, item) =>
            soma + Number(item.prato.preco || 0) * item.quantidade,
        0
    );

    $("quantidadeCarrinho").textContent =
        `${quantidade} ${quantidade === 1 ? "item" : "itens"}`;

    $("totalCarrinho").textContent = brl(total);

    $("itensCarrinho").innerHTML = carrinho.length
        ? carrinho.map(item => `
            <div class="item-carrinho">
                <div>
                    <strong>${seguro(item.prato.nome)}</strong>
                    <small>
                        ${brl(item.prato.preco)} cada —
                        ${brl(Number(item.prato.preco || 0) * item.quantidade)}
                    </small>
                </div>

                <div class="controles-item">
                    <button data-diminuir="${item.prato.id}">−</button>
                    <strong>${item.quantidade}</strong>
                    <button data-aumentar="${item.prato.id}">+</button>
                    <button class="remover-item" data-remover="${item.prato.id}">×</button>
                </div>
            </div>
        `).join("")
        : `<p class="carrinho-vazio">Nenhum prato adicionado.</p>`;

    document.querySelectorAll("[data-diminuir]").forEach(botao => {
        botao.addEventListener("click", () =>
            alterarQuantidade(botao.dataset.diminuir, -1)
        );
    });

    document.querySelectorAll("[data-aumentar]").forEach(botao => {
        botao.addEventListener("click", () =>
            alterarQuantidade(botao.dataset.aumentar, 1)
        );
    });

    document.querySelectorAll("[data-remover]").forEach(botao => {
        botao.addEventListener("click", () => {
            carrinho = carrinho.filter(
                i => String(i.prato.id) !== String(botao.dataset.remover)
            );
            renderizarCarrinho();
        });
    });

    $("confirmarComandaBtn").disabled = !carrinho.length;
}

/* Cria um pedido dentro da comanda aberta da mesa. */

async function criarPedidoGarcom() {
    const mesa = $("numeroMesa").value.trim();

    if (!mesa || !Number.isInteger(Number(mesa)) || Number(mesa) < 1) {
        alert("Informe um número de mesa válido.");
        $("numeroMesa").focus();
        return;
    }

    if (!carrinho.length) {
        alert("Adicione pelo menos um prato.");
        return;
    }

    const botao = $("confirmarComandaBtn");
    botao.disabled = true;
    botao.textContent = "Salvando pedido...";

    try {
        const existentes = await api(
            `comanda?select=id,numero_mesa&numero_mesa=eq.${encodeURIComponent(mesa)}&status=eq.aberta&order=aberta_em.desc&limit=1`
        );

        let comandaId;

        if (existentes.length) {
            comandaId = existentes[0].id;
        } else {
            const nova = await api("comanda", {
                method: "POST",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({
                    numero_mesa: mesa,
                    status: "aberta",
                    aberta_em: new Date().toISOString()
                })
            });

            comandaId = nova[0].id;
        }

        const novoPedido = await api("pedido", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
                comanda_id: comandaId,
                status: "aceito",
                criado_em: new Date().toISOString(),
                atualizado_em: new Date().toISOString()
            })
        });

        const pedidoId = novoPedido[0].id;

        const itens = carrinho.map(item => ({
            pedido_id: pedidoId,
            prato_id: item.prato.id,
            quantidade: item.quantidade,
            preco_unitario: Number(item.prato.preco || 0)
        }));

        await api("item_pedido", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(itens)
        });

        alert(`Pedido da mesa ${mesa} registrado com sucesso!`);

        carrinho = [];
        renderizarCarrinho();

        await carregarDados();

    } catch (erro) {
        alert(`Não foi possível salvar o pedido: ${erro.message}`);
        console.error(erro);
    } finally {
        botao.textContent = "Criar pedido para esta mesa";
        botao.disabled = !carrinho.length;
    }
}

/* =========================
   COMANDAS EXISTENTES
========================= */

async function carregarDados() {
    if (carregando) return;
    carregando = true;

    $("mensagem").textContent = "Carregando comandas...";

    try {
        comandas = await api(
            "comanda?select=*&status=eq.aberta&order=aberta_em.desc"
        ) || [];

        pedidosPorComanda = new Map();
        itensPorPedido = new Map();
        pratosPorId = new Map();

        comandas.forEach(c => {
            pedidosPorComanda.set(String(c.id), []);
        });

        if (comandas.length) {
            const ids = comandas.map(c => c.id);

            const pedidos = await api(
                `pedido?select=*&comanda_id=in.(${ids.join(",")})&order=criado_em.desc`
            ) || [];

            pedidos.forEach(p => {
                pedidosPorComanda.get(String(p.comanda_id))?.push(p);
                itensPorPedido.set(String(p.id), []);
            });

            const pedidoIds = pedidos.map(p => p.id);

            if (pedidoIds.length) {
                const itens = await api(
                    `item_pedido?select=*&pedido_id=in.(${pedidoIds.join(",")})&order=id.asc`
                ) || [];

                const pratoIds = [...new Set(itens.map(i => i.prato_id))];

                itens.forEach(item => {
                    itensPorPedido.get(String(item.pedido_id))?.push(item);
                });

                if (pratoIds.length) {
                    const dadosPratos = await api(
                        `prato?select=id,nome,preco&id=in.(${pratoIds.join(",")})`
                    ) || [];

                    dadosPratos.forEach(prato => {
                        pratosPorId.set(String(prato.id), prato);
                    });
                }
            }
        }

        atualizarResumo();
        renderizarComandas();

        $("mensagem").textContent = comandas.length
            ? ""
            : "Nenhuma comanda aberta no momento.";

        $("ultimaAtualizacao").textContent =
            `Atualizado às ${new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
            })}`;

    } catch (erro) {
        $("mensagem").textContent =
            `Erro ao carregar comandas: ${erro.message}`;

        console.error(erro);
    } finally {
        carregando = false;
    }
}

function statusMaisRelevante(pedidos) {
    const prioridade = [
        "aguardando_confirmacao",
        "recusado",
        "pronto",
        "preparando",
        "aceito",
        "entregue"
    ];

    return prioridade.find(status =>
        pedidos.some(p => p.status === status)
    ) || "sem_pedidos";
}

function rotuloStatus(status) {
    return ({
        aguardando_confirmacao: "Aguardando confirmação",
        aceito: "Aceito",
        preparando: "Preparando",
        pronto: "Pronto para servir",
        entregue: "Entregue",
        recusado: "Recusado",
        sem_pedidos: "Sem pedidos"
    })[status] || status;
}

function classeStatus(status) {
    if (status === "pronto") return "selo-pronto";

    if (["aceito", "preparando"].includes(status)) {
        return "selo-andamento";
    }

    if (status === "entregue") return "selo-entregue";

    return "";
}

function totalComanda(comanda) {
    const pedidos = pedidosPorComanda.get(String(comanda.id)) || [];

    return pedidos.reduce((total, pedido) => {
        const itens = itensPorPedido.get(String(pedido.id)) || [];

        return total + itens.reduce((soma, item) => {
            return soma + Number(
                item.subtotal ??
                Number(item.quantidade) * Number(item.preco_unitario)
            );
        }, 0);
    }, 0);
}

function atualizarResumo() {
    const todos = [...pedidosPorComanda.values()].flat();

    $("contadorAbertas").textContent =
        `${comandas.length} comandas abertas`;

    $("contAguardando").textContent =
        todos.filter(p => p.status === "aguardando_confirmacao").length;

    $("contAndamento").textContent =
        todos.filter(p =>
            ["aceito", "preparando"].includes(p.status)
        ).length;

    $("contProntos").textContent =
        todos.filter(p => p.status === "pronto").length;
}

function renderizarComandas() {
    const escolha = $("filtroStatus").value;

    const filtradas = comandas.filter(comanda => {
        const pedidos =
            pedidosPorComanda.get(String(comanda.id)) || [];

        if (escolha === "todas") return true;

        if (escolha === "andamento") {
            return pedidos.some(p =>
                ["aceito", "preparando"].includes(p.status)
            );
        }

        if (escolha === "pronto") {
            return pedidos.some(p => p.status === "pronto");
        }

        return pedidos.some(p => p.status === escolha);
    });

    if (!filtradas.length) {
        $("listaComandas").innerHTML = `
            <div class="vazio">
                <strong>Nenhuma comanda para mostrar</strong>
                As comandas abertas aparecerão aqui.
            </div>
        `;
        return;
    }

    $("listaComandas").innerHTML = filtradas.map(comanda => {
        const pedidos =
            pedidosPorComanda.get(String(comanda.id)) || [];

        const status = statusMaisRelevante(pedidos);

        const quantidade = pedidos.reduce((total, pedido) => {
            const itens =
                itensPorPedido.get(String(pedido.id)) || [];

            return total + itens.reduce(
                (soma, item) => soma + Number(item.quantidade), 0
            );
        }, 0);

        return `
            <article class="cartao-comanda">
                <div class="cartao-topo">
                    <div>
                        <h3 class="mesa-numero">
                            Mesa ${seguro(comanda.numero_mesa)}
                        </h3>
                        <div class="meta">
                            Aberta em ${dataHora(comanda.aberta_em)}
                        </div>
                    </div>

                    <span class="selo ${classeStatus(status)}">
                        ${seguro(rotuloStatus(status))}
                    </span>
                </div>

                <div class="cartao-corpo">
                    <div class="resumo-pedido">
                        <span>Pedidos</span>
                        <strong>${pedidos.length}</strong>
                    </div>

                    <div class="resumo-pedido">
                        <span>Itens solicitados</span>
                        <strong>${quantidade}</strong>
                    </div>

                    <div class="valor-total">
                        ${brl(totalComanda(comanda))}
                    </div>

                    <button
                        class="botao botao-primario botao-pequeno"
                        data-abrir="${comanda.id}">
                        Ver comanda
                    </button>
                </div>
            </article>
        `;
    }).join("");

    document.querySelectorAll("[data-abrir]").forEach(botao => {
        botao.addEventListener("click", () =>
            abrirComanda(botao.dataset.abrir)
        );
    });
}

function opcoesStatus(pedido) {
    let opcoes = [];

    if (pedido.status === "aguardando_confirmacao") {
        opcoes = [
            ["aceito", "Aceitar pedido"],
            ["recusado", "Recusar pedido"]
        ];
    } else if (pedido.status === "aceito") {
        opcoes = [
            ["preparando", "Marcar preparando"],
            ["recusado", "Recusar pedido"]
        ];
    } else if (pedido.status === "preparando") {
        opcoes = [["pronto", "Marcar pronto"]];
    } else if (pedido.status === "pronto") {
        opcoes = [["entregue", "Confirmar entrega"]];
    }

    return opcoes.map(([valor, rotulo]) => `
        <button
            class="botao botao-secundario botao-pequeno"
            data-status="${valor}"
            data-pedido="${pedido.id}">
            ${rotulo}
        </button>
    `).join("");
}


function abrirComanda(id) {
    comandaSelecionada = comandas.find(
        c => String(c.id) === String(id)
    );

    if (!comandaSelecionada) return;

    const modalElemento = $("modalComanda");

    $("tituloModal").textContent =
        `Mesa ${comandaSelecionada.numero_mesa}`;

    const pedidos =
        pedidosPorComanda.get(String(id)) || [];

    if (!pedidos.length) {
        $("detalhesComanda").innerHTML = `
            <div class="vazio">
                <strong>Nenhum pedido registrado</strong>
                Esta comanda ainda não possui pedidos.
            </div>
        `;
    } else {
        $("detalhesComanda").innerHTML = `
            <div class="detalhes-resumo">
                <div>
                    <span>Mesa</span>
                    <strong>${seguro(comandaSelecionada.numero_mesa)}</strong>
                </div>
                <div>
                    <span>Pedidos</span>
                    <strong>${pedidos.length}</strong>
                </div>
                <div>
                    <span>Total da comanda</span>
                    <strong>${brl(totalComanda(comandaSelecionada))}</strong>
                </div>
                <div>
                    <span>Aberta em</span>
                    <strong>${dataHora(comandaSelecionada.aberta_em)}</strong>
                </div>
            </div>

            <h3 class="titulo-pedidos">Pedidos desta mesa</h3>

            ${pedidos.map(pedido => {
                const itens =
                    itensPorPedido.get(String(pedido.id)) || [];

                const totalPedido = itens.reduce((soma, item) => {
                    return soma + Number(
                        item.subtotal ??
                        Number(item.quantidade) *
                        Number(item.preco_unitario)
                    );
                }, 0);

                return `
                    <section class="pedido-bloco">
                        <div class="pedido-cabecalho">
                            <div>
                                <h3>Pedido #${pedido.id}</h3>
                                <span class="meta">
                                    Registrado em ${dataHora(pedido.criado_em)}
                                </span>
                            </div>

                            <span class="selo ${classeStatus(pedido.status)}">
                                ${seguro(rotuloStatus(pedido.status))}
                            </span>
                        </div>

                        <h4 class="subtitulo-itens">Itens do pedido</h4>

                        <div class="tabela-itens">
                            ${itens.map(item => {
                                const prato = pratosPorId.get(
                                    String(item.prato_id)
                                );

                                const nome = prato?.nome ||
                                    `Prato #${item.prato_id}`;

                                const subtotal = item.subtotal ??
                                    Number(item.quantidade) *
                                    Number(item.preco_unitario);

                                return `
                                    <div class="linha-item">
                                        <div>
                                            <strong>${seguro(nome)}</strong>
                                            <small>
                                                ${item.quantidade} ×
                                                ${brl(item.preco_unitario)}
                                            </small>
                                        </div>

                                        <strong>${brl(subtotal)}</strong>
                                    </div>
                                `;
                            }).join("")}
                        </div>

                        <div class="total-pedido">
                            <span>Total do pedido</span>
                            <strong>${brl(totalPedido)}</strong>
                        </div>

                        <div class="editar-status">
                            <label for="status-${pedido.id}">
                                Alterar status deste pedido
                            </label>

                            <div class="editar-status-controles">
                                <select id="status-${pedido.id}">
                                    <option value="aguardando_confirmacao"
                                        ${pedido.status === "aguardando_confirmacao" ? "selected" : ""}>
                                        Aguardando confirmação
                                    </option>

                                    <option value="aceito"
                                        ${pedido.status === "aceito" ? "selected" : ""}>
                                        Aceito
                                    </option>

                                    <option value="preparando"
                                        ${pedido.status === "preparando" ? "selected" : ""}>
                                        Preparando
                                    </option>

                                    <option value="pronto"
                                        ${pedido.status === "pronto" ? "selected" : ""}>
                                        Pronto para servir
                                    </option>

                                    <option value="entregue"
                                        ${pedido.status === "entregue" ? "selected" : ""}>
                                        Entregue
                                    </option>

                                    <option value="recusado"
                                        ${pedido.status === "recusado" ? "selected" : ""}>
                                        Recusado
                                    </option>
                                </select>

                                <button
                                    type="button"
                                    class="botao botao-primario botao-pequeno"
                                    data-salvar-status="${pedido.id}">
                                    Salvar status
                                </button>
                            </div>
                        </div>
                    </section>
                `;
            }).join("")}
        `;
    }

    // Liga os botões de salvar status
    $("detalhesComanda")
        .querySelectorAll("[data-salvar-status]")
        .forEach(botao => {
            botao.addEventListener("click", () => {
                const pedidoId = botao.dataset.salvarStatus;
                const novoStatus = $(`status-${pedidoId}`).value;

                atualizarStatus(pedidoId, novoStatus);
            });
        });

    const podeEncerrar = pedidos.every(p =>
        ["entregue", "recusado"].includes(p.status)
    );

    $("encerrarBtn").disabled = !podeEncerrar;

    if (!modalElemento.open) {
        modalElemento.showModal();
    }
}

async function atualizarStatus(pedidoId, status) {
    if (!confirm(
        `Alterar o pedido para "${rotuloStatus(status)}"?`
    )) return;

    try {
        await api(`pedido?id=eq.${encodeURIComponent(pedidoId)}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
                status,
                atualizado_em: new Date().toISOString()
            })
        });

        const idComanda = comandaSelecionada?.id;

        await carregarDados();

        if (idComanda) {
            const aindaAberta = comandas.find(
                c => String(c.id) === String(idComanda)
            );

            if (aindaAberta) {
                abrirComanda(idComanda);
            } else {
                modal.close();
                comandaSelecionada = null;
            }
        }

    } catch (erro) {
        alert(`Erro ao atualizar pedido: ${erro.message}`);
        console.error(erro);
    }
}

/* Fecha a comanda, mas NÃO exclui o histórico. */

async function encerrarComanda() {
    if (!comandaSelecionada) return;

    const pedidos =
        pedidosPorComanda.get(String(comandaSelecionada.id)) || [];

    if (pedidos.some(p =>
        !["entregue", "recusado"].includes(p.status)
    )) {
        alert(
            "Todos os pedidos precisam estar entregues ou recusados antes de encerrar."
        );
        return;
    }

    if (!confirm(
        `Encerrar a comanda da mesa ${comandaSelecionada.numero_mesa}? O histórico será mantido.`
    )) return;

    try {
        await api(
            `comanda?id=eq.${encodeURIComponent(comandaSelecionada.id)}&status=eq.aberta`,
            {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify({
                    status: "fechada",
                    fechada_em: new Date().toISOString()
                })
            }
        );

        modal.close();
        comandaSelecionada = null;

        await carregarDados();

    } catch (erro) {
        alert(`Erro ao encerrar comanda: ${erro.message}`);
        console.error(erro);
    }
}

/* =========================
   EVENTOS E INICIALIZAÇÃO
========================= */

$("pesquisaPratos").addEventListener("input", renderizarPratos);

$("confirmarComandaBtn").addEventListener(
    "click",
    criarPedidoGarcom
);

$("atualizarBtn").addEventListener("click", async () => {
    await carregarPratos();
    await carregarDados();
});

$("filtroStatus").addEventListener("change", renderizarComandas);

$("fecharModal").addEventListener("click", () => {
    $("modalComanda").close();
});

$("encerrarBtn").addEventListener("click", encerrarComanda);

renderizarCarrinho();
carregarPratos();
carregarDados();

setInterval(carregarDados, 30000);
