import { mechanism, lettering, mono, serif } from '../core/photograph.js';
import { sound } from '../core/audio.js';

// Lift the screwed brass badge intact. Reconstruct the narrow mounting area
// from its clean top and bottom margins and the adjacent brushed brass grain.
function brassInsert(image) {
  const tile = document.createElement('canvas');
  tile.width = 1000;
  tile.height = 1000;
  const painter = tile.getContext('2d');
  painter.drawImage(image,0,0,1000,1000);
  const patch = painter.getImageData(263,316,472,69);
  const donor = painter.getImageData(155,124,135,69).data;
  const src = patch.data.slice();
  for (let y=0; y<69; y++) for (let x=0; x<472; x++) {
    const index = (y*472+x)*4;
    const mix = Math.min(1,x/11,(471-x)/11,y/8,(68-y)/7);
    const u=x%268;
    const grain=4*(135*y+Math.min(u,268-u));
    for (let c=0;c<3;c++) {
      let base=0;
      for(let d=-3;d<=3;d++) {
        const col=Math.max(0,Math.min(471,x+d))*4+c;
        base+=(src[col]*(1-y/68)+src[68*472*4+col]*y/68)/7;
      }
      const detail=donor[grain+c]-donor[(135*y+(Math.min(u,268-u)+3)%135)*4+c];
      patch.data[index+c]=src[index+c]*(1-mix)+(base+detail*.49)*mix;
    }
  }
  tile.width=472;tile.height=69;
  painter.putImageData(patch,0,0);
  return tile;
}

export const createInstrument = mechanism('cipher-machine', ({ctx,crop,next,image}) => {
  const brass=brassInsert(image);
  return {
  smallPrint:true,
    duration:1.3,
  start(){ next(); sound.playMechanicalDetent(.92,.18); },
  step(t,prev) {
    if (Math.floor(t*8) !== Math.floor(prev*8)) sound.playMechanicalDetent(1.1,.16);
  },
  draw(t,phrase) {
    ctx.drawImage(brass,263,316);
    crop(278,329,442,51,347,861,306,35);
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
    const advance=24*Math.sin(t*Math.PI);
    ctx.save();ctx.beginPath();ctx.rect(188,718,625,143);ctx.clip();
    if(advance>.01) {
      ctx.save();ctx.beginPath();ctx.rect(188,718,625,143);ctx.clip();
      crop(188,718,625,143,188+advance,718,625,143);
      crop(189,718,25,143,188+advance-25,718,25,143);
      ctx.restore();
    }
    const words=phrase.cleanWords.map(w=>w.toUpperCase());
    const line=words.join(' ');
    const count=Math.min(3,Math.floor(t*4));
    ctx.font='600 63px '+mono;
    const width=Math.min(570,ctx.measureText(line).width);
    const size=63*Math.min(1,570/ctx.measureText(line).width);
    lettering(ctx,words.slice(0,count).join(' '),500-width/2,792,570,size,{weight:600,align:'left',color:'#29221a'});
    ctx.restore();
    const keys=[[188,442],[286,520],[401,599],[540,442],[697,600],[750,443]];
    if (t<1) {
      const [x,y]=keys[Math.min(5,Math.floor(t*6))];
      const glow=ctx.createRadialGradient(x,y,1,x,y,44);
      glow.addColorStop(0,'rgba(255,216,142,.73)');
      glow.addColorStop(.46,'rgba(251,179,79,.32)');glow.addColorStop(1,'transparent');
      ctx.fillStyle=glow;ctx.fillRect(x-44,y-44,88,88);
    }
    ctx.save();
    ctx.font='small-caps 28px '+serif;
    ctx.letterSpacing='1.8px';
    ctx.fillStyle='#e5d5b7';ctx.textBaseline='middle';ctx.textAlign='center';
    ctx.fillText('Turn the Rotors to Decrypt',500,962);
    ctx.restore();
  }
};
});
