(() => {
  'use strict';
  const scene = document.createElement('section');
  scene.className = 'adventure-shell';
  scene.innerHTML = '<div class="adventure-head"><span>✦ LES KOUZELNÝCH SLABIK</span><span id="adventure-counter">0 / 25 kouzel</span></div><div class="adventure-stage"><canvas id="adventure-canvas" width="960" height="400" role="img" aria-label="Animovaná hrdinka s liškou prochází pixelovým lesem a kouzlí cestu k pokladu"></canvas><span class="adventure-location">Mýtina u starého dubu</span></div><div class="adventure-tip" id="adventure-tip">Přečti slabiku, vykouzli cestu a najdi poklad.</div><div class="adventure-credit">Grafika: GandalfHardcore</div>';
  const lessonPanel = document.querySelector('section.card');
  if (!lessonPanel) return;
  lessonPanel.insertAdjacentElement('afterend', scene);
  const canvas = scene.querySelector('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = 960, H = 400, FLOOR = 316, IMPACT = 620, STEP = 220, WALK = 2200, REVEAL = 1400;
  const sprites = {};
  const assetQuery = document.currentScript?.src?.split('?')[1];
  const names = ['girl','forest1','forest2','forest3','forest4','forest5','oak','birch','grass','path','cloud','sun','birds','campfire','fox','wisp','slime','skeleton','warrior','chest','healing','tent','stump','logs','rocks','mushrooms','bush'];
  for (const name of names) {
    const image = new Image();
    image.src = '/assets/' + name + '.png' + (assetQuery ? '?' + assetQuery : '');
    image.onerror = () => { tip().textContent = 'Grafiku se nepodařilo načíst. Obnov stránku.'; };
    sprites[name] = image;
  }
  const ready = name => sprites[name]?.complete && sprites[name]?.naturalWidth > 0;
  const tip = () => document.getElementById('adventure-tip');
  const now = () => performance.now();
  let state = {progress:0,total:25,phase:'idle',since:0,finished:false,encounter:0};
  let animationRun = 0, camera = 0, travelFrom = 0;
  const setPhase = phase => { state.phase = phase; state.since = now(); };
  function image(name, x, y, w, h, alpha=1) {
    if (!ready(name)) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites[name], Math.round(x), Math.round(y), w, h);
    ctx.globalAlpha = 1;
  }
  function atlas(name, col, row, fw, fh, x, feet, scale, alpha=1, flip=false, rotation=0) {
    if (!ready(name)) return;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(feet));
    if (flip) ctx.scale(-1,1);
    // Rotate the sprite around its center while keeping its anchor stable.
    if(rotation){ctx.translate(0,-fh*scale/2);ctx.rotate(rotation);ctx.translate(0,fh*scale/2);}
    ctx.drawImage(sprites[name], col*fw, row*fh, fw, fh, -fw*scale/2, -fh*scale, fw*scale, fh*scale);
    ctx.restore();
  }
  function frame(t) {
    const elapsed=Math.max(0,t-state.since),walking=state.phase==='walking',casting=state.phase==='spell';
    if(walking){
      const distance=Math.min(1,elapsed/(state.progress>=state.total?REVEAL:WALK));
      const eased=distance*distance*(3-2*distance);
      const destination=state.progress>=state.total?(state.total-1)*STEP+360:state.progress*STEP;
      camera=travelFrom+(destination-travelFrom)*eased;
    }
    if(state.phase==='arriving' && elapsed>=450) setPhase('idle');
    ctx.clearRect(0,0,W,H); ctx.imageSmoothingEnabled = false;
    // All scenery comes from the original pixel art. No procedural replacement art.
    image('sun',735-camera*.025,28,78,78,.8);
    for (let i=0;i<5;i++) {
      const x=((i*270-t*.004-camera*.08)%1400+1400)%1400-160;
      image('cloud',x,35+(i%3)*23,125+(i%2)*45,50+(i%2)*18,.7);
    }
    for (let layer=5;layer>=1;layer--) {
      const name='forest'+layer;
      if (!ready(name)) continue;
      const width=sprites[name].width*H/sprites[name].height;
      const offset=(camera*(6-layer)*.13)%width;
      for(let x=-offset;x<W;x+=width) image(name,x,0,width,H);
    }
    image('birds',((t*.021-camera*.1)%1250)-100,65+Math.sin(t*.0006)*13,60,60,.7);
    // Tile the seamless center piece of Floor Tiles1 along the trail.
    for(let x=-(camera%64)-64;x<W;x+=64) image('path',x,FLOOR,64,128);
    for(let i=0;i<6;i++) {
      const x=((i*340-camera*.7)%1800+1800)%1800-260;
      image(i%2?'birch':'oak',x,FLOOR-275,330,275);
    }
    // Fixed world positions: props and campfire move at the same speed as the trail.
    const worldX=x=>((x-camera+300)%2200+2200)%2200-300;
    const prop=(name,world,width,groundOffset=0)=>{
      if(!ready(name))return;
      const height=width*sprites[name].height/sprites[name].width;
      image(name,worldX(world)-width/2,FLOOR+3+groundOffset-height,width,height);
    };
    prop('tent',870,150);
    prop('logs',1095,82);
    prop('stump',425,65);
    prop('rocks',1370,126,18);
    prop('mushrooms',1640,78);
    prop('bush',1910,116,4);
    atlas('campfire',Math.floor(t/110)%5,0,32,32,worldX(1000),FLOOR+3,2);
    const encounter=casting?state.encounter:state.progress;
    const enemy=Math.floor(encounter/5)%3;
    const hurt=casting && elapsed>=IMPACT;
    const death= Math.max(0,elapsed-IMPACT);
    if (!walking && !state.finished && (state.progress<state.total || casting)) {
      const fade=hurt?Math.max(0,1-death/650):1;
      const arrival=state.phase==='arriving'?Math.min(1,elapsed/450):1;
      const x=690+360*(1-arrival)*(1-arrival);
      if(enemy===0) atlas('slime',hurt?Math.min(5,Math.floor(death/100)):Math.floor(t/135)%5,hurt?2:0,32,32,x,FLOOR+5,3,fade);
      if(enemy===1) atlas('skeleton',hurt?Math.min(9,Math.floor(death/65)):Math.floor(t/150)%10,hurt?5:0,64,64,x,FLOOR+8,2.4,fade);
      if(enemy===2) atlas('warrior',Math.floor(t/165)%5,0,80,64,x,FLOOR+8,2.8,fade);
    }
    const chestX=(state.total-1)*STEP+1175-camera;
    if(chestX>=-48 && chestX<=W+48) {
      atlas('chest',0,state.finished?Math.min(12,Math.floor(elapsed/90)):0,32,32,chestX,FLOOR+3,3);
      if(state.finished) atlas('healing',0,Math.floor(t/120)%8,16,16,chestX,FLOOR-100+Math.sin(t*.004)*7,3);
    }
    const finalApproach=state.progress>=state.total && !casting;
    const walkFraction=Math.max(0,Math.min(1,(elapsed-(finalApproach?REVEAL:0))/WALK));
    const walkEase=walkFraction*walkFraction*(3-2*walkFraction);
    const heroX=finalApproach?(walking?300+455*walkEase:755):300;
    // Walk all the way up to the chest before the opening phase begins.
    atlas('girl',casting?Math.min(5,Math.floor(elapsed/115)):walking?Math.floor(t/100)%8:Math.floor(t/220)%5,casting?5:walking?1:0,80,64,heroX,FLOOR+3,3,1,true);
    atlas('fox',walking?Math.floor(t/90)%6:Math.floor(t/210)%5,walking?1:0,32,32,heroX-103,FLOOR+5,2.4);
    const spellX=casting?330+Math.min(1,elapsed/IMPACT)*365:heroX+75+Math.sin(t*.0018)*15;
    const spellY=casting?FLOOR-10:FLOOR-120+Math.sin(t*.003)*12;
    atlas('wisp',Math.floor(t/90)%5,0,32,32,spellX,spellY,casting?2.7:1.7,casting?Math.max(0,1-Math.max(0,elapsed-IMPACT)/180):.85,false,casting?-Math.PI/2:0);
    // Edge trees frame the path without covering the characters.
    image('oak',((-225-camera*1.2+450)%2250+2250)%2250-450,FLOOR-632,860,700);
    image('birch',((900-camera*1.2+450)%2250+2250)%2250-450,FLOOR-602,720,670);
    for(let i=0;i<12;i++) {
      const x=((i*127-camera*1.15)%1500+1500)%1500-180;
      image('grass',x,FLOOR+18+(i%3)*15,144,48,.9);
    }
    requestAnimationFrame(frame);
  }
  function updateCounter(){document.getElementById('adventure-counter').textContent=state.progress+' / '+state.total+' kouzel';}
  function reset(progress,total){animationRun++;state.progress=Math.max(0,progress||0);state.total=Math.max(1,total||25);state.finished=false;camera=state.progress*STEP;setPhase('idle');updateCounter();tip().textContent='Přečti slabiku, vykouzli cestu a najdi poklad.';}
  function advance(){
    if(state.finished)return;
    const animation=++animationRun;state.encounter=state.progress;state.progress=Math.min(state.total,state.progress+1);updateCounter();setPhase('spell');
    tip().textContent=state.progress===state.total?'Poslední kouzlo! Truhla už čeká.':'Kouzlo se povedlo! Liška tě doprovodí dál.';
    setTimeout(()=>{if(animation!==animationRun)return;travelFrom=camera;setPhase('walking');},1500);
    setTimeout(()=>{if(animation!==animationRun)return;if(state.progress<state.total)camera=state.progress*STEP;if(state.progress>=state.total){camera=(state.total-1)*STEP+360;state.finished=true;setPhase('chest');tip().textContent='Poklad nalezen. Lekce je hotová.';}else setPhase('arriving');},1500+WALK+(state.progress>=state.total?REVEAL:0));
  }
  window.SlabikAdventure={reset,advance,finish(){this.setProgress(state.total,state.total);},setProgress(p,total){animationRun++;state.total=Math.max(1,total);state.progress=Math.max(0,Math.min(p,state.total));state.finished=state.progress>=state.total;camera=state.finished?(state.total-1)*STEP+360:state.progress*STEP;setPhase(state.finished?'chest':'idle');updateCounter();tip().textContent=state.finished?'Poklad nalezen. Lekce je hotová.':'Přečti slabiku, vykouzli cestu a najdi poklad.';}};
  reset(0,25);requestAnimationFrame(frame);
})();
