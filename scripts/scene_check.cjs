const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1100,height:1200},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 await page.addInitScript(()=>{
   window.emptyFrames=[];const seen=new Set(),draw=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(...args){
    if(args.length===9){const [img,x,y,w,h]=args,key=img.src+':'+x+':'+y+':'+w+':'+h;
     if(!seen.has(key)){seen.add(key);const c=document.createElement('canvas');c.width=w;c.height=h;const probe=c.getContext('2d');draw.call(probe,img,x,y,w,h,0,0,w,h);const pixels=probe.getImageData(0,0,w,h).data;if(!pixels.some((v,i)=>i%4===3&&v>0))window.emptyFrames.push(key);}}
    return draw.apply(this,args);
   };
  });
 await page.goto('http://localhost:8000');await page.waitForFunction(()=>!document.querySelector('#accept').disabled);
 await page.waitForTimeout(3000);await page.locator('.adventure-shell').screenshot({path:'scene-preview.png'});
 await page.locator('#accept').click();await page.waitForTimeout(400);await page.locator('.adventure-shell').screenshot({path:'scene-spell.png'});
 await page.waitForTimeout(1900);await page.locator('#previous').click();
 if(!((await page.locator('#adventure-counter').innerText()).startsWith('0 /')))throw Error('back progress');
 await page.evaluate(()=>{window.SlabikAdventure.setProgress(24,25);window.SlabikAdventure.advance();});await page.waitForTimeout(5600);await page.locator('.adventure-shell').screenshot({path:'scene-chest.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.adventure-shell').screenshot({path:'scene-mobile.png'});
 errors.push(...await page.evaluate(()=>window.emptyFrames));console.log(JSON.stringify({errors}));await browser.close();if(errors.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
