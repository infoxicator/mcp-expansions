import { mechanism, lettering, mono, clamp } from '../core/photograph.js';
import { sound } from '../core/audio.js';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const createInstrument=mechanism('dymo-embosser',({ctx,crop,next})=>{
  let legend='', index=0, lastIndex=0;
  return {
    smallPrint:true,
    duration:1.64,
    start(){legend=next().cleanWords.join(' ').toUpperCase();index=lastIndex=0;},
    step(t){
      index=Math.min(legend.length,Math.floor(t*(legend.length+1)));
      if(index!==lastIndex){sound.playMechanicalDetent(.94+index%3*.08,.16);lastIndex=index;}
    },
    draw(t,phrase) {
      const full=phrase.cleanWords.join(' ').toUpperCase(), printed=t===1?full:full.slice(0,index);
      const current=t===1 ? full.at(-1) : full[index] || full.at(-1);
      const previous=full[Math.max(0,index-1)] || current;
      const seek=clamp((t*(full.length+1)-index)*3);
      const target=Math.max(0,alphabet.indexOf(current)), from=Math.max(0,alphabet.indexOf(previous));
      const turn=t===1?target:from+(target-from)*seek;
      if (t<1) {
        // The ivory wheel turns around its fixed axle under the index pointer.
        ctx.save();
        ctx.beginPath();ctx.ellipse(411,473,198,210,0,0,Math.PI*2);
        ctx.ellipse(411,473,94,100,0,0,Math.PI*2);ctx.clip('evenodd');
        ctx.translate(411,473);ctx.scale(1,239/225);ctx.rotate(-turn*2*Math.PI/alphabet.length);
        crop(186,234,450,478,-225,-225,450,450);
        ctx.restore();

      }
      for (let i=0;i<alphabet.length;i++){
        const angle=-Math.PI+(i-turn)*Math.PI*2/alphabet.length;
        ctx.save();ctx.translate(411+175*Math.cos(angle),473+175*Math.sin(angle));ctx.rotate(angle+Math.PI/2);
        lettering(ctx,alphabet[i],0,0,26,25,{family:'Arial, sans-serif',weight:700,color:'#23251f'});
        ctx.fillStyle='#3b3930';ctx.fillRect(-.8,-23,1.6,6);ctx.restore();
      }
      const punch=t===1?0:2.5*Math.sin(2*Math.PI*(t*(full.length+1)));
      ctx.font='700 44px '+mono;
      const size=44*Math.min(1,379/ctx.measureText(full).width);
      const style={align:'left',weight:700};
      // Each squeeze feeds one character-width of tape left from the die.
      ctx.font='700 '+size+'px '+mono;
      const feed=ctx.measureText(full.slice(printed.length)).width;
      ctx.save();ctx.beginPath();ctx.rect(0,782,426,82);ctx.clip();
      ctx.translate(feed,0);
      ctx.save();
      ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=2;ctx.shadowOffsetX=1;ctx.shadowOffsetY=2;
      lettering(ctx,printed,17,827+punch,385,size,{...style,color:'#080808'});
      ctx.restore();
      lettering(ctx,printed,14.5,823.5+punch,385,size,{...style,color:'#f8f2df'});
      lettering(ctx,printed,16,826+punch,385,size,{...style,color:'#b7b8b2'});
      ctx.restore();
    }
  };
});
