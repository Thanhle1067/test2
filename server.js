const express = require('express');
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let seconds = 0;
let lastEventId = 0;
let lastDelta = 0;
let lastType = 'normal';
let active = false;

// tick every second
setInterval(()=>{
  if (seconds > 0) {
    seconds--;
    if (seconds <= 0) { seconds = 0; active = false; }
  }
}, 1000);

function pickSeconds(req, def = 10){
  const q = req.query || {};
  const b = req.body  || {};
  let s = q.sec ?? b.sec ?? b.amount ?? b.repeatCount ?? b.value1 ?? b.value2;
  s = parseInt(String(s ?? def), 10);
  return Number.isFinite(s) && s > 0 ? s : def;
}
function pickReset(req){
  try{
    const q = req.query || {};
    const b = req.body  || {};
    const v = (q.reset ?? b.reset ?? '');
    return ['1','true',1,true].includes(v);
  }catch(e){ return false; }
}

// Add seconds (show bars)
app.all('/api/add',(req,res)=>{
  const s = pickSeconds(req, 10);
  seconds += s;
  lastDelta = s; lastType = 'add'; lastEventId++; active = true;
  res.json({ ok:true, method:req.method, seconds, lastDelta, lastType, lastEventId, active });
});

// Rescue: subtract or reset to 0
app.all('/api/rescue',(req,res)=>{
  const s = pickSeconds(req, 10);
  const doReset = pickReset(req);
  const before = seconds;
  seconds = doReset ? 0 : Math.max(0, seconds - s);
  lastDelta = seconds - before; lastType = doReset ? 'reset' : 'rescue'; lastEventId++;
  if (seconds === 0) active = false;
  res.json({ ok:true, method:req.method, seconds, lastDelta, lastType, lastEventId, active, reset: doReset });
});

// Reset immediately
app.all('/api/reset',(req,res)=>{
  const before = seconds; seconds = 0; active = false;
  lastDelta = seconds - before; lastType = 'reset'; lastEventId++;
  res.json({ ok:true, method:req.method, seconds, lastDelta, lastType, lastEventId, active });
});

// State
app.get('/api/state',(req,res)=>{
  res.json({ ok:true, seconds, lastDelta, lastType, lastEventId, active });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server on '+PORT));
