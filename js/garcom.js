/* Painel independente dos garçons. Usa o projeto Supabase do cardápio. */

const SUPABASE_URL = "https://fmwmgoxjmcvsmfbcpfsj.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZJR2Z6gOfNO5rFhZb-RWwg_qvyY2b9Y";

const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json"
};

const lista = document.getElementById("listaComandas");
const mensagem = document.getElementById("mensagem");
const filtro = document.getElementById("filtroStatus");
const modal = document.getElementById("modalComanda");

let comandas = [];
let comandaSelecionada = null;
let pedidosPorComanda = new Map();
let itensPorPedido = new Map();
let pratosPorId = new Map();

const brl = valor =>
    Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

const dataHora = valor =>
    valor
        ? new Date(valor).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short"
          })
        : "—";

const textoSeguro = valor =>
    String(valor ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);

async function api(caminho, opcoes = {}) {
    const resposta = await fetch(
        `${SUPABASE_URL}/rest/v1/${caminho}`,
        {
            ...opcoes,
            headers: {
                ...headers,
                ...(opcoes.headers || {})
            }
        }
    );

    const corpo = await resposta.text();

    if (!resposta.ok) {
        throw new Error(
            `Supabase (${resposta.status}): ${corpo || resposta.statusText}`
        );
    }

    return corpo ? JSON.parse(corpo) : null;
}

