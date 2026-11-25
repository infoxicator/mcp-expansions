import { mechanism, lettering, clamp } from '../core/photograph.js';
import { sound } from '../core/audio.js';

const lands=[[86,146,462,576],[215,487,464,701],[355,822,456,848]];
export const createInstrument=mechanism('discover-identity',({ctx,crop,next})=>({
  duration:1.32,
  start(){next();sound.playUsbUnplug();},
  step(t,p) {
    if (p<.22 && t>=.22) sound.playUsbPlug();
    for (const [i,at] of [.36,.58,.80].entries())
      if (p<at && t>=at) sound.playRelayTick(.92+i*.15,.18);
  },
  draw(t,phrase) {
    lands.forEach(([x,y,w,led],i)=>{
      const awake=t>=[.36,.58,.80][i];
      if (!awake) {
        ctx.fillStyle='#473a2d';ctx.beginPath();ctx.arc(led,y,10,0,2*Math.PI);ctx.fill();
      } else {
        const word=phrase.cleanWords[i].toUpperCase();
        lettering(ctx,word,x+w/2,y+6,w-44,78,{family:'Inter, sans-serif',weight:600,color:'#292825'});
        lettering(ctx,["SOP","SOP′","SOP″"][i],x+10,y-44,w,14,{align:'left',color:'#343330'});
      }
    });
    const lift=28*clamp(Math.sin(Math.PI*clamp(t/.24)));
    if (lift>1) {
      crop(0,245,72,77,0,109,72,77);
      crop(0,109,73,77,-lift,109,73,77);
    }
  }
}));
