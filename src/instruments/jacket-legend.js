import { photograph, clamp, paperInk } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export async function createInstrument({canvas,phraseStore,canOperate = () => true}) {
  const {ctx,begin,crop,image}=await photograph(canvas,'jacket-legend');
  const pigment=paperInk(ctx,image,.12,.836,[49,48,43],5);
  // Prepare the felt revealed by the moving lead from the bare centre of
  // the coil. Match local illumination to the felt above and below the lead.
  const ground=document.createElement('canvas');
  ground.width=ground.height=1000;
  const backing=ground.getContext('2d');
  backing.drawImage(image,0,0,1000,1000);
  const source=backing.getImageData(0,0,1000,1000).data;
  const felt=backing.createImageData(1000,220);
  for (let x=0;x<1000;x++) {
    const edges=[772,981].map(y=>{
      const rgb=[0,0,0];
      for(let dx=-12;dx<=12;dx+=3) for(let dy=-4;dy<=4;dy+=2) {
        const p=4*((y+dy)*1000+clamp(x+dx,0,999));
        for(let c=0;c<3;c++) rgb[c]+=source[p+c]/45;
      }
      return rgb;
    });
    for(let y=0;y<220;y++) {
      const u=x%478,v=y%306;
      const donor=4*((304+Math.min(v,306-v))*1000+365+Math.min(u,478-u));
      const i=4*(y*1000+x),k=y/219;
      for(let c=0;c<3;c++) felt.data[i+c]=source[donor+c]-[169,133,94][c]+edges[0][c]*(1-k)+edges[1][c]*k;
      felt.data[i+3]=255*clamp(Math.min(y/20,(219-y)/28));
    }
  }
  ground.height=220;backing.putImageData(felt,0,0);
  let tension=1, target=1, velocity=0, cycle=false, drag=null, dirty=true;
  const events=new AbortController();
  const on=(event,cb)=>canvas.addEventListener(event,cb,{signal:events.signal});
  const advance=()=>phraseStore.nextRandom({source:'jacket-legend'});
  on('pointerdown',e=>{
    if (!e.isPrimary || e.button!==0 || !canOperate()) return;
    drag={x:e.clientX,y:e.clientY,initial:tension,moved:false};
    canvas.setPointerCapture(e.pointerId);
  });
  on('pointermove',e=>{
    if (!drag) return;
    const dx=e.clientX-drag.x;
    if (!drag.moved) {
      if (Math.abs(dx)<Math.max(7,Math.abs(e.clientY-drag.y))) return;
      drag.moved=true;
      cycle=false;
      velocity=0;
    }
    tension=clamp(drag.initial+dx/canvas.clientWidth*2.4);
    dirty=true;
  });
  on('pointerup',e=>{
    if (!drag) return;
    const dx=e.clientX-drag.x;
    if (canOperate()) {
      if (!drag.moved) {
        if (Math.hypot(dx,e.clientY-drag.y)<=12) trigger();
      } else {
        target=dx>0?1:0;
        if (target===1 && drag.initial<.5) {advance();sound.playUsbPlug();}
      }
    }
    drag=null;dirty=true;
  });
  on('pointercancel',()=>{ drag=null; dirty=true; });
  function trigger(replay=false) {
    if (!replay) advance();
    if (tension<.02) {cycle=false;target=1;sound.playUsbPlug();}
    else {target=0;cycle=true;}
    dirty=true;
  }
  canvas.style.cursor='ew-resize';
  function draw(dt) {
    if (!drag?.moved) {
      const h=Math.min(dt,.03);
      velocity+=((target-tension)*145-velocity*22)*h;
      tension=clamp(tension+velocity*h);
      if (Math.abs(target-tension)<.006 && Math.abs(velocity)<.09) {
        tension=target;velocity=0;
        if (cycle && target===0) {cycle=false;sound.playUsbPlug();target=1;}
      }
    }
    begin();
    const slack=1-tension;
    const join=637, pulled=join-147*slack;
    // Only the free running end moves. Sample its real jacket along the slack
    // curve; the steel shell and moulded boot translate together as one piece.
    if (slack>.001) {
      ctx.save();
      ctx.drawImage(ground,0,767);
      const curve=x=>-57*Math.sin(Math.PI*x/join)**2*slack;
      ctx.beginPath();
      ctx.moveTo(0,820);
      for(let x=0;x<=join;x+=2) ctx.lineTo(x*pulled/join,820+curve(x));
      for(let x=join;x>=0;x-=2) ctx.lineTo(x*pulled/join,881+curve(x));
      ctx.closePath();
      ctx.shadowColor='rgba(35,22,11,.54)';ctx.shadowOffsetY=12;ctx.shadowBlur=13;
      ctx.fillStyle='#665b4d';ctx.fill();ctx.shadowColor='transparent';ctx.clip();
      for(let x=0;x<join;x+=3)
        crop(x,819,3,64,x*pulled/join,819+curve(x),3*pulled/join+.15,64);
      ctx.restore();
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
    ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle=pigment;
    let cursor=14;
    for(const ch of text){
      const u=cursor/pulled;
      const dy=-57*Math.pow(Math.sin(Math.PI*u),2)*slack;
      ctx.save();
      // Slight pressure variation follows the material as the lead bows.
      ctx.globalAlpha=.85+.085*Math.sin(cursor*.091)+.035*Math.cos(cursor*.44);
      ctx.translate(cursor,851+dy+.62*Math.sin(cursor*.035));
      ctx.rotate(Math.atan(-57*Math.PI*Math.sin(2*Math.PI*u)*slack/pulled));
      ctx.scale(1,.92+.04*Math.cos(cursor*.067));
      ctx.fillText(ch,0,0);ctx.restore();cursor+=ctx.measureText(ch).width;
    }
    ctx.restore(); dirty=false;
    canvas.setAttribute('aria-label',text);
  }
  return { render:draw,triggerPrimary:opts=>trigger(opts?.replay),playOnArrival:()=>trigger(true),setPhrase(){dirty=true;},setTheme(){},
    setSettled(s){target=tension=s?1:0;velocity=0;cycle=false;dirty=true;},
    readLegend:()=>tension>.98 ? phraseStore.getState().text : '',
    isMoving:()=>dirty||cycle||!!drag||Math.abs(tension-target)>.001,
    dispose(){events.abort();}
  };
}
