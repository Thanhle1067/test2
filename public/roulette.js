// Helper: weighted random index
function pickWeightedIndex(weights){
  const total = weights.reduce((a,b)=>a+b,0);
  const r = Math.random() * total;
  let acc=0; for (let i=0;i<weights.length;i++){ acc+=weights[i]; if (r<=acc) return i; }
  return weights.length-1;
}

const state = { config: null, spinning:false, angle:0 };
let sse;

async function fetchConfig(){
  const res = await fetch('/config');
  state.config = await res.json();
}

function renderWheel(){
  const root = document.querySelector('.wheel');
  const wraps = document.querySelector('.labels');
  wraps.innerHTML = '';
  const N = state.config.entries.length;
  const step = 360/N;

  // labels
  for (let i=0;i<N;i++){
    const div = document.createElement('div');
    div.className = 'slice-label';
    div.textContent = state.config.entries[i].label;
    const angle = (i*step) + step/2; // center
    div.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
    wraps.appendChild(div);
  }

  document.querySelector('.title').textContent = state.config.wheelTitle || 'Roulette';
}

function playSfx(url){
  if (!url) return; const a = new Audio(url); a.volume = 0.9; a.play().catch(()=>{});
}

function confettiBurst(){
  const host = document.querySelector('.confetti');
  host.innerHTML = '';
  const n = 50 + Math.floor(Math.random()*40);
  for (let i=0;i<n;i++){
    const p = document.createElement('i');
    p.style.left = Math.random()*100 + 'vw';
    p.style.background = `hsl(${Math.random()*360}, 90%, 60%)`;
    p.style.transform = `translateY(-10vh) rotate(${Math.random()*180}deg)`;
    p.style.animationDelay = (Math.random()*0.5)+'s';
    host.appendChild(p);
  }
  setTimeout(()=> host.innerHTML='', 2000);
}

function computeSpinTarget(){
  const N = state.config.entries.length;
  const step = 360/N;
  const weights = state.config.entries.map(e => Math.max(0.0001, Number(e.weight)||1));
  const idx = pickWeightedIndex(weights);
  // pointer ở 12h → muốn center của idx nằm tại 0deg sau quay
  const centerDeg = (idx*step) + step/2;
  const offset = state.config.spin.pointerOffsetDeg || 0;
  const targetDeg = 360 - centerDeg + offset; // quay đến góc này modulo 360

  // thêm số vòng lớn + jitter nhỏ
  const [minR,maxR] = state.config.spin.baseRotations || [5,8];
  const baseRot = Math.floor(minR + Math.random()*(maxR-minR+1));
  const jitter = (Math.random()*6 - 3); // ±3°
  const finalDeg = (baseRot*360) + targetDeg + jitter;
  return { idx, finalDeg };
}

async function requestNextJob(){
  const res = await fetch('/next-spin', { method:'POST' });
  const { job } = await res.json();
  return job; // {id,user,amount,reason} | null
}

async function doSpin(job){
  if (state.spinning) return;
  state.spinning = true;

  const wheel = document.querySelector('.wheel');
  wheel.style.transition = 'none';
  wheel.style.transform = `rotate(${state.angle}deg)`; // keep current angle
  // force style recalc
  wheel.getBoundingClientRect();

  const { idx, finalDeg } = computeSpinTarget();
  const duration = state.config.spin.durationMs || 5200;

  // Tick sound timer
  let tickTimer = setInterval(()=> playSfx(state.config.sfx?.tick), 200);

  // Animate
  requestAnimationFrame(()=>{
    wheel.style.transition = `transform ${duration}ms cubic-bezier(.12,.65,.12,1)`;
    wheel.style.transform = `rotate(${state.angle + finalDeg}deg)`;
  });

  await new Promise(r=> setTimeout(r, duration + 50));
  clearInterval(tickTimer);

  state.angle = (state.angle + finalDeg) % 360;
  const winner = state.config.entries[idx];
  document.querySelector('.winner').textContent = `${winner.label}`;
  document.querySelector('.badge').classList.remove('hidden');
  playSfx(state.config.sfx?.win);
  confettiBurst();

  // announce
  const who = job?.user || 'Khách';
  const msg = `${who} trúng: ${winner.label}`;
  console.log('[WIN]', msg);

  // small display time then hide
  await new Promise(r=> setTimeout(r, 1800));
  document.querySelector('.badge').classList.add('hidden');

  state.spinning = false;
}

async function spinLoop(){
  // gọi liên tục để lấy job mới
  if (!state.spinning){
    const job = await requestNextJob();
    if (job) await doSpin(job);
  }
  requestAnimationFrame(spinLoop);
}

function startSSE(){
  sse = new EventSource('/events');
  sse.addEventListener('init', (e)=>{
    const data = JSON.parse(e.data);
    state.config = data.config; renderWheel();
  });
  sse.addEventListener('config', (e)=>{
    state.config = JSON.parse(e.data); renderWheel();
  });
}

window.addEventListener('DOMContentLoaded', async ()=>{
  await fetchConfig();
  renderWheel();
  startSSE();
  spinLoop();
});
