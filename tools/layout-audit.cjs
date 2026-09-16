const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///D:/GYM/index.html');
 await page.evaluate(()=>{localStorage.setItem('fitness-records-v1',JSON.stringify([{id:'audit',date:'2026-09-12',durationMinutes:65,startTime:'18:00',endTime:'19:05',bodyParts:['胸','肩'],note:'布局检查：长备注内容。'.repeat(10),exercises:[{name:'哑铃上斜卧推',sets:[{weight:25,reps:12,rir:2,isWarmup:false}]}],createdAt:1}]));localStorage.setItem('fitness-weight-v1',JSON.stringify([{id:'w',date:'2026-09-12',weight:72}]));});
 const failures=[];
 for(const width of [320,393,430,768,1280]){
  await page.setViewportSize({width,height:852});
  for(const route of ['dashboard','new','history','detail/audit','summary','settings']){
   await page.goto('file:///D:/GYM/index.html#'+route);await page.waitForTimeout(100);
   await page.locator('.app-disclosure').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
   await page.waitForTimeout(50);
   const bad=await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.right>innerWidth+1||r.left< -1)&&getComputedStyle(e).position!=='absolute';}).map(e=>e.tagName+'.'+e.className).slice(0,8));
   if(bad.length)failures.push({width,route,bad});
   if(width===393&&route==='new')await page.screenshot({path:'D:/GYM/tools/layout-audit.png',fullPage:true});
  }
 }
 console.log(JSON.stringify({failures,errors}));await browser.close();if(failures.length||errors.length)process.exitCode=1;
})();
