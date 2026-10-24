/* Painel independente dos garçons. Usa o projeto Supabase do cardápio. */
const SUPABASE_URL = "https://fmwmgoxjmcvsmfbcpfsj.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZJR2Z6gOfNO5rFhZb-RWwg_qvyY2b9Y";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const lista = document.getElementById("listaComandas");
const mensagem = document.getElementById("mensagem");
const filtro = document.getElementById("filtroStatus");
const modal = document.getElementById("modalComanda");
let comandas = [];
let comandaSelecionada = null;
let pedidosPorComanda = new Map();
let itensPorPedido = new Map();
let pratosPorId = new Map();
const brl = valor => Number(valor || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
const dataHora = valor => valor ? new Date(valor).toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"}) : "—";
const textoSeguro = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path, options={}) {
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: {...headers, ...(options.headers||{})} });
  const corpo = await resposta.text();
  if (!resposta.ok) throw new Error(`Supabase (${resposta.status}): ${corpo || resposta.statusText}`);
  return corpo ? JSON.parse(corpo) : null;
}
async function carregarDados() {
  mensagem.textContent = "Carregando comandas do Supabase...";
  try {
    const abertas = await api("comanda?select=*&status=eq.aberta&order=aberta_em.desc");
    comandas = abertas || [];
    if (!comandas.length) {
      pedidosPorComanda = new Map(); itensPorPedido = new Map(); pratosPorId = new Map();
      atualizarResumo(); renderizar();
      mensagem.textContent = "Nenhuma comanda aberta no momento.";
      document.getElementById("ultimaAtualizacao").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
      return;
    }
    const comandaIds = comandas.map(c=>c.id);
    const pedidos = await api(`pedido?select=*&comanda_id=in.(${comandaIds.join(",")})&order=criado_em.desc`);
    pedidosPorComanda = new Map(comandas.map(c=>[String(c.id), []]));
    (pedidos||[]).forEach(p=>{ const k=String(p.comanda_id); if(!pedidosPorComanda.has(k)) pedidosPorComanda.set(k,[]); pedidosPorComanda.get(k).push(p); });
    const pedidoIds = (pedidos||[]).map(p=>p.id);
    itensPorPedido = new Map((pedidos||[]).map(p=>[String(p.id),[]]));
    pratosPorId = new Map();
    if (pedidoIds.length) {
      const itens = await api(`item_pedido?select=*&pedido_id=in.(${pedidoIds.join(",")})&order=id.asc`);
      const pratoIds = [...new Set((itens||[]).map(i=>i.prato_id))];
      (itens||[]).forEach(i=>{ const k=String(i.pedido_id); if(!itensPorPedido.has(k)) itensPorPedido.set(k,[]); itensPorPedido.get(k).push(i); });
      if (pratoIds.length) {
        const pratos = await api(`prato?select=id,nome,preco,preco_pequeno,preco_medio,preco_grande&id=in.(${pratoIds.join(",")})`);
        (pratos||[]).forEach(p=>pratosPorId.set(String(p.id),p));
      }
    }
    atualizarResumo(); renderizar(); mensagem.textContent = "";
    document.getElementById("ultimaAtualizacao").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`;
  } catch (erro) {
    mensagem.textContent = `Não foi possível carregar as comandas. ${erro.message}. Verifique SELECT/RLS nas tabelas comanda, pedido, item_pedido e prato.`;
    lista.innerHTML = "";
  }
}
function statusMaisRelevante(pedidos) {
  const prioridade = ["aguardando_confirmacao","recusado","pronto","preparando","aceito","entregue"];
  return prioridade.find(s=>pedidos.some(p=>p.status===s)) || "sem_pedidos";
}
function rotuloStatus(status) { return ({aguardando_confirmacao:"Aguardando confirmação",aceito:"Aceito",preparando:"Preparando",pronto:"Pronto para servir",entregue:"Entregue",recusado:"Recusado",sem_pedidos:"Sem pedidos"})[status] || status; }
function classeStatus(status) { return ["pronto"].includes(status)?"selo-pronto":["aceito","preparando"].includes(status)?"selo-andamento":["entregue"].includes(status)?"selo-entregue":""; }
function totalComanda(comanda) { return (pedidosPorComanda.get(String(comanda.id))||[]).reduce((s,p)=>s+(itensPorPedido.get(String(p.id))||[]).reduce((a,i)=>a+Number(i.subtotal ?? Number(i.quantidade)*Number(i.preco_unitario)),0),0); }
function atualizarResumo() {
  const todos = [...pedidosPorComanda.values()].flat();
  document.getElementById("contadorAbertas").textContent = `${comandas.length} ${comandas.length===1?"comanda aberta":"comandas abertas"}`;
  document.getElementById("contAguardando").textContent = todos.filter(p=>p.status==="aguardando_confirmacao").length;
  document.getElementById("contAndamento").textContent = todos.filter(p=>["aceito","preparando"].includes(p.status)).length;
  document.getElementById("contProntos").textContent = todos.filter(p=>p.status==="pronto").length;
}
function renderizar() {
  const escolha=filtro.value;
  const filtradas=comandas.filter(c=>{ if(escolha==="todas") return true; const ps=pedidosPorComanda.get(String(c.id))||[]; if(escolha==="andamento") return ps.some(p=>["aceito","preparando"].includes(p.status)); if(escolha==="pronto") return ps.some(p=>p.status==="pronto"); return ps.some(p=>p.status===escolha); });
  if(!filtradas.length){lista.innerHTML='<div class="vazio"><strong>Nenhuma comanda para mostrar</strong>Quando uma mesa fizer um pedido, ela aparecerá aqui.</div>';return;}
  lista.innerHTML=filtradas.map(c=>{
    const ps=pedidosPorComanda.get(String(c.id))||[]; const st=statusMaisRelevante(ps); const qtd=ps.reduce((n,p)=>n+(itensPorPedido.get(String(p.id))||[]).reduce((a,i)=>a+Number(i.quantidade),0),0);
    return `<article class="cartao-comanda"><div class="cartao-topo"><div><h3 class="mesa-numero">Mesa ${textoSeguro(c.numero_mesa)}</h3><div class="meta">Aberta em ${dataHora(c.aberta_em)}</div></div><span class="selo ${classeStatus(st)}">${textoSeguro(rotuloStatus(st))}</span></div><div class="cartao-corpo"><div class="resumo-pedido"><span>Pedidos enviados</span><strong>${ps.length}</strong></div><div class="resumo-pedido"><span>Itens solicitados</span><strong>${qtd}</strong></div><div class="valor-total">${brl(totalComanda(c))}</div><div class="acoes-cartao"><button class="botao botao-primario botao-pequeno" data-abrir="${c.id}">Ver comanda</button></div></div></article>`;
  }).join("");
  lista.querySelectorAll("[data-abrir]").forEach(b=>b.addEventListener("click",()=>abrirComanda(b.dataset.abrir)));
}
function opcoesStatus(pedido) {
  const opcoes = pedido.status==="aguardando_confirmacao" ? [["aceito","Aceitar pedido"],["recusado","Recusar pedido"]] : pedido.status==="aceito" ? [["preparando","Marcar preparando"],["recusado","Recusar pedido"]] : pedido.status==="preparando" ? [["pronto","Marcar pronto"]] : pedido.status==="pronto" ? [["entregue","Confirmar entrega"]] : [];
  return opcoes.map(([v,t])=>`<button class="botao ${v==="recusado"?"botao-neutro":"botao-secundario"} botao-pequeno" data-status="${v}" data-pedido="${pedido.id}">${t}</button>`).join("");
}
function abrirComanda(id) {
  comandaSelecionada=comandas.find(c=>String(c.id)===String(id)); if(!comandaSelecionada)return;
  document.getElementById("tituloModal").textContent=`Mesa ${comandaSelecionada.numero_mesa}`;
  document.getElementById("detalhesComanda").innerHTML=(pedidosPorComanda.get(String(id))||[]).map(p=>{
    const itens=itensPorPedido.get(String(p.id))||[];
    const linhas=itens.map(i=>{const prato=pratosPorId.get(String(i.prato_id));return `<li>${textoSeguro(i.quantidade)} × ${textoSeguro(prato?.nome||`Prato #${i.prato_id}`)}${i.tamanho?` (${textoSeguro(i.tamanho)})`:""} — ${brl(i.subtotal ?? Number(i.quantidade)*Number(i.preco_unitario))}</li>`}).join("");
    return `<section class="pedido-bloco"><div class="pedido-cabecalho"><div><h3>Pedido #${p.id}</h3><span class="meta">${dataHora(p.criado_em)}</span></div><span class="selo ${classeStatus(p.status)}">${textoSeguro(rotuloStatus(p.status))}</span></div><ul class="pedido-itens">${linhas||"<li>Itens não encontrados</li>"}</ul><p><strong>Total: ${brl(itens.reduce((s,i)=>s+Number(i.subtotal ?? Number(i.quantidade)*Number(i.preco_unitario)),0))}</strong></p><div class="acoes-cartao">${opcoesStatus(p)}</div></section>`;
  }).join("") || '<div class="vazio"><strong>Esta comanda ainda não tem pedidos</strong></div>';
  document.getElementById("encerrarBtn").disabled=(pedidosPorComanda.get(String(id))||[]).some(p=>!["entregue","recusado"].includes(p.status));
  document.getElementById("encerrarBtn").title=document.getElementById("encerrarBtn").disabled?"Todos os pedidos precisam estar entregues ou recusados para encerrar.":"Encerrar e manter o histórico da comanda";
  document.querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",()=>atualizarStatus(b.dataset.pedido,b.dataset.status)));
  modal.showModal();
}
async function atualizarStatus(pedidoId,status) {
  if(!confirm(`Confirmar alteração do pedido #${pedidoId} para “${rotuloStatus(status)}”?`))return;
  try { await api(`pedido?id=eq.${encodeURIComponent(pedidoId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status,atualizado_em:new Date().toISOString()})}); await carregarDados(); if(comandaSelecionada)abrirComanda(comandaSelecionada.id); }
  catch(e){alert(`Não foi possível atualizar o pedido. ${e.message}`)}
}
async function encerrarComanda() {
  if(!comandaSelecionada)return;
  const ps=pedidosPorComanda.get(String(comandaSelecionada.id))||[];
  if(ps.some(p=>!["entregue","recusado"].includes(p.status))){alert("Antes de encerrar, todos os pedidos precisam estar entregues ou recusados.");return;}
  if(!confirm(`Encerrar a comanda da mesa ${comandaSelecionada.numero_mesa}? O histórico será mantido no banco de dados.`))return;
  try { await api(`comanda?id=eq.${encodeURIComponent(comandaSelecionada.id)}&status=eq.aberta`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"fechada",fechada_em:new Date().toISOString()})}); modal.close();comandaSelecionada=null;await carregarDados(); }
  catch(e){alert(`Não foi possível encerrar a comanda. ${e.message}`)}
}
document.getElementById("atualizarBtn").addEventListener("click",carregarDados);
filtro.addEventListener("change",renderizar);
document.getElementById("fecharModal").addEventListener("click",()=>modal.close());
document.getElementById("encerrarBtn").addEventListener("click",encerrarComanda);
carregarDados();
setInterval(carregarDados,30000);
