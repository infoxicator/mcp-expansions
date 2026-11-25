import { mechanism, lettering, clamp } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export const createInstrument=mechanism('specimen-drawer',({ctx,crop,next})=>{
  let bay=0;
  const tags=['A-4187','B-7321','C-9654'];
  return {
    smallPrint:true,
    duration:.46,
    start(point){
      bay=point ? clamp(Math.floor((point.y-60)/231),0,2) : (bay+1)%3;
      if (bay!==1) { next();sound.playRelayTick(1.2,.2); }
    },
    label:phrase=>bay===1 ? 'Charge-only cable' : phrase.text,
    draw(t,phrase){
      const y=bay*231+155;
      const bump=4*Math.sin(t*Math.PI);
      if(bump>0) crop(98,y-67,600,125,98,y-67-bump,600,125);
      lettering(ctx,tags[bay]+'   /   '+(bay===1?'CHARGE ONLY':'LIVE SPECIMEN'),229,828,530,19,{align:'left',color:'#5d5442'});
      if (bay===1) return;
      const line=phrase.cleanWords.join(' ').toUpperCase();
      lettering(ctx,line,500,897,544,55,{family:'"Courier New", monospace',weight:700,color:'#2c271e'});
      // A three-word, low-current illuminated collar on the selected sample.
      ctx.save();ctx.translate(216,y+12);ctx.rotate(bay===0?.07:-.03);
      ctx.fillStyle='#302f2a';ctx.beginPath();ctx.roundRect(-57,-24,114,48,5);ctx.fill();
      lettering(ctx,line,0,0,105,16,{color:'#f6e6ac'});ctx.restore();
    }
  };
});
