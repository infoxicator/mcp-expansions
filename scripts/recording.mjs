import { writeFileSync } from 'node:fs';
import path from 'node:path';

// The compositor sends frames only when pixels change. Sample that timeline
// on the video clock so a held word or a quiet display keeps its actual duration.
export function writeFrames(directory, frames, endSeconds) {
  if (!frames.length) throw new Error('Chrome returned no frames');
  const lines = ['ffconcat version 1.0'];
  let source = 0;
  for (let tick = 0; tick < Math.ceil(endSeconds * 30); tick++) {
    while (source + 1 < frames.length && frames[source + 1].ts <= tick / 30) source++;
    lines.push("file '" + path.basename(frames[source].fname) + "'", 'option framerate 30');
  }
  const list = path.join(directory, 'frames.txt');
  writeFileSync(list, lines.join('\n') + '\n');
  return list;
}
