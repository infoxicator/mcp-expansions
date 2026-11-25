import { mechanism, lettering, mono } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export const createInstrument = mechanism('cipher-machine', ({ctx,crop,next}) => ({
  smallPrint:true,
    duration:1.3,
  start(){ next(); sound.playMechanicalDetent(.92,.18); },
  step(t,prev) {
    if (Math.floor(t*8) !== Math.floor(prev*8)) sound.playMechanicalDetent(1.1,.16);
  },
  draw(t,phrase) {
    for (const [i,x] of [362,500,635].entries()) {
      const radius=50, y=240;
      const spin=1-Math.pow(1-t,2+i);
      if (t<1) {
        ctx.save();
        ctx.beginPath(); ctx.ellipse(x,y,radius,56,0,0,Math.PI*2);ctx.clip();
        ctx.translate(x,y);ctx.scale(1,1.12);ctx.rotate(spin*Math.PI*2*(i+1));
        crop(x-radius,y-56,2*radius,112,-radius,-radius,2*radius,2*radius);
        ctx.restore();
      }
    }
    const shift=35*Math.pow(1-t,2);
    ctx.save();ctx.beginPath();ctx.rect(188,718,625,143);ctx.clip();
    crop(188,718,625,143,188,718-shift,625,143);
    const words=phrase.cleanWords.map(w=>w.toUpperCase());
    const line=words.join(' ');
    const count=Math.min(3,Math.floor(t*4));
    ctx.font='600 63px '+mono;
    const width=Math.min(570,ctx.measureText(line).width);
    const size=63*Math.min(1,570/ctx.measureText(line).width);
    lettering(ctx,words.slice(0,count).join(' '),500-width/2,792-shift,570,size,{weight:600,align:'left',color:'#29221a'});
    ctx.restore();
    lettering(ctx,'TURN THE ROTORS TO DECRYPT',500,964,520,21,{color:'#eadabc',weight:400});
  }
}));
