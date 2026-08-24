const API_BASE = 'https://liga-pes-2006.onrender.com';
const LS_TOKEN = 'pes_admin_token';
const LS_POOL_PERSONAS = 'pes_pool_personas';
const LS_POOL_EQUIPOS = 'pes_pool_equipos';
const LS_ACTIVE_USER = 'pes_active_user';
const LS_TORNEO_INICIO = 'pes_torneo_inicio';
const LS_FIXTURE_FORMATO = 'pes_fixture_formato';
const RONDAS_POR_SEMANA = 2;

let roster = [];    // [{id, nombre, equipo}]
let partidos = [];  // [{id, personaAId, personaBId, golesA, golesB, goleadores:[{jugador,personaId,cantidad}], rojas:[{jugador,personaId}]}]
let editandoPartidoId = null;
let equiposCache = []; // registros crudos {id_equipo, nombre} de la API

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

async function apiFetch(path, { method='GET', body, auth=false } = {}){
  const headers = { 'Content-Type': 'application/json' };
  if(auth){ headers.Authorization = 'Bearer ' + localStorage.getItem(LS_TOKEN); }
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if(res.status === 401 && auth){
    logout();
    throw new Error('Sesión expirada. Iniciá sesión de nuevo.');
  }
  if(!res.ok){
    let msg = res.statusText;
    try{
      const data = await res.json();
      if(data && data.error) msg = data.error;
    }catch(e){}
    throw new Error(msg);
  }
  if(res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function equipoNombreById(id){
  const e = equiposCache.find(x => String(x.id_equipo) === String(id));
  return e ? e.nombre : '';
}

async function findOrCreateEquipoId(nombre){
  nombre = nombre.trim();
  const existing = equiposCache.find(e => e.nombre.trim().toLowerCase() === nombre.toLowerCase());
  if(existing) return existing.id_equipo;
  const created = await apiFetch('/equipos', { method:'POST', auth:true, body:{ nombre } });
  equiposCache.push(created);
  return created.id_equipo;
}

async function loadState(){
  try{
    const [equipos, personasRaw, partidosRaw, incidenciasRaw] = await Promise.all([
      apiFetch('/equipos'),
      apiFetch('/personas'),
      apiFetch('/partidos'),
      apiFetch('/incidencias')
    ]);
    equiposCache = equipos;

    roster = personasRaw.map(p => ({
      id: String(p.id_persona),
      nombre: p.nombre,
      equipo: equipoNombreById(p.id_equipo)
    }));

    partidos = partidosRaw.map(m => {
      const idPartido = String(m.id_partido);
      const incidenciasDelPartido = incidenciasRaw.filter(i => String(i.id_partido) === idPartido);
      const goles = incidenciasDelPartido.filter(i => i.tipo === 'G');
      const rojas = incidenciasDelPartido.filter(i => i.tipo === 'R').map(i => ({
        jugador: i.jugador_virtual,
        personaId: String(i.id_persona)
      }));

      // Cada gol es una fila de incidencia individual (sin columna de cantidad en la API);
      // se agrupan por jugador+persona para reconstruir el `cantidad` que usa el resto del código.
      const goleadoresMap = {};
      goles.forEach(i => {
        const key = i.jugador_virtual.trim().toLowerCase() + '|' + i.id_persona;
        if(!goleadoresMap[key]){
          goleadoresMap[key] = { jugador: i.jugador_virtual, personaId: String(i.id_persona), cantidad: 0 };
        }
        goleadoresMap[key].cantidad++;
      });

      return {
        id: idPartido,
        personaAId: String(m.id_local),
        personaBId: String(m.id_visitante),
        golesA: m.goles_local,
        golesB: m.goles_visitante,
        numeroFecha: m.numero_fecha,
        goleadores: Object.values(goleadoresMap),
        rojas
      };
    });

    if(!localStorage.getItem(LS_TORNEO_INICIO)){
      localStorage.setItem(LS_TORNEO_INICIO, new Date().toISOString());
    }
    if(!localStorage.getItem(LS_ACTIVE_USER) && roster.length > 0){
      localStorage.setItem(LS_ACTIVE_USER, roster[0].id);
    }
  }catch(err){
    roster = [];
    partidos = [];
    console.error(err);
    showToast('No se pudo conectar con el servidor');
  }
}


function personaById(id){ return roster.find(r=>r.id===id); }
function personaNombre(id){ const p = personaById(id); return p ? p.nombre : '(eliminado)'; }
function personaEquipo(id){ const p = personaById(id); return p ? p.equipo : '—'; }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove('show'), 2200);
}


function showTab(name){
  if((name==='admin' || name==='sorteo') && !isAdmin()){
    openLoginModal();
    return;
  }
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  ['posiciones','goleadores','rojas','fechas','sorteo','admin'].forEach(t=>{
    document.getElementById('tab-'+t).classList.toggle('hidden', t!==name);
  });
  if(name==='admin'){ renderAdmin(); }
  if(name==='sorteo'){ cargarPoolsEnTextareas(); }
  if(name==='fechas'){ renderFechas(); }
}


function isAdmin(){ return !!localStorage.getItem(LS_TOKEN); }

