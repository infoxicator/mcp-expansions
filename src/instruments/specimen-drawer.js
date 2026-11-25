import { mechanism, lettering, clamp } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export const createInstrument=mechanism('specimen-drawer',({ctx,crop,next})=>{
  let bay=0;
  const tags=['A-4187','B-7321','C-9654'];
  return {
    smallPrint:true,
    duration:.84,
    start(point){
      bay=point ? clamp(Math.floor((point.y-60)/231),0,2) : (bay+1)%3;
      sound.playMechanicalDetent(.77,.24);
      if (bay!==1) { next();sound.playRelayTick(1.2,.2); }
    },
    label:phrase=>bay===1 ? 'Charge-only cable' : phrase.text,
    draw(t,phrase){
      const y=bay*231+155;
      // The side rails stay fixed while the tray and its brass label pull
      // forward together. Its open rear well comes into view behind the tray.
      const pull=t===1 ? 0 : Math.sin(Math.PI*t)**1.5;
      const extension=107*pull;
      ctx.save();
      if (pull>0) {
        crop(72,58,848,34,71,58,860,extension+36);
        const shade=ctx.createLinearGradient(0,57,0,91+extension);
        shade.addColorStop(0,'rgba(19,11,6,.82)');shade.addColorStop(1,'rgba(40,24,12,.28)');
        ctx.fillStyle=shade;ctx.fillRect(71,57,860,extension+35);
        ctx.translate(500,extension);ctx.scale(1+.026*pull,1);ctx.translate(-500,0);
        crop(71,64,857,676);
        crop(17,739,966,248);
      }
      lettering(ctx,tags[bay]+'   /   '+(bay===1?'CHARGE ONLY':'LIVE SPECIMEN'),229,828,530,19,{align:'left',color:'#5d5442'});
      if (bay===1) {ctx.restore();return;}
      const line=phrase.cleanWords.join(' ').toUpperCase();
      lettering(ctx,line,500,897,544,55,{family:'"Courier New", monospace',weight:700,color:'#2c271e'});
      // A three-word, low-current illuminated collar on the selected sample.
      ctx.save();ctx.translate(216,y+12);ctx.rotate(bay===0?.07:-.03);
      ctx.fillStyle='#302f2a';ctx.beginPath();ctx.roundRect(-57,-24,114,48,5);ctx.fill();
      if(pull>.05) {
        ctx.shadowColor='#ffc654';ctx.shadowBlur=5*pull;
        ctx.fillStyle='rgba(232,173,72,'+pull*.82+')';ctx.fillRect(-53,15,106,2);
        ctx.shadowColor='transparent';
      }
      lettering(ctx,line,0,0,105,16,{color:'#f6e6ac'});ctx.restore();
      ctx.restore();
    }
  };
});
