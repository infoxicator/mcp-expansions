import { mechanism, lettering } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export const createInstrument=mechanism('flip-contract',({ctx,crop,phraseStore,next})=>{
  let side=0;
  const memory=[phraseStore.getState(), null];
  return {
    duration:.88,
    start(){sound.playUsbUnplug();},
    sync(state){memory[side]=state;if(memory[1-side]?.text===state.text) memory[1-side]=null;},
    step(t,p){
      if (p<.5 && t>=.5) {
        side=1-side;
        const saved=memory[side], from={source:'flip-contract'};
        memory[side]=!saved ? next() : saved.isRemix ? phraseStore.setRemix(saved.words,from) : phraseStore.setById(saved.id,from);
        sound.playMechanicalDetent(1.1,.18);
      }
      if (t===1 && p<1) sound.playUsbPlug();
    },
    draw(t,phrase){
      const roll=Math.abs(Math.cos(Math.PI*t));
      const plug=26*Math.sin(t*Math.PI);
      if (plug>1) {
        crop(926,323,74,52,926,394,74,147);
        crop(926,391,74,155,926+plug,391+(1-roll)*17,74,121+34*roll);
      }
      const angle=Math.sin(Math.PI*t);
      ctx.save();
      if (angle>.001) {
        // Rebated metal bed under the card; its rim and hinge stay fixed.
        ctx.beginPath();ctx.roundRect(95,230,739,477,34);ctx.clip();
        crop(77,13,751,155,95,230,739,477);
        const bed=ctx.createLinearGradient(95,230,834,707);
        bed.addColorStop(0,'rgba(10,9,7,.78)');bed.addColorStop(.54,'rgba(26,23,18,.83)');
        bed.addColorStop(1,'rgba(17,15,10,.85)');
        ctx.fillStyle=bed;ctx.fillRect(95,230,739,477);
      }
      ctx.restore();
      ctx.save();
      ctx.translate(465,466);ctx.transform(Math.max(.009,roll),0,0,1+angle*.045,0,0);
      ctx.translate(-465,-466);
      ctx.beginPath();ctx.roundRect(96,231,737,472,32);ctx.clip();
      crop(96,231,737,472);
      const x=170;
      lettering(ctx,'CC'+(side+1)+'   /   I·O',x,298,480,21,{align:'left',color:'#605846'});
      const opts={family:'Inter, sans-serif',weight:550,align:'left',color:'#252520'};
      for (const [i,word] of phrase.cleanWords.entries())
        lettering(ctx,word.toUpperCase(),x,386+i*112,602,99,opts);
      ctx.fillStyle='rgba(47,37,23,'+(angle*.36)+')';
      ctx.fillRect(96,231,737,472);
      ctx.restore();
      if (side) {
        crop(732,193,61,25,860,192,69,26);
        lettering(ctx,'CC2',890,204,55,19,{color:'#c7ba94'});
      }
    }
  };
});
