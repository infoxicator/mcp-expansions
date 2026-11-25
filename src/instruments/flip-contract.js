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
      ctx.save();
      ctx.beginPath();ctx.roundRect(111,233,711,455,26);ctx.clip();
      ctx.translate(112,0);ctx.scale(Math.max(.012,roll),1);
      crop(111,233,711,455,0,233,711,455);
      const x=58;
      lettering(ctx,'CC'+(side+1)+'   /   I·O',x,298,480,21,{align:'left',color:'#605846'});
      const opts={family:'Inter, sans-serif',weight:550,align:'left',color:'#252520'};
      for (const [i,word] of phrase.cleanWords.entries())
        lettering(ctx,word.toUpperCase(),x,386+i*112,602,99,opts);
      ctx.restore();
      if (side) {
        crop(732,193,61,25,860,192,69,26);
        lettering(ctx,'CC2',890,204,55,19,{color:'#c7ba94'});
      }
    }
  };
});
