// BRAWLMON 3D — HTML + CSS + JavaScript (Three.js)
// Gustavo 5ºA, João 5ºA, Enzo 5ºB e Joaquim 5ºA
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = "brawlmon_save_v1";

  let save = { desbloqueados: [0], trofeus: 0, selecionado: 0, missoes: {}, stats: { vitorias: 0, gols: 0, vitoriasSobre: 0, gemas: 0, supers: 0, kills: 0 } };
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) save = Object.assign(save, JSON.parse(raw)); } catch (e) {}
  function salvar() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  function custoProximo() { return save.desbloqueados.length * 5; }
  function tentarDesbloquear() {
    let mudou = false;
    while (save.desbloqueados.length < 65 && save.trofeus >= custoProximo()) {
      save.trofeus -= custoProximo();
      save.desbloqueados.push(save.desbloqueados.length);
      mudou = true;
    }
    if (mudou) salvar();
    return mudou;
  }

  // ---------- TELAS ----------
  const telas = { inicial: $("tela-inicial"), escolha: $("tela-escolha"), jogo: $("tela-jogo") };
  function mostrar(nome) { Object.values(telas).forEach((t) => t.classList.remove("ativa")); telas[nome].classList.add("ativa"); }

  const EMOJI_TIPO = { eletrico: "⚡", fogo: "🔥", agua: "💧", planta: "🌿", inseto: "🐞", venenoso: "☠️", gelo: "❄️", fantasma: "👻", fada: "🧚", dragao: "🐉", aco: "🛡️", voador: "🦅", psiquico: "🔮", terrestre: "⛰️", pedra: "🪨", sombrio: "🌑", lutador: "🥊", normal: "⭐" };

  function renderEscolha() {
    $("trofeus").textContent = "🏆 " + save.trofeus + " (próx: " + custoProximo() + ")";
    const grid = $("lista-brawlers"); grid.innerHTML = "";
    BRAWLERS.forEach((b) => {
      const desbloq = save.desbloqueados.includes(b.id);
      const d = document.createElement("div");
      d.className = "card" + (b.id === save.selecionado ? " selecionado" : "") + (desbloq ? "" : " bloqueado");
      d.style.background = "linear-gradient(160deg," + b.cor + "cc,#111)";
      d.innerHTML = '<div class="emoji">' + (EMOJI_TIPO[b.tipo] || "⭐") + "</div><b>" + b.nome + "</b><br>" +
        '<span class="tipo">' + TIPOS[b.tipo].nome + "</span><br>" +
        '<span class="vida">❤️' + b.vida + " • 🔥" + b.ataque + "<br>⚡" + b.super + "<br>🔫" + b.arma + "</span>" +
        (desbloq ? "" : "<br>🔒 " + custoProximo() + "🏆");
      if (desbloq) d.onclick = () => { save.selecionado = b.id; salvar(); renderEscolha(); };
      grid.appendChild(d);
    });
    const lm = $("lista-missoes"); lm.innerHTML = "";
    MISSOES.forEach((m) => {
      const prog = progressoMissao(m.id);
      const pronta = prog >= m.meta && !save.missoes[m.id];
      const resgatada = !!save.missoes[m.id];
      const div = document.createElement("div");
      div.className = "missao" + (pronta ? " pronta" : "");
      div.innerHTML = "<span><b>" + m.nome + "</b> — " + m.desc + " (" + Math.min(prog, m.meta) + "/" + m.meta + ")</span><b>" + (resgatada ? "✅" : "+" + m.trofeus + "🏆") + "</b>";
      if (pronta) { div.style.cursor = "pointer"; div.onclick = () => { save.missoes[m.id] = true; save.trofeus += m.trofeus; tentarDesbloquear(); salvar(); renderEscolha(); }; }
      lm.appendChild(div);
    });
    $("resumo-save") && ($("resumo-save").textContent = "🏆 " + save.trofeus + " • " + save.desbloqueados.length + "/65 brawlers • Selecionado: " + BRAWLERS[save.selecionado].nome);
  }
  function progressoMissao(id) {
    const s = save.stats;
    if (id === "m1") return s.vitorias;
    if (id === "m2") return s.gols;
    if (id === "m3") return s.vitoriasSobre;
    if (id === "m4") return s.gemas;
    if (id === "m5") return s.supers;
    if (id === "m6") return s.kills;
    return 0;
  }

  $("btn-jogar").onclick = () => { renderEscolha(); mostrar("escolha"); };
  $("btn-voltar-inicio").onclick = () => mostrar("inicial");
  document.querySelectorAll(".btn-modo").forEach((b) => { b.onclick = () => iniciarPartida(b.dataset.modo); });
  $("btn-sair").onclick = () => { encerrar = true; renderEscolha(); mostrar("escolha"); };
  $("btn-atacar").onclick = () => atacarJogador();
  $("btn-super").onclick = () => superJogador();

  // ---------- MOTOR 3D ----------
  let scene, camera, renderer, clock, lutadores = [], projeteis = [], gemas = [], bola = null, gols = { azul: 0, vermelho: 0 }, encerrar = false, modoAtual = "sobrevivencia", tempoRestante = 300, gemasTime = { azul: 0, vermelho: 0 }, contagemGema = 0, liderGema = null, tempoLiderGema = 20, nevoa = null;
  const DURACAO_PARTIDA = 300; // 5 minutos por partida
  const TEMPO_LIDER_GEMA = 20; // quem tiver mais gemas por 20s vence no Pique-Gema
  const teclas = {};
  window.addEventListener("keydown", (e) => { teclas[e.key.toLowerCase()] = true; if (e.key === " ") { e.preventDefault(); atacarJogador(); } if (e.key.toLowerCase() === "e") superJogador(); });
  window.addEventListener("keyup", (e) => { teclas[e.key.toLowerCase()] = false; });

  // joystick touch
  const joy = $("joy"); let joyDx = 0, joyDy = 0, joyAtivo = false;
  if (joy) {
    const miolo = joy.querySelector(".joy-miolo");
    joy.addEventListener("pointerdown", (e) => { joyAtivo = true; joy.setPointerCapture(e.pointerId); });
    joy.addEventListener("pointermove", (e) => {
      if (!joyAtivo) return;
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      dx = Math.max(-35, Math.min(35, dx)); dy = Math.max(-35, Math.min(35, dy));
      joyDx = dx / 35; joyDy = dy / 35;
      miolo.style.left = 25 + dx + "px"; miolo.style.top = 25 + dy + "px";
    });
    const soltar = () => { joyAtivo = false; joyDx = 0; joyDy = 0; miolo.style.left = "25px"; miolo.style.top = "25px"; };
    joy.addEventListener("pointerup", soltar); joy.addEventListener("pointercancel", soltar);
  }

  function limparCena() {
    const el = $("game3d"); el.innerHTML = "";
    if (renderer) { try { renderer.dispose(); } catch (e) {} }
    lutadores = []; projeteis = []; gemas = []; bola = null; nevoa = null;
  }

  function criarLutador(dadosBrawler, time, x, z, ehJogador) {
    const g = new THREE.Group();
    const cor = new THREE.Color(dadosBrawler.cor);
    const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.4, 12), new THREE.MeshStandardMaterial({ color: cor }));
    corpo.position.y = 0.9; corpo.castShadow = true; g.add(corpo);
    const cabeca = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    cabeca.position.y = 2.0; cabeca.castShadow = true; g.add(cabeca);
    const faixa = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.09, 8, 16), new THREE.MeshStandardMaterial({ color: time === "azul" ? 0x1E9CFF : 0xFF3B3B }));
    faixa.position.y = 2.0; faixa.rotation.x = Math.PI / 2; g.add(faixa);
    const arma = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 1.2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    arma.position.set(0.6, 1.1, 0.4); g.add(arma);
    // barra de vida 3D
    const barraFundo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.22), new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }));
    barraFundo.position.y = 2.9; g.add(barraFundo);
    const barraVida = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.22), new THREE.MeshBasicMaterial({ color: 0x37D67A, side: THREE.DoubleSide }));
    barraVida.position.set(0, 2.9, 0.01); g.add(barraVida);
    g.position.set(x, 0, z);
    scene.add(g);
    const L = { dados: dadosBrawler, time, mesh: g, barraVida, hp: dadosBrawler.vida, maxHp: dadosBrawler.vida, vivo: true, ehJogador: !!ehJogador, cd: 0, superCarga: ehJogador ? 0 : Math.random() * 50, vel: 6 * dadosBrawler.velocidade, gemas: 0, congelado: 0, escudo: 0, dir: new THREE.Vector3(0, 0, 1) };
    lutadores.push(L);
    return L;
  }

  function arenaBase(corChao, tamanho) {
    scene.fog = null;
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(tamanho, tamanho), new THREE.MeshStandardMaterial({ color: corChao }));
    chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);
    const grade = new THREE.GridHelper(tamanho, 20, 0xffffff, 0xffffff);
    grade.material.opacity = 0.15; grade.material.transparent = true; scene.add(grade);
    const matParede = new THREE.MeshStandardMaterial({ color: 0x333355 });
    const h = 2;
    [[0, -tamanho / 2], [0, tamanho / 2], [-tamanho / 2, 0], [tamanho / 2, 0]].forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(z === 0 ? 1 : tamanho, h, x === 0 ? 1 : tamanho), matParede);
      p.position.set(x, h / 2, z); scene.add(p);
    });
    // obstáculos coloridos
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Color().setHSL(Math.random(), 0.8, 0.55);
      const o = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 2, 2, 2 + Math.random() * 2), new THREE.MeshStandardMaterial({ color: c }));
      o.position.set((Math.random() - 0.5) * (tamanho - 8), 1, (Math.random() - 0.5) * (tamanho - 8));
      o.castShadow = true; scene.add(o);
    }
  }

  function iniciarPartida(modo) {
    if (typeof THREE === "undefined") { alert("Three.js não carregou. Verifique a internet."); return; }
    modoAtual = modo; encerrar = false;
    limparCena(); mostrar("jogo"); $("mensagem").classList.add("escondido");
    scene = new THREE.Scene(); scene.background = new THREE.Color(modo === "futebol" ? 0x0a4d2e : modo === "gema" ? 0x2a0a4d : 0x1a1a2e);
    camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 200);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.setSize(1000, 560);
    $("game3d").appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sol = new THREE.DirectionalLight(0xffffff, 0.9); sol.position.set(10, 20, 10); sol.castShadow = true; scene.add(sol);
    clock = new THREE.Clock();
    const eu = BRAWLERS[save.selecionado];
    gols = { azul: 0, vermelho: 0 }; tempoRestante = DURACAO_PARTIDA; gemasTime = { azul: 0, vermelho: 0 }; contagemGema = 0; liderGema = null; tempoLiderGema = TEMPO_LIDER_GEMA;

    if (modo === "futebol") {
      arenaBase(0x2e8b57, 44);
      criarGol(-20, 0); criarGol(20, 0);
      bola = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      bola.position.set(0, 0.6, 0); bola.castShadow = true; scene.add(bola); bola.userData.vel = new THREE.Vector3();
      // Futebol: 6 players (3x3)
      criarLutador(eu, "azul", -5, 0, true);
      criarLutador(BRAWLERS[(eu.id + 7) % 65], "azul", -8, 5, false);
      criarLutador(BRAWLERS[(eu.id + 9) % 65], "azul", -8, -5, false);
      for (let i = 0; i < 3; i++) criarLutador(BRAWLERS[(eu.id + 13 + i * 5) % 65], "vermelho", 6 + i * 2, -6 + i * 6, false);
    } else if (modo === "gema") {
      arenaBase(0x5b2a86, 40);
      const mina = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1, 12), new THREE.MeshStandardMaterial({ color: 0xAB47BC, emissive: 0x4A148C }));
      mina.position.set(0, 0.5, 0); scene.add(mina);
      // Pique-Gema: 10 players (5x5)
      criarLutador(eu, "azul", -6, 0, true);
      criarLutador(BRAWLERS[(eu.id + 3) % 65], "azul", -8, 4, false);
      criarLutador(BRAWLERS[(eu.id + 11) % 65], "azul", -8, -4, false);
      criarLutador(BRAWLERS[(eu.id + 15) % 65], "azul", -10, 0, false);
      criarLutador(BRAWLERS[(eu.id + 17) % 65], "azul", -6, 6, false);
      for (let i = 0; i < 5; i++) criarLutador(BRAWLERS[(eu.id + 21 + i * 7) % 65], "vermelho", 7, -8 + i * 4, false);
      for (let i = 0; i < 5; i++) soltarGema((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    } else {
      arenaBase(0x3a3a5e, 44);
      // Sobrevivência: 10 players (todos contra todos)
      criarLutador(eu, "solo", 0, -12, true);
      const spots = [[12, 0], [-12, 0], [0, 12], [8, 8], [-8, 8], [12, 12], [-12, 12], [12, -12], [-12, -12]];
      spots.forEach(([x, z], i) => criarLutador(BRAWLERS[(eu.id + 5 + i * 9) % 65], "solo", x, z, false));
      nevoa = new THREE.Mesh(new THREE.RingGeometry(18, 22, 40), new THREE.MeshBasicMaterial({ color: 0x9B30FF, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      nevoa.rotation.x = -Math.PI / 2; nevoa.position.y = 0.1; scene.add(nevoa);
    }
    atualizarHUD();
    requestAnimationFrame(loop);
  }

  function criarGol(x) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 8), new THREE.MeshStandardMaterial({ color: 0xFFD21F }));
    g.position.set(x, 1.5, 0); scene.add(g);
  }
  function soltarGema(x, z) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshStandardMaterial({ color: 0xFF6EC7, emissive: 0x880044 }));
    m.position.set(x, 0.7, z); scene.add(m);
    gemas.push(m);
  }

  function jogador() { return lutadores.find((l) => l.ehJogador); }

  function atacarJogador() {
    const j = jogador(); if (!j || !j.vivo || telas.jogo.classList.contains("ativa") === false) return;
    disparar(j, false);
  }
  function superJogador() {
    const j = jogador(); if (!j || !j.vivo) return;
    if (j.superCarga < 100) return;
    j.superCarga = 0; save.stats.supers++; salvar();
    const d = j.dados;
    if (d.efeito === "cura") j.hp = Math.min(j.maxHp, j.hp + d.superDano);
    else if (d.efeito === "escudo") j.escudo = 2000;
    else if (d.efeito === "rapido") { j.vel *= 1.6; setTimeout(() => (j.vel /= 1.6), 6000); disparar(j, true); }
    else if (d.efeito === "congelar") lutadores.forEach((o) => { if (o !== j && o.vivo && perto(o, j, 14)) o.congelado = 4; });
    else { // dano / explosao
      const area = d.efeito === "explosao" ? 12 : 8;
      lutadores.forEach((o) => { if (o !== j && o.vivo && o.time !== j.time && perto(o, j, area)) darDano(o, d.superDano * 1.2, j); });
      efeitoExplosao(j.mesh.position, d.cor);
    }
    efeitoExplosao(j.mesh.position, "#FFD21F");
    atualizarHUD();
  }

  function perto(a, b, dist) { const dx = a.mesh.position.x - b.mesh.position.x, dz = a.mesh.position.z - b.mesh.position.z; return Math.sqrt(dx * dx + dz * dz) < dist; }
  function efeitoExplosao(pos, cor) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(cor), transparent: true, opacity: 0.8 }));
    m.position.copy(pos); m.position.y = 1; scene.add(m);
    let t = 0; const iv = setInterval(() => { t++; m.scale.multiplyScalar(1.3); m.material.opacity -= 0.2; if (t > 4) { scene.remove(m); clearInterval(iv); } }, 80);
  }

  function disparar(origem, ehSuper) {
    if (origem.cd > 0) return; origem.cd = 0.45;
    const alvo = inimigoMaisProximo(origem);
    const dir = new THREE.Vector3();
    if (alvo) dir.subVectors(alvo.mesh.position, origem.mesh.position).setY(0).normalize();
    else dir.copy(origem.dir);
    origem.dir.copy(dir);
    const danoBase = ehSuper ? origem.dados.superDano : origem.dados.ataque;
    const mult = alvo ? multiplicadorTipo(origem.dados.tipo, alvo.dados.tipo) : 1;
    const cor = new THREE.Color(origem.dados.cor);
    const p = new THREE.Mesh(new THREE.SphereGeometry(ehSuper ? 0.45 : 0.28, 10, 8), new THREE.MeshBasicMaterial({ color: cor }));
    p.position.copy(origem.mesh.position); p.position.y = 1.2;
    scene.add(p);
    projeteis.push({ mesh: p, vel: dir.multiplyScalar(22), dono: origem, dano: danoBase * mult, vida: 1.6 });
    if (origem.ehJogador && !ehSuper) origem.superCarga = Math.min(100, origem.superCarga + 8);
  }

  function inimigoMaisProximo(o) {
    let melhor = null, md = 1e9;
    lutadores.forEach((l) => {
      if (!l.vivo || l === o) return;
      if (modoAtual !== "sobrevivencia" && l.time === o.time) return;
      if (modoAtual === "sobrevivencia" && l === o) return;
      const d = o.mesh.position.distanceTo(l.mesh.position);
      if (d < md) { md = d; melhor = l; }
    });
    return md < 20 ? melhor : null;
  }

  function darDano(alvo, dano, fonte) {
    if (!alvo.vivo) return;
    if (alvo.escudo > 0) { const abs = Math.min(alvo.escudo, dano); alvo.escudo -= abs; dano -= abs; }
    alvo.hp -= dano;
    if (fonte && fonte.ehJogador) fonte.superCarga = Math.min(100, fonte.superCarga + 6);
    if (alvo.hp <= 0) {
      alvo.hp = 0; alvo.vivo = false; alvo.mesh.visible = false;
      if (fonte && fonte.ehJogador) {
        save.stats.kills++;
        if (modoAtual === "gema" && alvo.gemas > 0) { for (let i = 0; i < alvo.gemas; i++) soltarGema(alvo.mesh.position.x + Math.random() * 2, alvo.mesh.position.z + Math.random() * 2); alvo.gemas = 0; atualizarPlacarGema(); }
      }
      if (alvo.ehJogador) fimDeJogo(false, "Você foi derrotado!");
      else checarVitoria();
    }
    atualizarHUD();
  }

  function checarVitoria() {
    if (encerrar) return;
    if (modoAtual === "sobrevivencia") {
      const vivos = lutadores.filter((l) => l.vivo);
      if (vivos.length === 1 && vivos[0].ehJogador) fimDeJogo(true, "🏆 Você sobreviveu!");
      else if (!jogador().vivo) fimDeJogo(false, "Derrota na sobrevivência!");
    } else if (modoAtual === "futebol") {
      if (gols.azul >= 2) fimDeJogo(true, "⚽ Vitória no Futebol! " + gols.azul + " x " + gols.vermelho);
      else if (gols.vermelho >= 2) fimDeJogo(false, "Derrota no Futebol... " + gols.azul + " x " + gols.vermelho);
    } else if (modoAtual === "gema") {
      // Pique-Gema: quem tiver mais gemas por 20 segundos ganha
      atualizarPlacarGema();
      if (liderGema === "azul" && tempoLiderGema <= 0) fimDeJogo(true, "💎 Seu time teve mais gemas por 20s!");
      else if (liderGema === "vermelho" && tempoLiderGema <= 0) fimDeJogo(false, "O time rival teve mais gemas por 20s!");
    }
  }

  function atualizarPlacarGema() {
    gemasTime.azul = lutadores.filter((l) => l.time === "azul" && l.vivo).reduce((s, l) => s + l.gemas, 0);
    gemasTime.vermelho = lutadores.filter((l) => l.time === "vermelho" && l.vivo).reduce((s, l) => s + l.gemas, 0);
    const novoLider = gemasTime.azul > gemasTime.vermelho ? "azul" : gemasTime.vermelho > gemasTime.azul ? "vermelho" : null;
    if (novoLider !== liderGema) { liderGema = novoLider; tempoLiderGema = TEMPO_LIDER_GEMA; }
  }

  function fimDeJogo(venceu, texto) {
    if (encerrar) return; encerrar = true;
    if (venceu) {
      save.stats.vitorias++; save.trofeus += 3;
      if (modoAtual === "sobrevivencia") save.stats.vitoriasSobre++;
      const antes = save.desbloqueados.length;
      tentarDesbloquear();
      const novo = save.desbloqueados.length > antes ? "<br>🎉 Novo brawler: <b>" + BRAWLERS[antes].nome + "</b>!" : "<br>🏆 Total: " + save.trofeus + " (faltam " + (custoProximo() - save.trofeus) + " para o próximo)";
      salvar();
      $("mensagem").innerHTML = texto + novo + '<br><button class="btn-grande" onclick="document.getElementById(\'btn-sair\').click()">Continuar</button>';
    } else {
      salvar();
      $("mensagem").innerHTML = texto + "<br>💪 Tente de novo!<br><button class=\"btn-grande\" onclick=\"document.getElementById('btn-sair').click()\">Voltar</button>";
    }
    $("mensagem").classList.remove("escondido");
  }

  function atualizarHUD() {
    const j = jogador(); if (!j) return;
    $("hud-nome").textContent = j.dados.nome + " (" + TIPOS[j.dados.tipo].nome + ") • " + j.dados.arma + " • Super: " + j.dados.super;
    $("hud-vida").style.width = (100 * j.hp / j.maxHp) + "%";
    $("hud-super").style.width = j.superCarga + "%";
    if (modoAtual === "futebol") $("hud-placar").textContent = "🔵 " + gols.azul + " x " + gols.vermelho + " 🔴";
    else if (modoAtual === "gema") {
      let ga = 0, gv = 0; lutadores.forEach((l) => { if (l.vivo && l.time === "azul") ga += l.gemas; else if (l.vivo && l.time === "vermelho") gv += l.gemas; });
      if (liderGema) $("hud-placar").textContent = "💎 " + ga + " x " + gv + " 💎 líder: " + liderGema + " " + Math.ceil(tempoLiderGema) + "s";
      else $("hud-placar").textContent = "💎 " + ga + " x " + gv + " (empate)";
    } else {
      const vivos = lutadores.filter((l) => l.vivo).length;
      $("hud-placar").textContent = "Vivos: " + vivos;
    }
    $("hud-tempo").textContent = " ⏱️" + Math.ceil(tempoRestante) + "s";
  }

  // ---------- LOOP ----------
  function loop() {
    if (encerrar) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    tempoRestante -= dt;
    if (tempoRestante <= 0) {
      if (modoAtual === "futebol") fimDeJogo(gols.azul > gols.vermelho, "⏱️ Fim dos 5 minutos! " + gols.azul + " x " + gols.vermelho);
      else if (modoAtual === "sobrevivencia") {
        const vivos = lutadores.filter((l) => l.vivo);
        fimDeJogo(vivos.length === 1 && vivos[0].ehJogador, "⏱️ Fim dos 5 minutos da sobrevivência!");
      } else { atualizarPlacarGema(); fimDeJogo(gemasTime.azul > gemasTime.vermelho, "⏱️ Fim dos 5 minutos do Pique-Gema! " + gemasTime.azul + " x " + gemasTime.vermelho); }
      return;
    }
    const j = jogador();
    // movimento jogador
    if (j && j.vivo && j.congelado <= 0) {
      const v = new THREE.Vector3();
      if (teclas["w"] || teclas["arrowup"]) v.z -= 1;
      if (teclas["s"] || teclas["arrowdown"]) v.z += 1;
      if (teclas["a"] || teclas["arrowleft"]) v.x -= 1;
      if (teclas["d"] || teclas["arrowright"]) v.x += 1;
      v.x += joyDx; v.z += joyDy;
      if (v.length() > 0.1) { v.normalize().multiplyScalar(j.vel * dt * 1.6); j.dir.copy(v).normalize(); }
      j.mesh.position.x = Math.max(-21, Math.min(21, j.mesh.position.x + v.x));
      j.mesh.position.z = Math.max(-21, Math.min(21, j.mesh.position.z + v.z));
      if (modoAtual === "futebol" && bola && perto({ mesh: bola }, j, 1.6)) {
        bola.userData.vel.add(new THREE.Vector3(j.dir.x * 18 * dt, 0, j.dir.z * 18 * dt));
      }
      j.mesh.rotation.y = Math.atan2(j.dir.x, j.dir.z);
    }
    // bots IA
    lutadores.forEach((L) => {
      if (L.ehJogador || !L.vivo) return;
      L.cd -= dt;
      if (L.congelado > 0) { L.congelado -= dt; return; }
      const alvo = inimigoMaisProximo(L);
      let destino = null;
      if (modoAtual === "futebol" && bola) destino = bola.position;
      else if (modoAtual === "gema" && L.gemas < 3 && gemas.length) destino = gemas[0].position;
      else if (alvo) destino = alvo.mesh.position;
      if (destino) {
        const d = new THREE.Vector3().subVectors(destino, L.mesh.position); d.y = 0;
        const dist = d.length();
        if (dist > (modoAtual === "futebol" ? 1.2 : 7)) { d.normalize(); L.mesh.position.addScaledVector(d, L.vel * dt * 1.3); L.dir.copy(d); }
        else if (alvo && dist < 14 && Math.random() < 0.03) disparar(L, false);
        if (L.superCarga >= 100 && alvo && dist < 10 && Math.random() < 0.02) { L.superCarga = 0; darDano(alvo, L.dados.superDano, L); efeitoExplosao(L.mesh.position, L.dados.cor); }
      }
      L.superCarga = Math.min(100, L.superCarga + dt * 6);
      L.mesh.rotation.y = Math.atan2(L.dir.x, L.dir.z);
      if (modoAtual === "futebol" && bola && L.mesh.position.distanceTo(bola.position) < 1.6) {
        const chute = new THREE.Vector3().subVectors(bola.position, L.mesh.position).setY(0).normalize();
        // bots chutam para o gol adversário
        const golX = L.time === "azul" ? 20 : -20;
        chute.x = (golX - bola.position.x) * 0.05 + chute.x * 0.5; chute.z = (0 - bola.position.z) * 0.05;
        bola.userData.vel.add(chute.multiplyScalar(20 * dt + 0.15));
      }
    });
    if (j) { j.cd -= dt; j.superCarga = Math.min(100, j.superCarga + dt * 3); }
    // projéteis
    for (let i = projeteis.length - 1; i >= 0; i--) {
      const p = projeteis[i];
      p.vida -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      let matou = p.vida <= 0;
      lutadores.forEach((L) => {
        if (!L.vivo || L === p.dono) return;
        if (modoAtual !== "sobrevivencia" && L.time === p.dono.time) return;
        if (L.mesh.position.distanceTo(p.mesh.position) < 1.1) { darDano(L, p.dano, p.dono); matou = true; }
      });
      if (matou || Math.abs(p.mesh.position.x) > 22 || Math.abs(p.mesh.position.z) > 22) { scene.remove(p.mesh); projeteis.splice(i, 1); }
    }
    // bola futebol
    if (modoAtual === "futebol" && bola) {
      bola.position.add(bola.userData.vel);
      bola.userData.vel.multiplyScalar(0.985);
      bola.position.x = Math.max(-21, Math.min(21, bola.position.x));
      bola.position.z = Math.max(-11, Math.min(11, bola.position.z));
      if (Math.abs(bola.position.x) > 19 && Math.abs(bola.position.z) < 4) {
        if (bola.position.x > 0) { gols.azul++; save.stats.gols++; }
        else gols.vermelho++;
        salvar(); atualizarHUD();
        bola.position.set(0, 0.6, 0); bola.userData.vel.set(0, 0, 0);
        checarVitoria();
      }
    }
    // gemas
    if (modoAtual === "gema") {
      if (Math.random() < dt * 0.5 && gemas.length < 8) soltarGema((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      gemas.forEach((g) => { g.rotation.y += dt * 2; });
      for (let i = gemas.length - 1; i >= 0; i--) {
        const g = gemas[i];
        const pegou = lutadores.find((L) => L.vivo && L.mesh.position.distanceTo(g.position) < 1.4);
        if (pegou) {
          pegou.gemas++; save.stats.gemas += pegou.ehJogador ? 1 : 0;
          scene.remove(g); gemas.splice(i, 1);
          atualizarPlacarGema();
          salvar(); atualizarHUD();
        }
      }
      // conta 20s de liderança: quem tiver mais gemas por 20s ganha
      if (liderGema) {
        tempoLiderGema -= dt;
        $("hud-placar").textContent = "💎 " + gemasTime.azul + " x " + gemasTime.vermelho + " 💎 líder: " + liderGema + " " + Math.ceil(Math.max(0, tempoLiderGema)) + "s";
        if (tempoLiderGema <= 0) {
          if (liderGema === "azul") fimDeJogo(true, "💎 Seu time teve mais gemas por 20s!");
          else fimDeJogo(false, "O time rival teve mais gemas por 20s!");
          return;
        }
      }
      // barras de vida 3D + câmera
    }
    lutadores.forEach((L) => {
      const s = Math.max(0.001, L.hp / L.maxHp);
      L.barraVida.scale.x = s; L.barraVida.position.x = -0.8 * (1 - s);
      L.barraVida.material.color.setHex(s > 0.5 ? 0x37D67A : s > 0.25 ? 0xFFD21F : 0xFF3B3B);
    });
    if (j && renderer) {
      camera.position.set(j.mesh.position.x, 16, j.mesh.position.z + 12);
      camera.lookAt(j.mesh.position.x, 0, j.mesh.position.z);
      renderer.render(scene, camera);
    }
    if (Math.floor(tempoRestante * 2) % 2 === 0) atualizarHUD();
  }

  renderEscolha();
})();
