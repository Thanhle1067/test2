let seconds=0, stage=1, lastEventId=0;
const params=new URLSearchParams(location.search);
const T2=parseInt(params.get('t2')||'10000',10);
const IMG_TIER1='./bars-default.png', IMG_TIER2='./bars-gold.png';

const root=document.getElementById('root');
const baseBars=document.getElementById('bars');
const counter=document.getElementById('counter');
const popup=document.getElementById('popup');
const bombEl=document.getElementById('bomb');
const explosionEl=document.getElementById('explosion');

const sndTing=document.getElementById('snd-ting');
const sndClack=document.getElementById('snd-clack');
const sndBoom=document.getElementById('snd-boom');
let pullPlayedOnce=false;
const sndPull=document.getElementById('snd-pull');

[IMG_TIER1,IMG_TIER2].forEach(src=>{const i=new Image();i.src=src;});

function showBars(){
  try{ if(!pullPlayedOnce){ sndPull.currentTime=0; sndPull.play().catch(()=>{}); pullPlayedOnce=true; } }catch(e){}

  try{ if(sndPull){ sndPull.currentTime = 0; sndPull.play(); } }catch(e){}
  baseBars.classList.remove('hidden','exit');
  baseBars.classList.add('enter');
  if(!baseBars.style.backgroundImage) baseBars.style.backgroundImage = `url(${IMG_TIER1})`;
  setTimeout(()=> baseBars.classList.remove('enter'), 900);
}
function hideBars(){
  pullPlayedOnce=false;

  baseBars.classList.add('exit');
  setTimeout(()=>{
    baseBars.classList.add('hidden');
    baseBars.classList.remove('exit');
  }, 900);
}

function render(){
  if(seconds>0){
    counter.textContent = seconds + ' giây';
    counter.classList.remove('hidden');
  } else {
    counter.classList.add('hidden');
  }
}

function showPopupText(text, negative=false){
  popup.textContent = text;
  popup.className = 'popup show' + (negative ? ' negative' : '');
  setTimeout(()=>{ popup.className = 'popup'; }, 1000);
}

function swapBars(url){
  const incoming=document.createElement('div');
  incoming.className='bars next';
  incoming.style.backgroundImage=`url(${url})`;
  root.appendChild(incoming);
  incoming.addEventListener('animationend',()=>{
    baseBars.style.backgroundImage=`url(${url})`;
    root.removeChild(incoming);
  },{once:true});
}

function updateStageBySeconds(s){
  const newStage=(s>=T2)?2:1;
  if(newStage===stage) return;
  stage=newStage;
  swapBars(stage===2?IMG_TIER2:IMG_TIER1);
}

function triggerBomb(){
  bombEl.classList.remove('hidden');
  bombEl.classList.add('fall');
  bombEl.addEventListener('animationend',()=>{
    bombEl.classList.add('hidden');
    bombEl.classList.remove('fall');
    explosionEl.classList.remove('hidden');
    explosionEl.classList.add('boom');
    try{ sndBoom.currentTime=0; sndBoom.play(); }catch(e){}
    baseBars.classList.add('shake');
    setTimeout(()=>baseBars.classList.remove('shake'), 700);
    setTimeout(()=>{
      explosionEl.classList.add('hidden');
      explosionEl.classList.remove('boom');
    }, 650);
  }, { once:true });
}

async function poll(){
  try{
    const r=await fetch('/api/state'); const j=await r.json(); if(!j.ok) return;

    if((j.active||j.seconds>0) && baseBars.classList.contains('hidden')){
      showBars();
    }

    if(j.lastEventId && j.lastEventId!==lastEventId){
      if(j.lastType==='reset'){ try{ hideBars(); }catch(e){} }
      const d=j.lastDelta||0;
      if(d>0){
        try{ sndTing.currentTime=0; sndTing.play(); }catch(e){}
        showPopupText('+'+d+' giây', false);
      }else if(d<0){
        try{ sndClack.currentTime=0; sndClack.play(); }catch(e){}
        showPopupText(d+' giây', true);
        if(j.lastType==='rescue'){ triggerBomb(); }
      }
      lastEventId=j.lastEventId;
    }

    seconds=j.seconds|0;
    updateStageBySeconds(seconds);
    render();

    if(!j.active && seconds<=0 && !baseBars.classList.contains('hidden')){
      hideBars();
    }
  }catch(e){
  }finally{
    setTimeout(poll,700);
  }
}
poll();


/* === SFX Enhancer: play sounds on add/rescue + stage change === */
(function(){
  const addSfx = document.getElementById('snd-ting');
  const rescueSfx = document.getElementById('snd-clack');
  const stage2Sfx = document.getElementById('snd-boom');

  let _sfxLastEventId = -1;
  let _prevStage = (typeof stage !== 'undefined') ? stage : 1;

  function stageOf(seconds){
    try{
      const u = new URL(location.href);
      const t2 = parseInt(u.searchParams.get('t2')||'10000', 10);
      return seconds >= t2 ? 2 : 1;
    }catch(e){ return 1; }
  }

  async function pollSfx(){
    try{
      const r = await fetch('/api/state');
      const j = await r.json();
      if(!j || !j.ok) throw new Error('bad state');

      // Event-based SFX
      if (typeof j.lastEventId === 'number' && j.lastEventId !== _sfxLastEventId){
        if (_sfxLastEventId !== -1){ // skip very first sample to avoid double play on load
          if (j.lastType === 'add' && addSfx){
            try { addSfx.currentTime = 0; addSfx.play(); } catch(e){}
          } else if (j.lastType === 'rescue' && rescueSfx){
            try { rescueSfx.currentTime = 0; rescueSfx.play(); } catch(e){}
          }
        }
        _sfxLastEventId = j.lastEventId;
      }

      // Stage change SFX (e.g., hit Tier 2)
      const nowStage = stageOf(j.seconds|0);
      if (nowStage !== _prevStage){
        if (nowStage === 2 && stage2Sfx){
          try { stage2Sfx.currentTime = 0; stage2Sfx.play(); } catch(e){}
        }
        _prevStage = nowStage;
      }
    }catch(e){
      // silent
    }finally{
      setTimeout(pollSfx, 450);
    }
  }
  pollSfx();
})();
/* === /SFX Enhancer === */
