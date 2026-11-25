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
    const shift=pressure*40;
    if (shift>.01) {
      // Tighten the forme within the chase, then pull the sheet over the bed.
      const bite=9*pressure;
      for (const [i,x] of [283,420,558].entries()) {
        const rise=bite*(i%2 ? -1 : 1);
        crop(x,84,136,259,x,84+rise,136,259);
      }
      crop(159,128,43,205,159+bite,128,43,205);
      crop(797,128,37,205,797-bite,128,37,205);
      crop(43,484,901,20,43,504,901,shift+4);
      crop(27,504,934,467,27,504+shift,934,467);
    }
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