async function carregarDados() {
    mensagem.textContent = "Carregando comandas do Supabase...";

    try {
        const abertas = await api(
            "comanda?select=*&status=eq.aberta&order=aberta_em.desc"
        );

        comandas = abertas || [];

        if (!comandas.length) {
            pedidosPorComanda = new Map();
            itensPorPedido = new Map();
            pratosPorId = new Map();

            atualizarResumo();
            renderizar();

            mensagem.textContent = "Nenhuma comanda aberta no momento.";

            document.getElementById("ultimaAtualizacao").textContent =
                `Atualizado às ${new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                })}`;

            return;
        }

        const comandaIds = comandas.map(comanda => comanda.id);

        const pedidos = await api(
            `pedido?select=*&comanda_id=in.(${comandaIds.join(",")})&order=criado_em.desc`
        );

        pedidosPorComanda = new Map(
            comandas.map(comanda => [String(comanda.id), []])
        );

        (pedidos || []).forEach(pedido => {
            const chave = String(pedido.comanda_id);

            if (!pedidosPorComanda.has(chave)) {
                pedidosPorComanda.set(chave, []);
            }

            pedidosPorComanda.get(chave).push(pedido);
        });

        const pedidoIds = (pedidos || []).map(pedido => pedido.id);

        itensPorPedido = new Map(
            (pedidos || []).map(pedido => [String(pedido.id), []])
        );

        pratosPorId = new Map();

        if (pedidoIds.length) {
            const itens = await api(
                `item_pedido?select=*&pedido_id=in.(${pedidoIds.join(",")})&order=id.asc`
            );

            const pratoIds = [
                ...new Set((itens || []).map(item => item.prato_id))
            ];

            (itens || []).forEach(item => {
                const chave = String(item.pedido_id);

                if (!itensPorPedido.has(chave)) {
                    itensPorPedido.set(chave, []);
                }

                itensPorPedido.get(chave).push(item);
            });

            if (pratoIds.length) {
                const pratos = await api(
                    `prato?select=id,nome,preco,preco_pequeno,preco_medio,preco_grande&id=in.(${pratoIds.join(",")})`
                );

                (pratos || []).forEach(prato => {
                    pratosPorId.set(String(prato.id), prato);
                });
            }
        }

        atualizarResumo();
        renderizar();

        mensagem.textContent = "";

        document.getElementById("ultimaAtualizacao").textContent =
            `Atualizado às ${new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
            })}`;

    } catch (erro) {
        mensagem.textContent =
            `Não foi possível carregar as comandas. ${erro.message}. ` +
            "Verifique as políticas de SELECT nas tabelas comanda, pedido, item_pedido e prato.";

        lista.innerHTML = "";
        console.error("Erro ao carregar comandas:", erro);
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
        pedidos.some(pedido => pedido.status === status)
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
    if (status === "pronto") {
        return "selo-pronto";
    }

    if (["aceito", "preparando"].includes(status)) {
        return "selo-andamento";
    }

    if (status === "entregue") {
        return "selo-entregue";
    }

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
    const todosPedidos = [...pedidosPorComanda.values()].flat();

    document.getElementById("contadorAbertas").textContent =
        `${comandas.length} ${
            comandas.length === 1
                ? "comanda aberta"
                : "comandas abertas"
        }`;

    document.getElementById("contAguardando").textContent =
        todosPedidos.filter(
            pedido => pedido.status === "aguardando_confirmacao"
        ).length;

    document.getElementById("contAndamento").textContent =
        todosPedidos.filter(
            pedido => ["aceito", "preparando"].includes(pedido.status)
        ).length;

    document.getElementById("contProntos").textContent =
        todosPedidos.filter(
            pedido => pedido.status === "pronto"
        ).length;
}

function renderizar() {
    const escolha = filtro.value;

    const filtradas = comandas.filter(comanda => {
        if (escolha === "todas") {
            return true;
        }

        const pedidos =
            pedidosPorComanda.get(String(comanda.id)) || [];

        if (escolha === "andamento") {
            return pedidos.some(pedido =>
                ["aceito", "preparando"].includes(pedido.status)
            );
        }

        if (escolha === "pronto") {
            return pedidos.some(pedido => pedido.status === "pronto");
        }

        return pedidos.some(pedido => pedido.status === escolha);
    });

    if (!filtradas.length) {
        lista.innerHTML = `
            <div class="vazio">
                <strong>Nenhuma comanda para mostrar</strong>
                Quando uma mesa fizer um pedido, ela aparecerá aqui.
            </div>
        `;
        return;
    }

    lista.innerHTML = filtradas.map(comanda => {
        const pedidos =
            pedidosPorComanda.get(String(comanda.id)) || [];

        const status = statusMaisRelevante(pedidos);

        const quantidadeItens = pedidos.reduce((total, pedido) => {
            const itens =
                itensPorPedido.get(String(pedido.id)) || [];

            return total + itens.reduce(
                (soma, item) => soma + Number(item.quantidade),
                0
            );
        }, 0);

        return `
            <article class="cartao-comanda">
                <div class="cartao-topo">
                    <div>
                        <h3 class="mesa-numero">
                            Mesa ${textoSeguro(comanda.numero_mesa)}
                        </h3>
                        <div class="meta">
                            Aberta em ${dataHora(comanda.aberta_em)}
                        </div>
                    </div>

                    <span class="selo ${classeStatus(status)}">
                        ${textoSeguro(rotuloStatus(status))}
                    </span>
                </div>

                <div class="cartao-corpo">
                    <div class="resumo-pedido">
                        <span>Pedidos enviados</span>
                        <strong>${pedidos.length}</strong>
                    </div>

                    <div class="resumo-pedido">
                        <span>Itens solicitados</span>
                        <strong>${quantidadeItens}</strong>
                    </div>

                    <div class="valor-total">
                        ${brl(totalComanda(comanda))}
                    </div>

                    <div class="acoes-cartao">
                        <button
                            class="botao botao-primario botao-pequeno"
                            data-abrir="${comanda.id}"
                        >
                            Ver comanda
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");

    lista.querySelectorAll("[data-abrir]").forEach(botao => {
        botao.addEventListener("click", () => {
            abrirComanda(botao.dataset.abrir);
        });
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
        opcoes = [
            ["pronto", "Marcar pronto"]
        ];
    } else if (pedido.status === "pronto") {
        opcoes = [
            ["entregue", "Confirmar entrega"]
        ];
    }

    return opcoes.map(([valor, rotulo]) => `
        <button
            class="botao ${
                valor === "recusado"
                    ? "botao-neutro"
                    : "botao-secundario"
            } botao-pequeno"
            data-status="${valor}"
            data-pedido="${pedido.id}"
        >
            ${rotulo}
        </button>
    `).join("");
}

function abrirComanda(id) {
    comandaSelecionada = comandas.find(
        comanda => String(comanda.id) === String(id)
    );

    if (!comandaSelecionada) {
        return;
    }

    document.getElementById("tituloModal").textContent =
        `Mesa ${comandaSelecionada.numero_mesa}`;

    const pedidos = pedidosPorComanda.get(String(id)) || [];

    document.getElementById("detalhesComanda").innerHTML =
        pedidos.map(pedido => {
            const itens =
                itensPorPedido.get(String(pedido.id)) || [];

            const linhas = itens.map(item => {
                const prato = pratosPorId.get(String(item.prato_id));

                const nomePrato =
                    prato?.nome || `Prato #${item.prato_id}`;

                const tamanho = item.tamanho
                    ? ` (${textoSeguro(item.tamanho)})`
                    : "";

                const subtotal = item.subtotal ??
                    Number(item.quantidade) * Number(item.preco_unitario);

                return `
                    <li>
                        ${textoSeguro(item.quantidade)} ×
                        ${textoSeguro(nomePrato)}
                        ${tamanho} — ${brl(subtotal)}
                    </li>
                `;
            }).join("");

            const totalPedido = itens.reduce((soma, item) => {
                return soma + Number(
                    item.subtotal ??
                    Number(item.quantidade) * Number(item.preco_unitario)
                );
            }, 0);

            return `
                <section class="pedido-bloco">
                    <div class="pedido-cabecalho">
                        <div>
                            <h3>Pedido #${pedido.id}</h3>
                            <span class="meta">
                                ${dataHora(pedido.criado_em)}
                            </span>
                        </div>

                        <span class="selo ${classeStatus(pedido.status)}">
                            ${textoSeguro(rotuloStatus(pedido.status))}
                        </span>
                    </div>

                    <ul class="pedido-itens">
                        ${linhas || "<li>Itens não encontrados</li>"}
                    </ul>

                    <p>
                        <strong>Total: ${brl(totalPedido)}</strong>
                    </p>

                    <div class="acoes-cartao">
                        ${opcoesStatus(pedido)}
                    </div>
                </section>
            `;
        }).join("") || `
            <div class="vazio">
                <strong>Esta comanda ainda não tem pedidos</strong>
            </div>
        `;

    const botaoEncerrar = document.getElementById("encerrarBtn");

    botaoEncerrar.disabled = pedidos.some(pedido =>
        !["entregue", "recusado"].includes(pedido.status)
    );

    botaoEncerrar.title = botaoEncerrar.disabled
        ? "Todos os pedidos precisam estar entregues ou recusados para encerrar."
        : "Encerrar e manter o histórico da comanda";

    document.querySelectorAll("[data-status]").forEach(botao => {
        botao.addEventListener("click", () => {
            atualizarStatus(
                botao.dataset.pedido,
                botao.dataset.status
            );
        });
    });

    modal.showModal();
}

