import { mechanism, clamp, paperInk } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export const createInstrument=mechanism('mechanical-typewriter',({ctx,crop,next,image})=>{
  const ribbon=paperInk(ctx,image,.32,.07,[28,26,32],18);
  let last=0;
  return {
    duration:1.8,
    start(){next();last=0;},
    step(t,p,phrase){
      const n=Math.floor(clamp(t/.86)*phrase.text.length);
      if(n!==last) {sound.playMechanicalDetent(.88+n%4*.04,.19);last=n;}
      if(t===1&&p<1)sound.playMechanicalDetent(.78,.24);
    },
    draw(t,phrase) {
      const full=phrase.text; const count=t===1 ? full.length : last;
      const typed=full.slice(0,count);
      const size=Math.min(72,1110/full.length);
      const advance=size*.6;
      const start=500-full.length*advance/2;
      const motion=t===1 ? 0 : 14*(1-clamp(t/.86));
      ctx.save(); ctx.translate(motion,0);
      ctx.textAlign='left';ctx.textBaseline='alphabetic';
      ctx.font='700 '+size+'px "Courier New", Courier, monospace';
      for (let i=0;i<typed.length;i++){
        const code=typed.charCodeAt(i);
        ctx.save();
        ctx.translate(start+i*advance,211+Math.sin(i*3.17+code)*1.65);
        ctx.rotate(.017*Math.sin(i+code));
        ctx.fillStyle='#f9efdc';ctx.fillText(typed[i],.7,1.1);
        ctx.globalCompositeOperation='multiply';ctx.fillStyle=ribbon;ctx.globalAlpha=.84+(code%7)*.02;
        ctx.fillText(typed[i],0,0);ctx.restore();
      }
      ctx.restore();
      if(t<.86 && count>0){
        const hit=Math.pow(1-(clamp(t/.86)*full.length%1),3);
        // The bar rises from the comb towards the ribbon at the strike point.
        ctx.save();ctx.translate(500,650);ctx.rotate(-.17*hit);
        ctx.strokeStyle='#827969';ctx.lineWidth=5*hit;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-256*hit);ctx.stroke();
        ctx.fillStyle='#41403c';ctx.fillRect(-7,-259*hit,14,9);ctx.restore();
        const key=count%8;
        const x=122+key*83, y=797;
        crop(x-26,y-16,52,33,x-26,y-16+3*hit,52,33);
      }
    }
  };
});
