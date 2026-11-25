import { mechanism } from 'mcp-mechanism';
import { lettering, clamp } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export const createInstrument=mechanism('combination-lock',({ctx,crop,phraseStore})=>{
  let previous=phraseStore.getState().cleanWords;
  return {
    smallPrint:true,
    duration:1.34,
    start({previousPhrase}){previous=previousPhrase.cleanWords;},
    step(t,p){
      if(Math.floor(t*13)!==Math.floor(p*13)) sound.playMechanicalDetent(1.02,.16);
      if(t===1&&p<1) sound.playSteelClack(.47);
    },
    draw(t,phrase) {
      [465,623,790].forEach((y,i)=>{
        const k=clamp((t-i*.10)/.72);
        const travel=(1-Math.pow(1-k,2))*3;
        const fraction=travel%1;
        const sequence=[previous[i],phraseStore.phrases[i+11].words[i],phraseStore.phrases[i+32].words[i],phrase.cleanWords[i]];
        const position=Math.min(3,Math.floor(travel));
        if (fraction>.001) {
          // Bare steel collars and milled grips roll with each drum. Use the
          // periodic knurl, keeping the baked highlight on the stationary case.
          for (const x of [211,731]) {
            const top=y-68, width=42, period=26;
            ctx.save();ctx.beginPath();ctx.rect(x,top,width,132);ctx.clip();
            for(let band=-1;band<6;band++)
              crop(x,y-14,width,period,x,top+(band-fraction)*period,width,period+.3);
            const sheen=ctx.createLinearGradient(0,top,0,top+132);
            sheen.addColorStop(0,'rgba(18,14,10,.62)');
            sheen.addColorStop(.44,'rgba(223,207,173,.12)');
            sheen.addColorStop(1,'rgba(22,17,13,.67)');
            ctx.fillStyle=sheen;ctx.fillRect(x,top,width,132);ctx.restore();
          }
        }
        ctx.save();ctx.beginPath();ctx.rect(295,y-67,391,133);ctx.clip();
        const stamp=(word,offset)=>{
          const center=y+offset;
          const size=83*(1-.28*Math.min(1,Math.abs(offset)/95));
          const opts={family:'"Helvetica Neue", Arial, sans-serif',weight:600};
          lettering(ctx,word.toUpperCase(),489,center+1.7,362,size,{...opts,color:'#1d1c17'});
          lettering(ctx,word.toUpperCase(),489,center,362,size,{...opts,color:'#ede1bd'});
        };
        stamp(t===1?phrase.cleanWords[i]:sequence[position],-fraction*122);
        if(fraction>.015) stamp(sequence[position+1],(1-fraction)*122);
        ctx.restore();
      });
      if(t>.82 && t<1){
        const lift=11*Math.sin((t-.82)/.18*Math.PI);
        crop(221,0,500,309,221,-lift,500,309+lift*.6);
      }
    }
  };
});
