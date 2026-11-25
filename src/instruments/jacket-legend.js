import { photograph, clamp } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export async function createInstrument({canvas,phraseStore}) {
  const {ctx,begin,crop}=await photograph(canvas,'jacket-legend');
  let tension=1, target=1, velocity=0, cycle=false, drag=null, dirty=true;
  const events=new AbortController();
  const on=(event,cb)=>canvas.addEventListener(event,cb,{signal:events.signal});
  const next=()=>{phraseStore.nextRandom({source:'jacket-legend'});sound.playUsbPlug();};
  on('pointerdown',e=>{
    if (!e.isPrimary || e.button!==0) return;
    drag={x:e.clientX,y:e.clientY,initial:tension};
    cycle=false; velocity=0;
    canvas.setPointerCapture(e.pointerId);
  });
  on('pointermove',e=>{
    if (!drag) return;
    tension=clamp(drag.initial+(e.clientX-drag.x)/canvas.clientWidth*2.4);
    dirty=true;
  });
  on('pointerup',e=>{
    if (!drag) return;
    const dx=e.clientX-drag.x;
    if (Math.abs(dx)<7) {
      if (Math.abs(e.clientY-drag.y)<10) trigger();
    } else {
      target=dx>0?1:0;
      if (target===1 && drag.initial<.5) next();
    }
    drag=null;dirty=true;
  });
  on('pointercancel',()=>{ drag=null; dirty=true; });
  function trigger() {
    if (tension<.02) {next();target=1;}
    else {target=0;cycle=true;}
    dirty=true;
  }
  canvas.style.cursor='ew-resize';
  function draw(dt) {
    if (!drag) {
      const h=Math.min(dt,.03);
      velocity+=((target-tension)*145-velocity*22)*h;
      tension=clamp(tension+velocity*h);
      if (Math.abs(target-tension)<.006 && Math.abs(velocity)<.09) {
        tension=target;velocity=0;
        if (cycle && target===0) {cycle=false;next();target=1;}
      }
    }
    begin();
    const slack=1-tension;
    const join=637, pulled=join-147*slack;
    // Only the free running end moves. Sample its real jacket along the slack
    // curve; the steel shell and moulded boot translate together as one piece.
    if (slack>.001) {
      ctx.save();
      // Blend the fibres bordering the cable into the newly exposed felt.
      for(let y=758;y<985;y+=3) {
        ctx.globalAlpha=clamp(Math.min((y-758)/30,(985-y)/35));
        const sample=963+Math.abs(((y-758)%52)-26);
        crop(0,sample,1000,3,0,y,1000,3.1);
      }
      ctx.restore();
      for(let x=0;x<join;x+=4){
        const u=x/join;
        const dy=-57*Math.pow(Math.sin(Math.PI*u),2)*slack;
        crop(x,816,4,90,x*pulled/join,816+dy,4.2*pulled/join,90);
      }
      ctx.save();ctx.translate(pulled-join,0);
      ctx.beginPath();ctx.moveTo(636,823);ctx.lineTo(670,812);ctx.lineTo(718,788);
      ctx.lineTo(874,785);ctx.lineTo(882,800);ctx.lineTo(951,801);
      ctx.lineTo(962,812);ctx.lineTo(957,884);ctx.lineTo(881,888);
      ctx.lineTo(873,912);ctx.lineTo(719,914);ctx.lineTo(674,893);
      ctx.lineTo(635,888);ctx.closePath();ctx.clip();crop(632,781,338,142);
      ctx.restore();
    }
    const words=phraseStore.getState().cleanWords.join(' ').toUpperCase();
    const text=words+'   100W   20V/5A   E-MARKED';
    ctx.save();ctx.globalCompositeOperation='multiply';
    ctx.font='600 34px "Arial Narrow", Arial, sans-serif';
    const size=34*Math.min(1,(pulled-31)/ctx.measureText(text).width);
    ctx.font='600 '+size+'px "Arial Narrow", Arial, sans-serif';
    ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle='#252827';
    let cursor=14;
    for(const ch of text){
      const u=cursor/pulled;
      const dy=-57*Math.pow(Math.sin(Math.PI*u),2)*slack;
      ctx.save();ctx.translate(cursor,851+dy);
      ctx.rotate(Math.atan(-57*Math.PI*Math.sin(2*Math.PI*u)*slack/pulled));
      ctx.fillText(ch,0,0);ctx.restore();cursor+=ctx.measureText(ch).width;
    }
    ctx.restore(); dirty=false;
    canvas.setAttribute('aria-label',text);
  }
  return { render:draw,triggerPrimary:trigger,setPhrase(){dirty=true;},setTheme(){},
    setSettled(s){target=tension=s?1:0;velocity=0;cycle=false;dirty=true;},
    readLegend:()=>tension>.98 ? phraseStore.getState().text : '',
    isMoving:()=>dirty||cycle||!!drag||Math.abs(tension-target)>.001,
    dispose(){events.abort();}
  };
}
