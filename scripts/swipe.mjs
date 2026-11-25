// A native touchscreen gesture. The finger lifts before the CSS scroll snap settles.
export async function swipeNext(page, cdp, target) {
  const x = 580;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y: 856 }],
  });
  for (let step = 1; step <= 16; step++) {
    const t = step / 16;
    const y = 856 - Math.round(660 * t*t*(3 - 2*t));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await page.waitForFunction(i => {
    const feed = document.querySelector('#feed');
    return window.__MCP_FEED__.getActiveIndex() === i && Math.abs(feed.scrollTop - i * feed.clientHeight) < 2;
  }, target);
}
