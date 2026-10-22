(() => {
  "use strict";
  const scene=document.createElement("section");
  scene.className="adventure-shell";
  scene.innerHTML='<div class="adventure-head"><span>LES KOUZELNÝCH SLABIK</span><span id="adventure-counter">0 / 25 kouzel</span></div><canvas id="adventure-canvas" width="960" height="340" role="img" aria-label="Holčička putuje lesem, potkává příšery a na konci otevře truhlu"></canvas><div class="adventure-tip" id="adventure-tip">Přečti slabiku, vykouzli cestu a najdi poklad.</div>';
  const lessonPanel=document.querySelector("section.card");
  if(!lessonPanel)return;
  lessonPanel.insertAdjacentElement("afterend",scene);
  const canvas=scene.querySelector("canvas"),ctx=canvas.getContext("2d");
  if(!ctx)return;
  const W=960,H=340;
  let state={progress:0,total:25,phase:"idle",since:0,kind:"slime",finished:false};
  const now=()=>performance.now();
  const setPhase=p=>{state.phase=p;state.since=now()};
  const approach=Math.min;
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
  function poly(coords,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(coords[0][0],coords[0][1]);for(let i=1;i<coords.length;i++)ctx.lineTo(coords[i][0],coords[i][1]);ctx.closePath();ctx.fill()}
  function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
  function tree(x,scale,shift=0){let y=248+shift;rect(x-7*scale,y-48*scale,14*scale,72*scale,"#463f33");for(let k=0;k<3;k++){let yy=y-(137-k*35)*scale;poly([[x,yy],[x-(45-k*6)*scale,yy+84*scale],[x+(45-k*6)*scale,yy+84*scale]],k===0?"#2b5b51":k===1?"#34634e":"#416c4d")}}
  function hero(x,y,t){const walk=state.phase==="walking"?Math.sin(t*.016)*5:0;
    ellipse(x,y+3,25,7,"#1d342b55");
    // Tiny pixel inspired girl mage, drawn independently so no third-party sprites are redistributed
    poly([[x-13,y-62+walk],[x+12,y-62+walk],[x+21,y-14],[x-22,y-14]],"#7d52a6");
    rect(x-13,y-25,10,22,"#283f62");rect(x+4,y-25,10,22,"#283f62");
    ellipse(x-8,y-2,9,4,"#3a2937");ellipse(x+10,y-2,9,4,"#3a2937");
    ellipse(x,y-86+walk,20,24,"#704634");ellipse(x,y-82+walk,15,18,"#ffd0a3");
    ellipse(x-4,y-84+walk,2,3,"#2d2d43");ellipse(x+9,y-84+walk,2,3,"#2d2d43");
    poly([[x-25,y-97+walk],[x+20,y-97+walk],[x+2,y-123+walk]],"#70408f");
    poly([[x-24,y-97+walk],[x+21,y-97+walk],[x+15,y-92+walk],[x-27,y-92+walk]],"#543070");
    line(x+17,y-62+walk,x+32,y-99+walk,"#624934",5);ellipse(x+33,y-101+walk,6,6,"#90eff8");
  }
  function monster(x,y,t,kind){const bob=Math.sin(t*.006)*4;ellipse(x,y+4,35,6,"#10292266");
    if(kind==="bat"){poly([[x-40,y-45+bob],[x-20,y-60+bob],[x,y-42+bob],[x+20,y-60+bob],[x+42,y-45+bob],[x+28,y-21+bob],[x,y-32+bob],[x-28,y-21+bob]],"#664a84");ellipse(x,y-42+bob,17,18,"#59416c")}
    else if(kind==="ghost"){ellipse(x,y-50+bob,28,37,"#c5f0df");poly([[x-28,y-51+bob],[x+28,y-51+bob],[x+24,y-16+bob],[x+13,y-24+bob],[x,y-14+bob],[x-13,y-24+bob],[x-25,y-14+bob]],"#c5f0df")}
    else{ellipse(x,y-28+bob,34,30,kind==="goblin"?"#8d9050":"#83b64c");ellipse(x-24,y-35+bob,11,12,kind==="goblin"?"#a1a85f":"#75a840")}
    ellipse(x-11,y-44+bob,5,7,"#fff9ec");ellipse(x+11,y-44+bob,5,7,"#fff9ec");
    ellipse(x-10,y-43+bob,2,4,"#273137");ellipse(x+12,y-43+bob,2,4,"#273137");
  }
  function chest(x,y,t,opened){ellipse(x,y+2,44,8,"#09241e66");rect(x-40,y-54,80,50,"#8b5227");rect(x-38,y-51,76,9,"#ddab51");rect(x-40,y-13,80,9,"#dcab50");rect(x-6,y-45,12,24,"#f8d17a");
    if(opened){poly([[x-42,y-62],[x-41,y-96],[x+39,y-96],[x+43,y-62]],"#ae742f");rect(x-37,y-90,74,8,"#e2b953");
    for(let i=0;i<13;i++){let a=i*2.4+t*.002;ellipse(x+Math.sin(a)*50,y-94+Math.cos(a*.7)*20,2.2,2.2,i%2?"#fff0a9":"#8cf6d7")}}
    else{rect(x-42,y-76,84,27,"#a96c32");rect(x-40,y-74,80,8,"#edc46e")}}
  function frame(t){const p=state.progress/state.total;ctx.clearRect(0,0,W,H);
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#7bb6ad");sky.addColorStop(1,"#d1d3a3");rect(0,0,W,H,sky);
    ellipse(800,54,36,36,"#f7e5a0");
    for(let i=0;i<12;i++){let x=((i*119-p*130)%1130+1130)%1130-70;tree(x,.48,(i%3)*14-14)}
    poly([[0,249],[150,217],[280,239],[420,203],[560,239],[710,205],[960,233],[960,340],[0,340]],"#638760");
    for(let i=0;i<9;i++){let x=((i*161-p*430)%1350+1350)%1350-80;tree(x,.78+((i%3)*.09),0)}
    rect(0,273,W,67,"#426044");rect(0,272,W,12,"#8b8756");
    for(let i=0;i<32;i++){let x=i*37+((i*11)%13);rect(x,278+(i%3)*7,3,7,"#769455")}
    const hx=248;
    let enemyIndex=Math.floor(state.progress/5),hasEnemy=state.progress<state.total;
    let kind=["slime","bat","ghost","goblin","slime"][Math.min(4,enemyIndex)];
    if(hasEnemy && state.phase!=="chest") {
      let fade=state.phase==="spell"?Math.max(0,1-(t-state.since)/700):1;
      ctx.save();ctx.globalAlpha=fade;monster(660,268,t,kind);ctx.restore();
    }
    if(state.progress>=state.total||state.phase==="chest")chest(700,268,t,state.finished);
    hero(hx+(state.phase==="walking"?Math.min(110,(t-state.since)/6):0),270,t);
    if(state.phase==="spell"){let k=Math.min(1,(t-state.since)/650),x=282+k*365;ellipse(x,167+Math.sin(k*6)*12,18+9*k,18+9*k,"#e4fcab");ellipse(x,167+Math.sin(k*6)*12,11,11,"#86ead0")}
    if(state.finished){ctx.fillStyle="#0b2730cc";ctx.fillRect(240,85,480,122);ctx.fillStyle="#fff8db";ctx.font="bold 36px system-ui";ctx.textAlign="center";ctx.fillText("POKLAD JE TVŮJ!",480,139);ctx.font="19px system-ui";ctx.fillText("Lekce je dokončena",480,175);ctx.textAlign="left"}
    requestAnimationFrame(frame)}
  function updateCounter(){document.getElementById("adventure-counter").textContent=state.progress+" / "+state.total+" kouzel"}
  function reset(progress,total){state.progress=Math.max(0,progress||0);state.total=Math.max(1,total||25);state.finished=false;setPhase("idle");updateCounter();document.getElementById("adventure-tip").textContent="Přečti slabiku, vykouzli cestu a najdi poklad."}
  function advance(){if(state.finished)return;const previous=state.progress;state.progress=Math.min(state.total,state.progress+1);updateCounter();setPhase("spell");
    document.getElementById("adventure-tip").textContent=state.progress===state.total?"Poslední kouzlo! Truhla už čeká.":"Kouzlo se povedlo! Vyrážíme dál.";
    setTimeout(()=>{if(state.progress!==previous+1)return;setPhase("walking")},680);
    setTimeout(()=>{if(state.progress!==previous+1)return;if(state.progress>=state.total){state.finished=true;setPhase("chest");document.getElementById("adventure-tip").textContent="Poklad nalezen. Lekce je hotová."}else setPhase("idle")},1600)}
  window.SlabikAdventure={reset,advance,finish(){state.progress=state.total;state.finished=true;setPhase("chest");updateCounter()},setProgress(p,total){state.progress=p;state.total=total;state.finished=p>=total;setPhase(state.finished?"chest":"idle");updateCounter()}};
  reset(0,25);requestAnimationFrame(frame);
})();