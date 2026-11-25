import { photograph, clamp, mono } from '../core/photograph.js';
import { sound } from '../core/audio.js';

const readings = ['5.00V','9.00V','15.00V','20.00V','CONTRACT OK'];
const until = [240,480,720,980,1300];

// Rasterise the current glyphs into physical emitters. Glass reflections remain
// visible through the unlit pixels, including inside the counters of letters.
function displayPixels(lines) {
  const stencil = document.createElement('canvas');
  stencil.width = 148;
  stencil.height = 56;
  const ink = stencil.getContext('2d', {willReadFrequently:true});
  ink.textBaseline = 'middle';
  ink.fillStyle = '#fff';
  const longest = Math.max(...lines.map(line => line.length), 1);
  const size = Math.min(lines.length === 1 ? 22 : 19, 211/longest);
  ink.font = '650 ' + size + 'px ' + mono;
  lines.forEach((line,i) => ink.fillText(line, 4, lines.length === 1 ? 28 : 9 + i * 18.3));
  const alpha = ink.getImageData(0,0,148,56).data;
  const glass = document.createElement('canvas');
  glass.width = 592; glass.height = 224;
  const out = glass.getContext('2d');
  out.fillStyle = '#e7f5e9';
  for (let y=0;y<56;y++) for (let x=0;x<148;x++) {
    const emission = alpha[(y*148+x)*4+3] / 255;
    if (emission < .16) continue;
    out.globalAlpha = Math.min(1, emission*1.25);
    out.fillRect(4*x,4*y,3.35,3.35);
  }
  return glass;
}
export async function createInstrument({canvas, phraseStore, startSettled}) {
  const plate = await photograph(canvas,'the-contract');
  const {ctx,crop} = plate;
  let seated = startSettled, hasContract = startSettled;
  let offset = seated ? 0 : 120, velocity = 0;
  let started = null, dirty = true, drag = null;
  let status, pixels;
  function plug() {
    if (seated) return;
    seated = true;
    if (hasContract) phraseStore.nextRandom({source:'the-contract'});
    hasContract = true;
    started = performance.now();
    sound.playUsbPlug();
    dirty = true;
  }
  function unplug() {
    if (!seated) return;
    seated = false;
    started = null;
    sound.playUsbUnplug();
    dirty = true;
  }
  function toggle() { seated ? unplug() : plug(); }
  const controller = new AbortController();
  const listen = (event,cb) => canvas.addEventListener(event,cb,{signal:controller.signal});
  canvas.style.cursor = 'grab';
  listen('pointerdown', e => {
    const rect = canvas.getBoundingClientRect();
    if (!e.isPrimary || e.button !== 0 || (e.clientX-rect.left)/rect.width < .45) return;
    drag = {x:e.clientX, offset, moved:false, snapped:false};
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor='grabbing';
  });
  listen('pointermove', e => {
    if (!drag || drag.snapped) return;
    const dx=(e.clientX-drag.x)/canvas.clientWidth*1000;
    if (Math.abs(dx) < 7 && !drag.moved) return;
    drag.moved = true;
    offset = clamp(drag.offset+dx,0,135);
    if (seated && offset>38) unplug();
    if (!seated && offset < 22) { plug(); drag.snapped=true; }
  });
  function release(e) {
    if (!drag) return;
    if (e.type !== 'pointercancel' && !drag.snapped) {
      if (!drag.moved) toggle();
      else if (offset<55) plug();
      else unplug();
    }
    drag=null;
    canvas.style.cursor='grab';
  }
  listen('pointerup',release);
  listen('pointercancel',release);

  function draw(dt) {
    if (!drag || drag.snapped) {
      const goal = seated ? 0 : 120;
      const h = Math.min(.025,dt);
      velocity += ((goal-offset)*340-velocity*28)*h;
      offset = clamp(offset+velocity*h,0,140);
      if (Math.abs(goal-offset)<.1 && Math.abs(velocity)<1) { offset=goal; velocity=0; }
    }
    plate.begin();
    if (offset>.05) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(817,428,183,151); ctx.clip();
      // Expose the stone under the plug; feather the edge of its contact shadow.
      for (let y=428; y<579; y+=2) {
        const alpha=clamp(Math.min((y-428)/14,(579-y)/20));
        ctx.globalAlpha=alpha;
        crop(817,408-Math.abs((y-428)%48-24),183,2,817,y,183,2);
      }
      ctx.globalAlpha=1;
      const metal=ctx.createLinearGradient(0,473,0,526);
      metal.addColorStop(0,'#595852'); metal.addColorStop(.13,'#e5e3d7');
      metal.addColorStop(.37,'#c0bfb7'); metal.addColorStop(.85,'#827e74'); metal.addColorStop(1,'#34322e');
      ctx.fillStyle=metal;
      ctx.beginPath(); ctx.roundRect(817+offset-46,473,50,49,4); ctx.fill();
      ctx.fillStyle='#555149'; ctx.fillRect(817+offset-34,478,7,3);
      ctx.fillRect(817+offset-34,514,7,3);
      ctx.beginPath();
      ctx.moveTo(817+offset,440); ctx.lineTo(844+offset,453); ctx.lineTo(905+offset,462);
      ctx.lineTo(905+offset,476); ctx.lineTo(1000+offset,476); ctx.lineTo(1000+offset,521);
      ctx.lineTo(905+offset,521);ctx.lineTo(905+offset,534);ctx.lineTo(845+offset,543);
      ctx.lineTo(817+offset,560);ctx.closePath();ctx.clip();
      crop(817,430,183,135,817+offset,430);
      ctx.restore();
    }
    const elapsed = started === null ? 0 : performance.now()-started;
    const index = until.findIndex(end=>elapsed<end);
    if (started !== null && index<0) started=null;
    const words = phraseStore.getState().cleanWords;
    const nextStatus = !seated ? 'Disconnected' : started !== null ? readings[index] : words.join(' ');
    if (nextStatus !== status) {
      if (started !== null && status !== 'Disconnected') sound.playRelayTick(.92+index*.12,.12);
      status=nextStatus;
      canvas.setAttribute('aria-label','The Contract · '+status);
      pixels = !seated ? null : displayPixels(started !== null ? [status] : words.map(w=>w.toUpperCase()));
    }
    if (pixels) {
      ctx.save();
      ctx.shadowColor='rgba(191,250,215,.34)'; ctx.shadowBlur=1.8;
      ctx.drawImage(pixels,257,400,486,183);
      ctx.restore();
    }
    dirty=false;
  }
  return {
    render:draw, triggerPrimary:toggle, setTheme(){},
    setPhrase(){ dirty=true; }, setSettled(value){
      seated=hasContract=value; offset=value?0:120; started=null; velocity=0; dirty=true;
    },
    isMoving:()=>dirty || !!drag || started !== null || offset !== (seated?0:120),
    dispose(){controller.abort();}
  };
}
