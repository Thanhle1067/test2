const express = require('express');
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname,'public')));

let seconds = 0, lastEventId = 0, lastDelta = 0, lastType = 'normal', active = false;

setInterval(()=>{ if(seconds>0){ seconds--; if(seconds<=0){ seconds=0; active=false; } } },1000);

function pickSeconds(req, def = 10){
  const q = req.query || {};
  const b = req.body  || {};
  let s = q.sec ?? b.sec ?? b.amount ?? b.repeatCount ?? b.value1 ?? b.value2;
  s = parseInt(String(s || def), 10);
  return Number.isFinite(s) && s > 0 ? s : def;
}

app.all('/api/add',(req,res)=>{
  const s = pickSeconds(req, 10);
  seconds += s; lastDelta = s; lastType='normal'; lastEventId++; active=true;
  res.json({ok:true,method:req.method,seconds,lastDelta,lastType,lastEventId,active});
});

app.all('/api/rescue',(req,res)=>{
  const s = pickSeconds(req, 10);
  const doReset = (typeof pickReset==='function') ? pickReset(req) : false;
  const before = seconds;
  seconds = doReset ? 0 : Math.max(0, seconds - s);
  lastDelta = seconds - before; lastType = doReset ? 'reset':'rescue'; lastEventId++;
  if(seconds===0) active=false;
  res.json({ ok:true, method:req.method, seconds, lastDelta, lastType, lastEventId, active, reset: doReset });
});

});

app.get('/api/state',(req,res)=>res.json({ok:true,seconds,lastDelta,lastType,lastEventId,active}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server on '+PORT));

function pickReset(req){ try{ const q=req.query||{}; const b=req.body||{}; const v=(q.reset??b.reset??''); return ['1','true',1,true].includes(v); }catch(e){ return false; } }

app.all('/api/reset',(req,res)=>{
  const before = seconds; seconds = 0; active = false;
  lastDelta = seconds - before; lastType = 'reset'; lastEventId++;
  res.json({ ok:true, method:req.method, seconds, lastDelta, lastType, lastEventId, active });
});
