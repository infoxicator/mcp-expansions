import { mechanism, lettering, clamp } from '../core/photograph.js';
import { sound } from '../core/audio.js';

const lands=[[86,146,462,576],[215,487,464,701],[355,822,456,848]];
export const createInstrument=mechanism('discover-identity',({ctx,crop,next})=>({
  duration:1.32,
  start(){next();sound.playUsbUnplug();},
  step(t,p) {
    if (p<.32 && t>=.32) sound.playUsbPlug();
    for (const [i,at] of [.36,.58,.80].entries())
      if (p<at && t>=at) sound.playRelayTick(.92+i*.15,.18);
  },
  draw(t,phrase) {
    lands.forEach(([x,y,w,led],i)=>{
      const at=[.36,.58,.80][i];
      const settle=clamp((t-at)/.12);
      const awake=t>=at;
      if (!awake) {
        ctx.fillStyle='#473a2d';ctx.beginPath();ctx.arc(led,y,10,0,2*Math.PI);ctx.fill();
      } else {
        if (settle<1) {
          const halo=ctx.createRadialGradient(led,y,0,led,y,23);
          halo.addColorStop(0,'rgba(255,213,110,.76)');halo.addColorStop(1,'rgba(255,164,52,0)');
          ctx.fillStyle=halo;ctx.fillRect(led-23,y-23,46,46);
        }
        const word=phrase.cleanWords[i].toUpperCase();
        ctx.save();ctx.beginPath();ctx.rect(x,y-45,w*settle,100);ctx.clip();
        lettering(ctx,word,x+w/2,y+6,w-44,78,{family:'Inter, sans-serif',weight:600,color:'#292825'});
        lettering(ctx,["SOP","SOP′","SOP″"][i],x+10,y-44,w,14,{align:'left',color:'#343330'});
        ctx.restore();
      }
    });
    const lift=43*clamp(Math.sin(Math.PI*clamp(t/.32)));
    if (lift>1) {
      ctx.save();
      ctx.beginPath();ctx.rect(0,106,73,93);ctx.clip();
      crop(0,237,73,93,0,106,73,93);
      // Expose a recessed socket at the edge of the first e-marker.
      const well=ctx.createLinearGradient(62,0,73,0);
      well.addColorStop(0,'rgba(22,18,15,0)');well.addColorStop(1,'rgba(10,9,8,.86)');
      ctx.fillStyle=well;ctx.fillRect(61,111,12,81);
      crop(0,106,73,93,-lift,106,73,93);
      ctx.restore();
    }
  }
}));