async function atualizarStatus(pedidoId, status) {
    if (!confirm(
        `Confirmar alteração do pedido #${pedidoId} para "${rotuloStatus(status)}"?`
    )) {
        return;
    }

    try {
        await api(
            `pedido?id=eq.${encodeURIComponent(pedidoId)}`,
            {
                method: "PATCH",
                headers: {
                    Prefer: "return=minimal"
                },
                body: JSON.stringify({
                    status,
                    atualizado_em: new Date().toISOString()
                })
            }
        );

        await carregarDados();

        if (comandaSelecionada) {
            abrirComanda(comandaSelecionada.id);
        }

    } catch (erro) {
        alert(`Não foi possível atualizar o pedido. ${erro.message}`);
        console.error("Erro ao atualizar pedido:", erro);
    }
}

async function encerrarComanda() {
    if (!comandaSelecionada) {
        return;
    }

    const pedidos =
        pedidosPorComanda.get(String(comandaSelecionada.id)) || [];

    if (pedidos.some(pedido =>
        !["entregue", "recusado"].includes(pedido.status)
    )) {
        alert(
            "Antes de encerrar, todos os pedidos precisam estar entregues ou recusados."
        );
        return;
    }

    if (!confirm(
        `Encerrar a comanda da mesa ${comandaSelecionada.numero_mesa}? O histórico será mantido no banco de dados.`
    )) {
        return;
    }

    try {
        await api(
            `comanda?id=eq.${encodeURIComponent(comandaSelecionada.id)}&status=eq.aberta`,
            {
                method: "PATCH",
                headers: {
                    Prefer: "return=minimal"
                },
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
        alert(`Não foi possível encerrar a comanda. ${erro.message}`);
        console.error("Erro ao encerrar comanda:", erro);
    }
}

document.getElementById("atualizarBtn")
    .addEventListener("click", carregarDados);

filtro.addEventListener("change", renderizar);

document.getElementById("fecharModal")
    .addEventListener("click", () => modal.close());

document.getElementById("encerrarBtn")
    .addEventListener("click", encerrarComanda);

carregarDados();

setInterval(carregarDados, 30000);
