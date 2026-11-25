import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// All times are on the encoded film clock. Crop to the actual browser poster,
// so UI changes, URL updates and feed scrolling cannot pass the motion check.
export function verifyMotion(movie, start, seconds, poster, region, name) {
  const [left,top,width,height]=region;
  const x=Math.round(poster.x+left*poster.width);
  const y=Math.round(poster.y+top*poster.height);
  const w=Math.round(width*poster.width);
  const h=Math.round(height*poster.height);
  const pixels=execFileSync('ffmpeg',['-v','error','-ss',start.toFixed(3),'-i',movie,
    '-t',seconds.toFixed(3),'-vf',`crop=${w}:${h}:${x}:${y},fps=15,scale=80:80`,
    '-pix_fmt','gray','-f','rawvideo','-']);
  const stride=80*80;
  let transitions=0;
  for(let offset=stride;offset+stride<=pixels.length;offset+=stride) {
    let changed=0;
    for(let i=0;i<stride;i++)
      if(Math.abs(pixels[offset+i]-pixels[offset-stride+i])>12) changed++;
    if(changed>stride*.018) transitions++;
  }
  assert.ok(transitions>=3,`${name}: only ${transitions} distinct hardware transitions in the film`);
  console.log(`${name}: ${transitions} changing hardware frame pairs at 15 fps`);
}

export function exportStrips(movie, directory, poster, samples, compactIndices, prefix) {
  const frames=samples.map(({time,label},i)=>{
    const file=path.join(directory,'strip-'+i+'.png');
    const crop=[poster.width,poster.height,poster.x,poster.y].map(Math.round).join(':');
    execFileSync('ffmpeg',['-v','error','-y','-ss',time.toFixed(3),'-i',movie,'-frames:v','1',
      '-vf','crop='+crop+',scale=540:540:flags=lanczos',file]);
    return {file,caption:label+'   '+time.toFixed(2)+'s'};
  });
  function sheet(selected,size,columns,suffix) {
    const rows=[];
    for(let i=0;i<selected.length;i+=columns) {
      const cells=selected.slice(i,i+columns).flatMap(({file,caption})=>[
        '(',file,'-resize',size+'x'+size,'-gravity','south','-background','#ede9df',
        '-splice','0x22','-font','Helvetica','-pointsize','13','-fill','#39362e',
        '-annotate','+0+4',caption,')'
      ]);
      rows.push('(',...cells,'+append',')');
    }
    execFileSync('magick',[...rows,'-append',
      '-strip','-sampling-factor','4:2:0','-quality','82',path.join(path.dirname(movie),prefix+suffix+'.jpg')]);
  }
  sheet(compactIndices.map(i=>frames[i]),270,2,'-frames-540');
  sheet(frames,360,4,'-filmstrip');
}

export function reviewJpeg(original, output, width) {
  execFileSync('magick',[original,'-resize',width+'x','-strip','-sampling-factor','4:2:0',
    '-quality','82',output]);
}
