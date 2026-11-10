global.THREE = require('three');
const fs = require('fs');
const src = ['01_core','02_env','03_fdm'].map(f=>fs.readFileSync('src/'+f+'.js','utf8')).join('\n');
const {FS, AD, KT, FT, DEG} = new Function(src + '\nreturn {FS, AD, KT, FT, DEG};')();
const env = FS.env, cl=(v,a,b)=>Math.max(a,Math.min(b,v));
function std(tc){ env.wx.windKt=0; env.wx.gustKt=0; env.wx.turb=0; env.wx.tempC=tc; env.wx.qnh=1013.25; env.windSnap=true; env.update(0);}
function sim(ac,T,fn){const dt=1/240;for(let t=0;t<T;t+=dt){env.t+=dt;fn&&fn(ac,t,dt);ac.step(dt);if(Math.round(t/dt)%4==0)ac.derive(4*dt);}}
function wings(a){a.ctl.roll=cl(-a.o.bank*0.04-a.w.x*0.6,-1,1);a._yi=cl((a._yi||0)+a.o.ball*2/240,-1,1);a.ctl.yaw=cl(a._yi+a.o.ball*2+a.w.y*0.8,-1,1);}
function holdPitch(a,thc){a._pi=cl((a._pi||0)+(thc-a.o.pitch)*0.05/240,-0.6,0.6);a.ctl.pitch=cl((thc-a.o.pitch)*0.08-a.w.z*1.0+a._pi,-1,1);}
function holdIAS(a,v){a._th=cl((a._th===undefined?a.o.pitch:a._th)+(a.o.ias-v)*0.15/240,-15,20);holdPitch(a,cl(a._th+(a.o.ias-v)*0.4,-15,18));}
function holdAlt(a,h){const e=h-a.pos.y;a._ti=cl((a._ti||0)+e*0.02/240,-6,12);holdPitch(a,cl(e*0.12-a.vel.y*0.9,-8,10)+a._ti);}
std(28);
console.log('mass lb', (new FS.Aircraft().mass()/0.4536).toFixed(0));
for (const th of [0.3,0.36,0.42,0.48]) { const a=new FS.Aircraft(); a.place({x:0,z:0,hdg:AD.RWY_TRUE,agl:900,kias:68,state:'flight',flaps:3}); sim(a,45,(a)=>{a.ctl.throttle=th;holdIAS(a,65);wings(a);}); const ang=Math.atan2(-a.vel.y, Math.hypot(a.vel.x,a.vel.z))/DEG; console.log('flaps30 65kias thr',th,'rpm',a.eng.rpm.toFixed(0),'vs',a.o.vs.toFixed(0),'path deg',ang.toFixed(2)); }
{ const a=new FS.Aircraft(); a.place({x:0,z:0,hdg:AD.RWY_TRUE,agl:900,kias:68,state:'flight',flaps:3}); sim(a,45,(a)=>{a.ctl.throttle=0;holdIAS(a,65);wings(a);}); console.log('idle flaps30: vs',a.o.vs.toFixed(0),'rpm',a.eng.rpm.toFixed(0)); }
// takeoff + climb
std(15-1.98*1.328);
let ac=new FS.Aircraft(); ac.place({x:30,z:0,hdg:AD.RWY_TRUE,state:'idle'}); ac.ctl.parkBrake=false; let lift=null;
FS.bus.on('liftoff',e=>{lift=lift||{ias:+e.ias.toFixed(1),dist:+(e.x-30).toFixed(0)}});
sim(ac,45,(a)=>{a.ctl.throttle=1;if(a.onGround){a.ctl.yaw=cl(-a.pos.z*0.05-a.vel.z*0.15+a.w.y*1.5,-1,1);if(a.o.ias>55)a.ctl.pitch=0.3;}else{holdIAS(a,74);wings(a);}});
let a0=ac.pos.y; sim(ac,40,(a)=>{a.ctl.throttle=1;holdIAS(a,74);wings(a);});
console.log('liftoff',lift,'climb fpm',((ac.pos.y-a0)/FT*1.5).toFixed(0),'at',ac.o.altFt.toFixed(0),'ft');
function stall(flaps){const a=new FS.Aircraft();a.place({x:0,z:0,hdg:AD.RWY_TRUE,agl:1200,kias:70,state:'flight',flaps});const h0=a.pos.y;let brk=null;sim(a,60,(a,t)=>{a.ctl.throttle=0;if(!brk)holdAlt(a,h0);else a.ctl.pitch=0;wings(a);if(a.o.stall>0.35&&!brk)brk={ias:a.o.ias.toFixed(1),cas:a.o.cas.toFixed(1),nz:a.o.nz.toFixed(2)};});return brk;}
console.log('stall clean',JSON.stringify(stall(0)),'flaps30',JSON.stringify(stall(3)));
{ const a=new FS.Aircraft(); a.place({x:0,z:0,hdg:AD.RWY_TRUE,agl:300,kias:100,state:'flight'}); const h0=a.pos.y; sim(a,150,(a)=>{a.ctl.throttle=1;holdAlt(a,h0);wings(a);}); console.log('Vmax tas',a.o.tas.toFixed(1),'rpm',a.eng.rpm.toFixed(0)); }
