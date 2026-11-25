import { mechanism, lettering, clamp } from '../core/photograph.js';
import { sound } from '../core/audio.js';

const hinges=[177,505,833];
export const createInstrument=mechanism('destination-blind',({ctx,crop,phraseStore,next})=>{
  let sequence=[];
  function print(word,row) {
    lettering(ctx,word,109,hinges[row]+7,822,207,{
      family:'"Helvetica Neue", Arial, sans-serif',weight:700,align:'left',color:'#ece7d7'});
  }
  function half(row,top,word,height,shade) {
    const hinge=hinges[row], h=142*height;
    if(h<.5) return;
    ctx.save();ctx.translate(0,hinge);ctx.scale(1,height);ctx.translate(0,-hinge);
    const y=top?hinge-142:hinge;
    ctx.beginPath();ctx.rect(52,y,912,142);ctx.clip();crop(52,y,912,142);print(word,row);
    if(shade){ctx.fillStyle='rgba(5,4,2,'+shade+')';ctx.fillRect(52,y,912,142);}
    ctx.restore();
  }
  return {
    duration:1.4,
    start(){
      const old=phraseStore.getState().cleanWords;
      const end=next().cleanWords;
      sequence=old.map((w,i)=>[w,...Array.from({length:4},(_,n)=>
        phraseStore.phrases[(n*13+i*7)%phraseStore.phrases.length].words[i]),end[i]].map(v=>v.replace(/,$/,'').toUpperCase()));
    },
    step(t,p){if(Math.floor(t*18)!==Math.floor(p*18))sound.playFlapClack(.16);},
    draw(t,phrase){
      for(let i=0;i<3;i++){
        const hinge=hinges[i];
        if(t===1 || !sequence.length) print(phrase.cleanWords[i].toUpperCase(),i);
        else {
          const pos=clamp((t-.07*i)/.83)*5;
          const idx=Math.min(4,Math.floor(pos)), f=pos-idx;
          const a=sequence[i][idx], b=sequence[i][idx+1];
          half(i,true,b,1,0);half(i,false,a,1,0);
          const cosine=Math.cos(f*Math.PI);
          half(i,cosine>=0,cosine>=0?a:b,Math.abs(cosine),.46*(1-Math.abs(cosine)));
        }
        ctx.fillStyle='rgba(16,14,12,.95)';ctx.fillRect(52,hinge-1,910,3.6);
        ctx.fillStyle='rgba(255,242,210,.12)';ctx.fillRect(52,hinge+3,910,.9);
      }
    }
  };
});
