import { mechanism, lettering, serif, paperInk } from '../core/photograph.js';
import { sound } from '../core/audio.js';

export const createInstrument=mechanism('letterpress-lockup',({ctx,crop,next,image})=>{
  const ink=paperInk(ctx,image,.24,.62,[35,35,28],11);
  return {
  duration:.92,
  start(){sound.playMechanicalDetent(.83,.21);},
  step(t,p){if(p<.48 && t>=.48){next();sound.playSteelClack(.5);}},
  draw(t,phrase){
    const pressure=Math.pow(Math.sin(Math.PI*t),4);
    const shift=pressure*25;
    crop(27,504,934,467,27,504+shift,934,467);
    ctx.save();ctx.translate(0,shift);ctx.rotate(-.006);
    const first=phrase.words.slice(0,2).join(' ');
    const rows=[[first,148,660],[phrase.words[2],255,845]];
    // Offset the highlight by less than a point to pick up the compressed paper edge.
    for(const [word,x,y] of rows) {
      const width=855-x;
      lettering(ctx,word,x+.8,y+1.7,width,168,{family:serif,align:'left',color:'#fff5df',weight:400});
      ctx.globalCompositeOperation='multiply';
      lettering(ctx,word,x,y,width,168,{family:serif,align:'left',color:ink,weight:400});
      ctx.globalCompositeOperation='source-over';
    }
    ctx.restore();
  }
  };
});