function openLoginModal(){
  if(isAdmin()) return; // ya logueado, no hace falta
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginForm').reset();
  document.getElementById('loginModal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('loginUser').focus(), 50);
}

function closeLoginModal(){
  document.getElementById('loginModal').classList.add('hidden');
}

async function submitLogin(evt){
  evt.preventDefault();
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  try{
    const data = await apiFetch('/auth/login', { method:'POST', body:{ username:user, password:pass } });
    localStorage.setItem(LS_TOKEN, data.token);
    closeLoginModal();
    await loadState();
    renderAll();
    refreshAdminUI();
    showTab('admin');
    showToast('Sesión de administrador iniciada');
  }catch(err){
    document.getElementById('loginError').textContent = 'Usuario o contraseña incorrectos.';
  }
  return false;
}

function logout(){
  localStorage.removeItem(LS_TOKEN);
  refreshAdminUI();
  showTab('posiciones');
  showToast('Sesión cerrada');
}

function refreshAdminUI(){
  const on = isAdmin();
  document.getElementById('btnAdminToggle').classList.toggle('hidden', on);
  document.getElementById('btnLogout').classList.toggle('hidden', !on);
  document.getElementById('adminPill').classList.toggle('hidden', !on);
  document.getElementById('tabAdminBtn').classList.toggle('hidden', !on);
  document.getElementById('tabSorteoBtn').classList.toggle('hidden', !on);
  document.getElementById('adminLocked').classList.toggle('hidden', on);
  document.getElementById('adminContent').classList.toggle('hidden', !on);
  const tabAdminVisible = document.getElementById('tab-admin').classList.contains('hidden')===false;
  const tabSorteoVisible = document.getElementById('tab-sorteo').classList.contains('hidden')===false;
  if(!on && (tabAdminVisible || tabSorteoVisible)){
    showTab('posiciones');
  }
}


function calcularPosiciones(){
  const stats = {};
  roster.forEach(r=>{
    stats[r.id] = {id:r.id, nombre:r.nombre, equipo:r.equipo, pj:0,pg:0,pe:0,pp:0,gf:0,gc:0};
  });
  partidos.forEach(m=>{
    const a = stats[m.personaAId], b = stats[m.personaBId];
    if(!a || !b) return; // persona eliminada del roster
    a.pj++; b.pj++;
    a.gf += m.golesA; a.gc += m.golesB;
    b.gf += m.golesB; b.gc += m.golesA;
    if(m.golesA > m.golesB){ a.pg++; b.pp++; }
    else if(m.golesA < m.golesB){ b.pg++; a.pp++; }
    else { a.pe++; b.pe++; }
  });
  const arr = Object.values(stats).map(s=>({
    ...s, dg: s.gf - s.gc, pts: s.pg*3 + s.pe*1
  }));
  arr.sort((x,y)=> y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.nombre.localeCompare(y.nombre));
  return arr;
}

function calcularGoleadores(){
  const map = {};
  partidos.forEach(m=>{
    m.goleadores.forEach(g=>{
      const key = g.jugador.trim().toLowerCase()+'|'+g.personaId;
      if(!map[key]) map[key] = {jugador:g.jugador.trim(), personaId:g.personaId, goles:0};
      map[key].goles += (g.cantidad || 0);
    });
  });
  const arr = Object.values(map);
  arr.sort((a,b)=> b.goles - a.goles || a.jugador.localeCompare(b.jugador));
  return arr;
}

function calcularRojas(){
  const map = {};
  partidos.forEach(m=>{
    m.rojas.forEach(r=>{
      const key = r.jugador.trim().toLowerCase()+'|'+r.personaId;
      if(!map[key]) map[key] = {jugador:r.jugador.trim(), personaId:r.personaId, cant:0};
      map[key].cant += 1;
    });
  });
  const arr = Object.values(map);
  arr.sort((a,b)=> b.cant - a.cant || a.jugador.localeCompare(b.jugador));
  return arr;
}


function renderPosiciones(){
  const data = calcularPosiciones();
  const tbody = document.getElementById('posicionesBody');
  document.getElementById('posCount').textContent = data.length + ' participantes';
  if(data.length===0){
    tbody.innerHTML = `<tr><td colspan="11" class="empty-note">Todavía no hay personas cargadas. Andá a la pestaña Sorteo para armar el plantel.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((r,i)=>`
    <tr class="pos-${i+1}">
      <td class="pos-cell"><span class="pos-badge">${i+1}</span></td>
      <td class="left" data-label="Persona">${escapeHtml(r.nombre)}</td>
      <td class="left team-cell" data-label="Equipo">${escapeHtml(r.equipo)}</td>
      <td class="pts-cell" data-label="PTS">${r.pts}</td>
      <td data-label="PJ">${r.pj}</td><td data-label="PG">${r.pg}</td><td data-label="PE">${r.pe}</td><td data-label="PP">${r.pp}</td>
      <td data-label="GF">${r.gf}</td><td data-label="GC">${r.gc}</td><td data-label="DG">${r.dg>0?'+':''}${r.dg}</td>
    </tr>
  `).join('');
}


function renderGoleadores(){
  const data = calcularGoleadores();
  const tbody = document.getElementById('goleadoresBody');
  document.getElementById('golCount').textContent = data.length + ' goleadores';
  if(data.length===0){
    tbody.innerHTML = `<tr><td colspan="5" class="empty-note">Todavía no hay goles cargados.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((g,i)=>`
    <tr>
      <td class="pos-cell"><span class="pos-badge">${i+1}</span></td>
      <td class="left" data-label="Jugador Virtual">${escapeHtml(g.jugador)}</td>
      <td class="left" data-label="Persona">${escapeHtml(personaNombre(g.personaId))}</td>
      <td class="left team-cell" data-label="Equipo">${escapeHtml(personaEquipo(g.personaId))}</td>
      <td class="pts-cell" data-label="Goles">${g.goles}</td>
    </tr>
  `).join('');
}

function renderRojas(){
  const data = calcularRojas();
  const tbody = document.getElementById('rojasBody');
  document.getElementById('rojCount').textContent = data.length + ' jugadores expulsados';
  if(data.length===0){
    tbody.innerHTML = `<tr><td colspan="5" class="empty-note">Todavía no hay tarjetas rojas cargadas.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((g,i)=>`
    <tr>
      <td class="pos-cell"><span class="pos-badge">${i+1}</span></td>
      <td class="left" data-label="Jugador Virtual">${escapeHtml(g.jugador)}</td>
      <td class="left" data-label="Persona">${escapeHtml(personaNombre(g.personaId))}</td>
      <td class="left team-cell" data-label="Equipo">${escapeHtml(personaEquipo(g.personaId))}</td>
      <td class="pts-cell" style="color:#e08484;" data-label="Expulsiones">${g.cant}</td>
    </tr>
  `).join('');
}



function getMonday(d){
  const date = new Date(d);
  date.setHours(0,0,0,0);
  const day = date.getDay(); // 0=domingo ... 6=sábado
  const diff = (day === 0) ? -6 : (1 - day);
  date.setDate(date.getDate() + diff);
  return date;
}

function semanaActualIndex(){
  const inicioStr = localStorage.getItem(LS_TORNEO_INICIO);
  if(!inicioStr) return 0;
  const inicioMonday = getMonday(new Date(inicioStr));
  const hoyMonday = getMonday(new Date());
  const diffSemanas = Math.round((hoyMonday - inicioMonday) / (7*24*60*60*1000));
  return Math.max(0, diffSemanas);
}

function poblarActiveUserSelect(){
  const sel = document.getElementById('activeUserSelect');
  const prevGuardado = localStorage.getItem(LS_ACTIVE_USER);
  const prev = (prevGuardado && roster.some(r=>r.id===prevGuardado)) ? prevGuardado : (roster[0] ? roster[0].id : '');
  if(roster.length === 0){
    sel.innerHTML = `<option value="">— sin participantes —</option>`;
    localStorage.setItem(LS_ACTIVE_USER, '');
    return '';
  }
  sel.innerHTML = roster.map(r => `<option value="${r.id}">${escapeHtml(r.nombre)} (${escapeHtml(r.equipo)})</option>`).join('');
  sel.value = prev;
  localStorage.setItem(LS_ACTIVE_USER, prev);
  return prev;
}

function onActiveUserChange(){
  const sel = document.getElementById('activeUserSelect');
  localStorage.setItem(LS_ACTIVE_USER, sel.value);
  refreshUserBar();
  const tabFechas = document.getElementById('tab-fechas');
  if(tabFechas && !tabFechas.classList.contains('hidden')){ renderFechas(); }
}


function calcularRondas(){
  const formato = localStorage.getItem(LS_FIXTURE_FORMATO) || 'ida';
  let ids = roster.map(r => r.id);
  if(ids.length < 2) return [];
  if(ids.length % 2 !== 0) ids = [...ids, null];
  const n = ids.length;
  let arr = [...ids];
  const rondas = [];
  for(let r = 0; r < n - 1; r++){
    const ronda = [];
    for(let i = 0; i < n/2; i++){
      ronda.push([arr[i], arr[n-1-i]]);
    }
    rondas.push(ronda);
    const fijo = arr[0];
    const resto = arr.slice(1);
    resto.unshift(resto.pop());
    arr = [fijo, ...resto];
  }
  if(formato === 'ida_vuelta'){
    const vuelta = rondas.map(ronda => ronda.map(([a,b]) => [b,a]));
    rondas.push(...vuelta);
  }
  return rondas;
}

function rivalEnRonda(rondas, personaId, rondaIdx){
  const ronda = rondas[rondaIdx];
  if(!ronda) return null;
  const par = ronda.find(([a,b]) => a===personaId || b===personaId);
  if(!par) return null;
  return par[0]===personaId ? par[1] : par[0];
}

// rondaIdx (índice de array, base 0) vs numeroFecha (base 1) — no mezclar sin sumar/restar 1.
function partidoEnRonda(rondas, personaId, rondaIdx){
  const rival = rivalEnRonda(rondas, personaId, rondaIdx);
  if(rival == null) return undefined;
  return partidos.find(m => m.numeroFecha === rondaIdx+1 &&
    ((m.personaAId===personaId && m.personaBId===rival) || (m.personaAId===rival && m.personaBId===personaId)));
}

function proximoPendiente(rondas, personaId){
  for(let i=0; i<rondas.length; i++){
    const rival = rivalEnRonda(rondas, personaId, i);
    if(rival == null) continue;
    if(!partidoEnRonda(rondas, personaId, i)){
      return { rivalId: rival, ronda: i };
    }
  }
  return null;
}

function proximaRondaConRival(rondas, personaId, desdeNumeroFecha){
  for(let i = desdeNumeroFecha; i < rondas.length; i++){
    if(rivalEnRonda(rondas, personaId, i) != null) return i;
  }
  return null;
}

function jugadoresSancionadosParaSlot(rondas, personaId, rondaIdx){
  if(rondaIdx == null) return [];
  const rival = rivalEnRonda(rondas, personaId, rondaIdx);
  if(rival == null) return [];
  if(partidoEnRonda(rondas, personaId, rondaIdx)) return [];
  const nombres = new Set();
  partidos.forEach(m => {
    (m.rojas || []).forEach(r => {
      if(r.personaId !== personaId) return;
      if(m.numeroFecha == null) return;
      const siguienteRonda = proximaRondaConRival(rondas, personaId, m.numeroFecha);
      if(siguienteRonda === rondaIdx) nombres.add(r.jugador.trim());
    });
  });
  return [...nombres];
}

function proximaRondaLibreParaPar(rondas, idA, idB){
  for(let i=0; i<rondas.length; i++){
    const par = rondas[i].find(([x,y]) => (x===idA && y===idB) || (x===idB && y===idA));
    if(!par) continue;
    const yaJugado = partidos.some(m => m.numeroFecha === i+1 &&
      ((m.personaAId===idA && m.personaBId===idB) || (m.personaAId===idB && m.personaBId===idA)));
    if(!yaJugado) return i+1;
  }
  return null;
}

function refreshUserBar(){
  const personaId = poblarActiveUserSelect();
  const weekInfo = document.getElementById('weekInfo');
  const banner = document.getElementById('weekBanner');
  const banPropia = document.getElementById('banSancionPropia');
  const banRival = document.getElementById('banSancionRival');

  banPropia.classList.add('hidden'); banPropia.innerHTML = '';
  banRival.classList.add('hidden'); banRival.innerHTML = '';

  if(!personaId){
    weekInfo.innerHTML = '';
    banner.classList.add('hidden');
    return;
  }

  const rondas = calcularRondas();
  const totalSemanas = Math.ceil(rondas.length / RONDAS_POR_SEMANA);
  const idx = Math.min(semanaActualIndex(), Math.max(0, totalSemanas - 1));
  weekInfo.innerHTML = totalSemanas > 0
    ? `Semana actual: <strong>${idx+1}</strong> de ${totalSemanas}`
    : 'No hay rivales suficientes para armar el fixture';

  if(totalSemanas === 0){
    banner.classList.add('hidden');
    return;
  }

  const rondaInicio = idx * RONDAS_POR_SEMANA;
  const rondasSemana = [rondaInicio, rondaInicio + 1].filter(i => i < rondas.length);
  const rivalesSemana = rondasSemana
    .map(i => ({ ronda: i, rivalId: rivalEnRonda(rondas, personaId, i) }))
    .filter(x => x.rivalId != null);

  if(rivalesSemana.length === 0){
    banner.className = 'week-banner ok';
    banner.innerHTML = `<span class="icon">🛌</span><span>Esta semana tenés fecha libre.</span>`;
  } else {
    const pendientes = rivalesSemana.filter(x => !partidoEnRonda(rondas, personaId, x.ronda));
    if(pendientes.length === 0){
      banner.className = 'week-banner ok';
      banner.innerHTML = `<span class="icon">✅</span><span>¡Ya jugaste tus partidos de la Semana ${idx+1}! Nos vemos la semana que viene.</span>`;
    } else {
      const nombres = pendientes.map(x => `<b>${escapeHtml(personaNombre(x.rivalId))}</b>`).join(' y ');
      banner.className = 'week-banner warning';
      banner.innerHTML = `<span class="icon">⚠️</span><span>No jugaste tus fechas, jugás esta semana contra: ${nombres}</span>`;
    }
  }
  banner.classList.remove('hidden');

  const proximo = proximoPendiente(rondas, personaId);
  if(!proximo) return;

  const misSancionados = jugadoresSancionadosParaSlot(rondas, personaId, proximo.ronda);
  if(misSancionados.length > 0){
    const plural = misSancionados.length > 1;
    const nombres = misSancionados.map(n => `<b>${escapeHtml(n)}</b>`).join(', ');
    const rivalNombre = escapeHtml(personaNombre(proximo.rivalId));
    banPropia.className = 'week-banner sancion';
    banPropia.innerHTML = `<span class="icon">🟥</span><span>TU EQUIPO: ${nombres} ${plural ? 'están sancionados' : 'está sancionado'} y NO ${plural ? 'pueden' : 'puede'} jugar contra <b>${rivalNombre}</b>.</span>`;
    banPropia.classList.remove('hidden');
  }

  const rivalSancionados = jugadoresSancionadosParaSlot(rondas, proximo.rivalId, proximo.ronda);
  if(rivalSancionados.length > 0){
    const nombres = rivalSancionados.map(n => `<b>${escapeHtml(n)}</b>`).join(', ');
    const rivalNombre = escapeHtml(personaNombre(proximo.rivalId));
    banRival.className = 'week-banner sancion';
    banRival.innerHTML = `<span class="icon">🚫</span><span>RIVAL SANCIONADO: <b>${rivalNombre}</b> no podrá usar a ${nombres} en este partido por tarjeta roja.</span>`;
    banRival.classList.remove('hidden');
  }
}


function renderFilaFixture(idA, idB, rondaIdx){
  if(idA == null || idB == null){
    const libre = personaById(idA ?? idB) || { nombre: '(eliminado)' };
    return `
      <div class="fixture-row pendiente">
        <div class="fixture-main" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span>${escapeHtml(libre.nombre)}</span>
          <span style="color:var(--text-dim);">— fecha libre</span>
        </div>
      </div>
    `;
  }

  const a = personaById(idA) || { nombre: '(eliminado)', equipo: '—' };
  const b = personaById(idB) || { nombre: '(eliminado)', equipo: '—' };
  const partido = partidos.find(m => m.numeroFecha === rondaIdx+1 &&
    ((m.personaAId===idA && m.personaBId===idB) || (m.personaAId===idB && m.personaBId===idA)));

  if(!partido){
    return `
      <div class="fixture-row pendiente">
        <div class="fixture-main" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span>${escapeHtml(a.nombre)}</span>
          <span style="color:var(--text-dim);">${escapeHtml(a.equipo)}</span>
          <span class="resultado-chip" style="background:var(--line); color:var(--text-dim);">0</span>
          <span>vs</span>
          <span class="resultado-chip" style="background:var(--line); color:var(--text-dim);">0</span>
          <span style="color:var(--text-dim);">${escapeHtml(b.equipo)}</span>
          <span>${escapeHtml(b.nombre)}</span>
        </div>
        <span class="resultado-chip" style="background:var(--line); color:var(--text-dim);">Por jugar</span>
      </div>
    `;
  }

  const esA = partido.personaAId === idA;
  const golesA = esA ? partido.golesA : partido.golesB;
  const golesB = esA ? partido.golesB : partido.golesA;

  let resultado='Empate'; let chipClass='chip-e';
  if(golesA > golesB){ resultado='Victoria'; chipClass='chip-v'; }
  else if(golesA < golesB){ resultado='Derrota'; chipClass='chip-d'; }

  return `
    <div class="fixture-row jugado">
      <div class="fixture-main" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span>${escapeHtml(a.nombre)}</span>
        <span style="color:var(--text-dim);">${escapeHtml(a.equipo)}</span>
        <span class="resultado-chip ${chipClass}" style="padding:3px 8px; min-width:28px; text-align:center;">${golesA}</span>
        <span>vs</span>
        <span class="resultado-chip ${chipClass}" style="padding:3px 8px; min-width:28px; text-align:center;">${golesB}</span>
        <span style="color:var(--text-dim);">${escapeHtml(b.equipo)}</span>
        <span>${escapeHtml(b.nombre)}</span>
      </div>
      <span class="resultado-chip ${chipClass}">${resultado}</span>
    </div>
  `;
}

function renderFechas(){
  refreshUserBar();
  const cont = document.getElementById('fechasSemanas');
  const label = document.getElementById('fechasViendoLabel');

  if(roster.length < 2){
    label.textContent = '';
    cont.innerHTML = `<p class="empty-note">No hay suficientes participantes para armar el fixture completo.</p>`;
    return;
  }

  const filtroSel = document.getElementById('fechasFiltroPersona');
  const filtroPrev = filtroSel.value;
  filtroSel.innerHTML = `<option value="">Todos</option>` + roster.map(r => `<option value="${r.id}">${escapeHtml(r.nombre)}</option>`).join('');
  if([...filtroSel.options].some(o => o.value === filtroPrev)) filtroSel.value = filtroPrev;
  const filtroId = filtroSel.value;

  label.textContent = 'Fixture completo';
  const rondas = calcularRondas();
  const totalSemanas = Math.ceil(rondas.length / RONDAS_POR_SEMANA);
  const idxActual = Math.min(semanaActualIndex(), Math.max(0, totalSemanas - 1));

  if(rondas.length === 0){
    cont.innerHTML = `<p class="empty-note">Necesitás al menos otra persona en el plantel para armar el fixture.</p>`;
    return;
  }

  cont.innerHTML = Array.from({ length: totalSemanas }, (_, semanaIdx) => {
    const esActual = semanaIdx === idxActual;
    const rondaInicio = semanaIdx * RONDAS_POR_SEMANA;
    const rondasDeEstaSemana = rondas.slice(rondaInicio, rondaInicio + RONDAS_POR_SEMANA);

    const filas = rondasDeEstaSemana.map((ronda, offset) => {
      const rondaIdx = rondaInicio + offset;
      return ronda
        .filter(([idA, idB]) => !filtroId || idA === filtroId || idB === filtroId)
        .map(([idA, idB]) => renderFilaFixture(idA, idB, rondaIdx))
        .join('');
    }).join('');

    if(filtroId && !filas) return '';

    return `
      <div class="semana-block ${esActual ? 'actual' : ''}">
        <div class="semana-header">
          <h4>Semana ${semanaIdx+1}</h4>
          ${esActual ? '<span class="semana-tag-actual">Semana Actual</span>' : ''}
        </div>
        ${filas}
      </div>
    `;
  }).join('');
}


function onFixtureFormatoChange(){
  const sel = document.getElementById('fixtureFormato');
  localStorage.setItem(LS_FIXTURE_FORMATO, sel.value);
  const tabFechas = document.getElementById('tab-fechas');
  if(tabFechas && !tabFechas.classList.contains('hidden')){ renderFechas(); }
  refreshUserBar();
  showToast('Formato de fixture actualizado');
}

function cargarPoolsEnTextareas(){
  document.getElementById('fixtureFormato').value = localStorage.getItem(LS_FIXTURE_FORMATO) || 'ida';
  const personas = localStorage.getItem(LS_POOL_PERSONAS);
  const equipos = localStorage.getItem(LS_POOL_EQUIPOS);
  document.getElementById('sorteoPersonas').value = personas !== null ? personas : roster.map(r=>r.nombre).join('\n');
  document.getElementById('sorteoEquipos').value = equipos !== null ? equipos : roster.map(r=>r.equipo).join('\n');
  renderSorteoResultado(roster);
}

async function realizarSorteo(){
  const personasRaw = document.getElementById('sorteoPersonas').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const equiposRaw = document.getElementById('sorteoEquipos').value.split('\n').map(s=>s.trim()).filter(Boolean);

  if(personasRaw.length === 0 || equiposRaw.length === 0){
    showToast('Cargá al menos una persona y un equipo'); return;
  }
  if(equiposRaw.length < personasRaw.length){
    showToast('Necesitás al menos tantos equipos como personas'); return;
  }
  if(partidos.length > 0){
    const ok = confirm('Ya hay partidos cargados en esta liga. Al volver a sortear se arma un plantel nuevo y se REINICIAN todas las estadísticas: Posiciones, Goleadores y Tarjetas Rojas quedarán en 0, y arranca una semana 1 nueva. ¿Continuar?');
    if(!ok) return;
  }

  const equiposShuffled = [...equiposRaw];
  for(let i = equiposShuffled.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [equiposShuffled[i], equiposShuffled[j]] = [equiposShuffled[j], equiposShuffled[i]];
  }

  try{
    const allIncidencias = await apiFetch('/incidencias');
    for(const i of allIncidencias){
      await apiFetch('/incidencias/'+i.id_incidencia, { method:'DELETE', auth:true });
    }
    for(const m of partidos){
      await apiFetch('/partidos/'+m.id, { method:'DELETE', auth:true });
    }
    for(const p of roster){
      await apiFetch('/personas/'+p.id, { method:'DELETE', auth:true });
    }

    for(let idx=0; idx<personasRaw.length; idx++){
      const id_equipo = await findOrCreateEquipoId(equiposShuffled[idx]);
      await apiFetch('/personas', { method:'POST', auth:true, body:{ nombre:personasRaw[idx], id_equipo } });
    }

    localStorage.setItem(LS_POOL_PERSONAS, personasRaw.join('\n'));
    localStorage.setItem(LS_POOL_EQUIPOS, equiposRaw.join('\n'));
    localStorage.setItem(LS_TORNEO_INICIO, new Date().toISOString());

    await loadState();
    localStorage.setItem(LS_ACTIVE_USER, roster[0] ? roster[0].id : '');

    renderSorteoResultado(roster);
    renderAll();
    showToast('¡Sorteo realizado! Estadísticas reiniciadas — arranca la Semana 1.');
  }catch(err){
    // Si falla a mitad de camino puede quedar un estado parcialmente borrado;
    // es una herramienta chica de administración, no hace falta rollback.
    showToast('Error al realizar el sorteo: ' + err.message);
  }
}

function renderSorteoResultado(lista){
  const cont = document.getElementById('sorteoResultado');
  if(!lista || lista.length===0){ cont.innerHTML = ''; return; }
  cont.innerHTML = lista.map(r => `
    <div class="sorteo-card">
      <div class="p-name">${escapeHtml(r.nombre)}</div>
      <div class="p-team">→ ${escapeHtml(r.equipo)}</div>
    </div>
  `).join('');
}

function personaOptions(selectedId){
  return roster.map(r => `<option value="${r.id}" ${r.id===selectedId?'selected':''}>${escapeHtml(r.nombre)} (${escapeHtml(r.equipo)})</option>`).join('');
}

function renderMatchForm(){
  const selA = document.getElementById('matchPersonaA');
  const selB = document.getElementById('matchPersonaB');
  selA.innerHTML = personaOptions();
  selB.innerHTML = personaOptions();
  if(roster.length > 1){ selB.selectedIndex = 1; }
  document.getElementById('golesRows').innerHTML = '';
  document.getElementById('rojasRows').innerHTML = '';
}

function agregarFilaGol(jugador='', personaId='', cantidad=1){
  const row = document.createElement('div');
  row.className = 'subrow';
  row.innerHTML = `
    <div class="field" style="margin:0;">
      <label>Jugador Virtual</label>
      <input type="text" class="gol-jugador" placeholder="Ej: Adriano" value="${escapeAttr(jugador)}">
    </div>
    <div class="field" style="margin:0;">
      <label>Persona</label>
      <select class="gol-persona">${personaOptions(personaId)}</select>
    </div>
    <div class="field" style="margin:0;">
      <label>Cant.</label>
      <input type="number" class="gol-cant" min="1" value="${cantidad}">
    </div>
    <button class="mini-x" onclick="this.closest('.subrow').remove()" title="Eliminar">✕</button>
  `;
  document.getElementById('golesRows').appendChild(row);
}

function agregarFilaRoja(jugador='', personaId=''){
  const row = document.createElement('div');
  row.className = 'subrow';
  row.style.gridTemplateColumns = '1fr 1fr 34px';
  row.innerHTML = `
    <div class="field" style="margin:0;">
      <label>Jugador Virtual</label>
      <input type="text" class="roja-jugador" placeholder="Ej: Zidane" value="${escapeAttr(jugador)}">
    </div>
    <div class="field" style="margin:0;">
      <label>Persona</label>
      <select class="roja-persona">${personaOptions(personaId)}</select>
    </div>
    <button class="mini-x" onclick="this.closest('.subrow').remove()" title="Eliminar">✕</button>
  `;
  document.getElementById('rojasRows').appendChild(row);
}

function editarPartido(id){
  const m = partidos.find(p => p.id === id);
  if(!m){ showToast('No se encontró ese partido'); return; }

  editandoPartidoId = id;
  renderMatchForm(); // reconstruye selects según el plantel actual y limpia las filas

  const selA = document.getElementById('matchPersonaA');
  const selB = document.getElementById('matchPersonaB');
  if([...selA.options].some(o => o.value === m.personaAId)) selA.value = m.personaAId;
  if([...selB.options].some(o => o.value === m.personaBId)) selB.value = m.personaBId;
  document.getElementById('matchGolesA').value = m.golesA;
  document.getElementById('matchGolesB').value = m.golesB;

  document.getElementById('golesRows').innerHTML = '';
  document.getElementById('rojasRows').innerHTML = '';
  m.goleadores.forEach(g => agregarFilaGol(g.jugador, g.personaId, g.cantidad));
  m.rojas.forEach(r => agregarFilaRoja(r.jugador, r.personaId));

  document.getElementById('matchFormTitle').textContent = 'Editar Partido';
  document.getElementById('btnGuardarPartido').textContent = '💾 Actualizar Partido';
  document.getElementById('btnCancelarEdicion').classList.remove('hidden');
  document.getElementById('editBannerText').innerHTML =
    `Estás editando <b>${escapeHtml(personaNombre(m.personaAId))} vs ${escapeHtml(personaNombre(m.personaBId))}</b>. Al guardar, se reemplaza el resultado cargado.`;
  document.getElementById('editBanner').classList.remove('hidden');

  document.getElementById('matchFormTitle').scrollIntoView({behavior:'smooth', block:'start'});
}

function cancelarEdicionPartido(){
  editandoPartidoId = null;
  renderMatchForm();
  document.getElementById('matchFormTitle').textContent = 'Cargar Resultado de Partido';
  document.getElementById('btnGuardarPartido').textContent = '💾 Guardar Partido';
  document.getElementById('btnCancelarEdicion').classList.add('hidden');
  document.getElementById('editBanner').classList.add('hidden');
}

async function guardarPartido(){
  const personaAId = document.getElementById('matchPersonaA').value;
  const personaBId = document.getElementById('matchPersonaB').value;
  const golesA = parseInt(document.getElementById('matchGolesA').value || '0', 10);
  const golesB = parseInt(document.getElementById('matchGolesB').value || '0', 10);

  if(!personaAId || !personaBId){ showToast('Necesitás al menos 2 personas en el plantel'); return; }
  if(personaAId === personaBId){ showToast('Las dos personas deben ser distintas'); return; }
  if(isNaN(golesA) || isNaN(golesB) || golesA < 0 || golesB < 0){ showToast('Revisá los goles cargados'); return; }

  const goleadores = [...document.querySelectorAll('#golesRows .subrow')].map(row=>({
    jugador: row.querySelector('.gol-jugador').value.trim(),
    personaId: row.querySelector('.gol-persona').value,
    cantidad: parseInt(row.querySelector('.gol-cant').value || '1', 10)
  })).filter(g => g.jugador.length > 0);

  const rojas = [...document.querySelectorAll('#rojasRows .subrow')].map(row=>({
    jugador: row.querySelector('.roja-jugador').value.trim(),
    personaId: row.querySelector('.roja-persona').value
  })).filter(r => r.jugador.length > 0);

  const totalGolA = goleadores.filter(g=>g.personaId===personaAId).reduce((s,g)=>s+g.cantidad,0);
  const totalGolB = goleadores.filter(g=>g.personaId===personaBId).reduce((s,g)=>s+g.cantidad,0);
  if(totalGolA > golesA || totalGolB > golesB){
    const ok = confirm('Los goleadores cargados superan el marcador ingresado. ¿Guardar de todas formas?');
    if(!ok) return;
  }

  if(editandoPartidoId){
    try{
      const partidoActual = partidos.find(p => p.id === editandoPartidoId);
      await apiFetch('/partidos/'+editandoPartidoId, {
        method:'PUT', auth:true,
        body:{ id_local:personaAId, id_visitante:personaBId, goles_local:golesA, goles_visitante:golesB, numero_fecha: partidoActual ? partidoActual.numeroFecha : null }
      });

      const old = await apiFetch('/incidencias?id_partido='+editandoPartidoId);
      for(const i of old){
        await apiFetch('/incidencias/'+i.id_incidencia, { method:'DELETE', auth:true });
      }

      for(const g of goleadores){
        for(let n=0; n<g.cantidad; n++){
          await apiFetch('/incidencias', {
            method:'POST', auth:true,
            body:{ jugador_virtual:g.jugador, tipo:'G', id_persona:g.personaId, id_partido:editandoPartidoId }
          });
        }
      }
      for(const r of rojas){
        await apiFetch('/incidencias', {
          method:'POST', auth:true,
          body:{ jugador_virtual:r.jugador, tipo:'R', id_persona:r.personaId, id_partido:editandoPartidoId }
        });
      }

      cancelarEdicionPartido();
      await loadState();
      renderAll();
      renderHistorial();
      showToast('Partido actualizado y tablas recalculadas');
    }catch(err){
      showToast(err.message);
    }
    return;
  }

  try{
    const rondas = calcularRondas();
    const numero_fecha = proximaRondaLibreParaPar(rondas, personaAId, personaBId);
    const nuevo = await apiFetch('/partidos', {
      method:'POST', auth:true,
      body:{ id_local:personaAId, id_visitante:personaBId, goles_local:golesA, goles_visitante:golesB, numero_fecha }
    });

    for(const g of goleadores){
      for(let n=0; n<g.cantidad; n++){
        await apiFetch('/incidencias', {
          method:'POST', auth:true,
          body:{ jugador_virtual:g.jugador, tipo:'G', id_persona:g.personaId, id_partido:nuevo.id_partido }
        });
      }
    }
    for(const r of rojas){
      await apiFetch('/incidencias', {
        method:'POST', auth:true,
        body:{ jugador_virtual:r.jugador, tipo:'R', id_persona:r.personaId, id_partido:nuevo.id_partido }
      });
    }

    await loadState();
    renderMatchForm();
    renderAll();
    showToast('Partido guardado y tablas actualizadas');
  }catch(err){
    showToast(err.message);
  }
}

function renderHistorial(){
  const tbody = document.getElementById('historialBody');
  if(partidos.length===0){
    tbody.innerHTML = `<tr><td colspan="4" class="empty-note">Sin partidos cargados.</td></tr>`;
    return;
  }
  tbody.innerHTML = [...partidos].reverse().map(m=>{
    const detalle = [
      ...m.goleadores.map(g=>`⚽ ${escapeHtml(g.jugador)} (${escapeHtml(personaNombre(g.personaId))}) x${g.cantidad}`),
      ...m.rojas.map(r=>`🟥 ${escapeHtml(r.jugador)} (${escapeHtml(personaNombre(r.personaId))})`)
    ].join(' &nbsp;·&nbsp; ') || '—';
    return `
      <tr>
        <td class="left" data-label="Partido">${escapeHtml(personaNombre(m.personaAId))} vs ${escapeHtml(personaNombre(m.personaBId))}</td>
        <td class="pts-cell" data-label="Resultado">${m.golesA} - ${m.golesB}</td>
        <td class="left" style="font-size:13px; color:var(--text-dim); font-weight:500;" data-label="Detalle">${detalle}</td>
        <td data-label="Acción">
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick="editarPartido('${m.id}')">Editar</button>
            <button class="btn btn-red btn-sm" onclick="eliminarPartido('${m.id}')">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function eliminarPartido(id){
  if(!confirm('¿Eliminar este partido? Se recalcularán todas las tablas.')) return;
  try{
    const incs = await apiFetch('/incidencias?id_partido='+id);
    for(const i of incs){
      await apiFetch('/incidencias/'+i.id_incidencia, { method:'DELETE', auth:true });
    }
    await apiFetch('/partidos/'+id, { method:'DELETE', auth:true });
    if(editandoPartidoId === id){ cancelarEdicionPartido(); }
    await loadState();
    renderAll();
    renderHistorial();
    showToast('Partido eliminado');
  }catch(err){
    showToast(err.message);
  }
}

function renderRosterEdit(){
  const cont = document.getElementById('rosterEditList');
  if(roster.length===0){
    cont.innerHTML = `<p class="empty-note">No hay participantes. Agregá uno o realizá un sorteo.</p>`;
    return;
  }
  cont.innerHTML = roster.map(r=>`
    <div class="roster-edit-row" data-id="${r.id}">
      <input type="text" class="roster-nombre" value="${escapeAttr(r.nombre)}">
      <input type="text" class="roster-equipo" value="${escapeAttr(r.equipo)}">
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" onclick="guardarFilaRoster('${r.id}')">Guardar</button>
        <button class="btn btn-red btn-sm" onclick="eliminarPersonaRoster('${r.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

async function guardarFilaRoster(id){
  const row = document.querySelector(`.roster-edit-row[data-id="${id}"]`);
  const nombre = row.querySelector('.roster-nombre').value.trim();
  const equipo = row.querySelector('.roster-equipo').value.trim();
  if(!nombre || !equipo){ showToast('Nombre y equipo no pueden estar vacíos'); return; }
  try{
    const id_equipo = await findOrCreateEquipoId(equipo);
    await apiFetch('/personas/'+id, { method:'PUT', auth:true, body:{ nombre, id_equipo } });
    await loadState();
    renderAll();
    renderMatchForm();
    showToast('Participante actualizado');
  }catch(err){
    showToast(err.message);
  }
}

async function eliminarPersonaRoster(id){
  const p = personaById(id);
  if(!p) return;
  const tienePartidos = partidos.some(m=>m.personaAId===id || m.personaBId===id);
  const msg = tienePartidos
    ? `${p.nombre} tiene partidos cargados en el historial. Si lo eliminás, esos partidos van a mostrar "(eliminado)". ¿Continuar?`
    : `¿Eliminar a ${p.nombre} del plantel?`;
  if(!confirm(msg)) return;
  try{
    await apiFetch('/personas/'+id, { method:'DELETE', auth:true });
    await loadState();
    renderAll();
    renderRosterEdit();
    renderMatchForm();
    showToast('Participante eliminado');
  }catch(err){
    showToast(err.message);
  }
}

async function agregarPersonaRoster(){
  try{
    await apiFetch('/personas', { method:'POST', auth:true, body:{ nombre:'Nuevo Jugador', id_equipo:null } });
    await loadState();
    renderRosterEdit();
    renderMatchForm();
    renderPosiciones();
  }catch(err){
    showToast(err.message);
  }
}


function renderAdmin(){
  refreshAdminUI();
  if(!isAdmin()) return;
  if(!editandoPartidoId){ renderMatchForm(); }
  renderHistorial();
  renderRosterEdit();
}


function renderAll(){
  renderPosiciones();
  renderGoleadores();
  renderRojas();
  refreshUserBar();
  const tabFechas = document.getElementById('tab-fechas');
  if(tabFechas && !tabFechas.classList.contains('hidden')){ renderFechas(); }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str){ return escapeHtml(str); }

(async () => {
  await loadState();
  renderAll();
  refreshAdminUI();
  refreshUserBar();
})();
