// ---- 日影図（冬至日・真太陽時 8〜16時） ----
// 「日影図・高さ制限チェッカー ver.4」（hikage-test）の太陽の位置の式（北緯35°・冬至日の赤緯 −23.45°）と
// 格子で日影時間を数える方法・等時間日影線の引き方（マーチングスクエア）を移植したもの。
// チェッカーは長方形の建物だけだったので、ここでは PLATEAU の建物の形（多角形）のまま影を落とす。
// 影＝建物の形を、太陽と反対向きに「（高さ−測定面）×倍率」だけ引き伸ばした範囲（建物の形・ずらした形・各辺が動いた跡の平行四辺形）。
const HK_D=Math.PI/180,HK_PHI=35*HK_D,HK_DECL=-23.45*HK_D;
function hkSun(hour){const t=(hour-12)*15*HK_D;
 const sh=Math.sin(HK_PHI)*Math.sin(HK_DECL)+Math.cos(HK_PHI)*Math.cos(HK_DECL)*Math.cos(t);if(sh<=1e-6)return null;
 const ch=Math.sqrt(1-sh*sh),az=Math.atan2(Math.cos(HK_DECL)*Math.sin(t)/ch,(sh*Math.sin(HK_PHI)-Math.sin(HK_DECL))/(ch*Math.cos(HK_PHI)));
 return{az,mult:ch/sh}}
// 時刻別日影線の色（8時＝青紫 … 16時＝橙）
const HK_HC=['#4b3fbf','#2f6fd0','#1d9bc4','#18a58a','#4aa83c','#a3a325','#d58a1c','#d95f1e','#c8372a'];
// 等時間日影線：[時間, 色]
const HK_LV=[[1,'#7fa7d8'],[2,'#2f7fbf'],[3,'#6a3fc6'],[4,'#c2399a'],[5,'#c81e1e']];
let HKS=null,hkMarks=[];
// 多角形を格子に塗る（行ごとに交点を求めて、間のマスに fn(添字) を呼ぶ）
function hkFill(P,g,fn){const{x0,y0,cell,nx,ny}=g;let a=Infinity,b=-Infinity;for(const p of P){a=Math.min(a,p[1]);b=Math.max(b,p[1])}
 const j0=Math.max(0,Math.ceil((a-y0)/cell-.5)),j1=Math.min(ny-1,Math.floor((b-y0)/cell-.5)),xs=[];
 for(let j=j0;j<=j1;j++){const y=y0+(j+.5)*cell;xs.length=0;
  for(let i=0,k=P.length-1;i<P.length;k=i++){const p=P[i],q=P[k];if((p[1]>y)!==(q[1]>y))xs.push(p[0]+(y-p[1])*(q[0]-p[0])/(q[1]-p[1]))}
  xs.sort((u,v)=>u-v);
  for(let m=0;m+1<xs.length;m+=2){const i0=Math.max(0,Math.ceil((xs[m]-x0)/cell-.5)),i1=Math.min(nx-1,Math.floor((xs[m+1]-x0)/cell-.5));for(let i=i0;i<=i1;i++)fn(j*nx+i)}}}
// 建物 P（メートルの多角形）を o だけ動かしたときに影が通る範囲
function hkSwept(P,o){const out=[P,P.map(p=>[p[0]+o[0],p[1]+o[1]])];
 for(let i=0,k=P.length-1;i<P.length;k=i++){const a=P[k],b=P[i];out.push([a,b,[b[0]+o[0],b[1]+o[1]],[a[0]+o[0],a[1]+o[1]]])}return out}
// 等値線（チェッカーの contour と同じ）
function hkContour(g,V,level){const{nx,ny,cell,x0,y0}=g,segs=[];const px=i=>x0+(i+.5)*cell,py=j=>y0+(j+.5)*cell;
 const ip=(v1,v2,ax,ay,bx,by)=>{const t=(level-v1)/(v2-v1);return[ax+(bx-ax)*t,ay+(by-ay)*t]};
 for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const a=V[j*nx+i],b2=V[j*nx+i+1],c=V[(j+1)*nx+i+1],d=V[(j+1)*nx+i];
  let m=0;if(a>=level)m|=8;if(b2>=level)m|=4;if(c>=level)m|=2;if(d>=level)m|=1;if(m===0||m===15)continue;
  const X0=px(i),X1=px(i+1),Y0=py(j),Y1=py(j+1);
  const T=()=>ip(a,b2,X0,Y0,X1,Y0),R=()=>ip(b2,c,X1,Y0,X1,Y1),Bt=()=>ip(d,c,X0,Y1,X1,Y1),Lf=()=>ip(a,d,X0,Y0,X0,Y1);
  switch(m){case 1:case 14:segs.push([Lf(),Bt()]);break;case 2:case 13:segs.push([Bt(),R()]);break;case 3:case 12:segs.push([Lf(),R()]);break;
   case 4:case 11:segs.push([T(),R()]);break;case 6:case 9:segs.push([T(),Bt()]);break;case 7:case 8:segs.push([Lf(),T()]);break;
   case 5:segs.push([Lf(),T()],[Bt(),R()]);break;case 10:segs.push([Lf(),Bt()],[T(),R()]);break}}
 return segs}
// fs：影を落とす建物（地図の住棟）、mh：測定面の高さ（m）、dt：計算の刻み（分）
function hkCompute(fs,mh,dt){
 let lo=[180,90,-180,-90];fs.forEach(f=>{const q=bboxOf(f.geometry);lo=[Math.min(lo[0],q[0]),Math.min(lo[1],q[1]),Math.max(lo[2],q[2]),Math.max(lo[3],q[3])]});
 const O=[(lo[0]+lo[2])/2,(lo[1]+lo[3])/2],kx=111320*Math.cos(O[1]*HK_D),ky=110950;
 const toM=c=>[(c[0]-O[0])*kx,(c[1]-O[1])*ky],toLL=p=>[+(O[0]+p[0]/kx).toFixed(7),+(O[1]+p[1]/ky).toFixed(7)];
 const BS=[];fs.forEach(f=>{const h=(f.properties.H||0)-mh;if(h<=0)return;const g=f.geometry,rs=g.type==='Polygon'?[g.coordinates[0]]:g.coordinates.map(p=>p[0]);
  rs.forEach(r=>{const P=r.slice(0,r.length>1&&r[0][0]===r[r.length-1][0]&&r[0][1]===r[r.length-1][1]?-1:undefined).map(toM);if(P.length>=3)BS.push({P,h})})});
 if(!BS.length)return{err:`建物の高さが測定面（${mh} m）以下なので、日影はできません。`};
 const steps=Math.round(8*60/dt),off=(hour,b)=>{const s=hkSun(hour);if(!s)return null;const L=b.h*s.mult;return[L*Math.sin(s.az),L*Math.cos(s.az)]};
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;const ext=(P,o)=>P.forEach(p=>{x0=Math.min(x0,p[0]+o[0]);x1=Math.max(x1,p[0]+o[0]);y0=Math.min(y0,p[1]+o[1]);y1=Math.max(y1,p[1]+o[1])});
 BS.forEach(b=>{ext(b.P,[0,0]);for(const hr of [8,12,16]){const o=off(hr,b);if(o)ext(b.P,o)}});
 x0-=6;x1+=6;y0-=6;y1+=6;
 const cell=Math.max(.5,Math.max(x1-x0,y1-y0)/700),nx=Math.ceil((x1-x0)/cell),ny=Math.ceil((y1-y0)/cell),g={x0,y0,cell,nx,ny};
 const V=new Float32Array(nx*ny),mark=new Int32Array(nx*ny).fill(-1),inB=new Uint8Array(nx*ny);
 BS.forEach(b=>hkFill(b.P,g,i=>inB[i]=1));
 for(let k=0;k<steps;k++){const hour=8+(k+.5)*dt/60,w=dt/60;
  BS.forEach(b=>{const o=off(hour,b);if(!o)return;for(const Q of hkSwept(b.P,o))hkFill(Q,g,i=>{if(mark[i]!==k){mark[i]=k;V[i]+=w}})})}
 // 時刻別日影線（8時〜16時のちょうどの時刻の影の輪郭）
 const hourly=[];for(let h=8;h<=16;h++){const Bm=new Float32Array(nx*ny);
  BS.forEach(b=>{const o=off(h,b);if(!o)return;for(const Q of hkSwept(b.P,o))hkFill(Q,g,i=>Bm[i]=1)});
  hourly.push({h,segs:hkContour(g,Bm,.5)})}
 const isos=HK_LV.map(([lv,c])=>({lv,c,segs:hkContour(g,V,lv)}));
 // 建物の外で、各時間以上の日影になる面積（㎡）
 const area=HK_LV.map(([lv])=>{let n=0;for(let i=0;i<V.length;i++)if(!inB[i]&&V[i]>=lv)n++;return Math.round(n*cell*cell)});
 return{g,V,inB,O,kx,ky,toLL,hourly,isos,area,mh,dt,bb:[O[0]+x0/kx,O[1]+y0/ky,O[0]+x1/kx,O[1]+y1/ky]}}
// 日影時間を色の濃さにした画像（地図の上に敷く）
function hkImage(r){const{g,V,inB}=r,cv=document.createElement('canvas');cv.width=g.nx;cv.height=g.ny;const cx=cv.getContext('2d'),im=cx.createImageData(g.nx,g.ny);
 for(let j=0;j<g.ny;j++)for(let i=0;i<g.nx;i++){const v=V[j*g.nx+i];if(v<=0||inB[j*g.nx+i])continue;const o=((g.ny-1-j)*g.nx+i)*4,t=Math.min(1,v/6);
  im.data[o]=Math.round(60-30*t);im.data[o+1]=Math.round(80-40*t);im.data[o+2]=Math.round(150-30*t);im.data[o+3]=Math.round(40+150*t)}
 cx.putImageData(im,0,0);return cv.toDataURL()}
function hkGeo(r){const fs=[],lab=[];const ml=segs=>({type:'MultiLineString',coordinates:segs.map(s=>[r.toLL(s[0]),r.toLL(s[1])])});
 // 名前の位置：中心からいちばん遠い点
 const far=segs=>{let best=null,d=-1;segs.forEach(s=>s.forEach(p=>{const q=Math.hypot(p[0],p[1]);if(q>d){d=q;best=p}}));return best};
 if(tq('hkHr').checked)r.hourly.forEach(({h,segs})=>{if(!segs.length)return;fs.push({type:'Feature',properties:{t:'h',c:HK_HC[h-8]},geometry:ml(segs)});lab.push({ll:r.toLL(far(segs)),tx:h+'時',c:HK_HC[h-8],small:1})});
 if(tq('hkIso').checked)r.isos.forEach(({lv,c,segs})=>{if(!segs.length)return;fs.push({type:'Feature',properties:{t:'i',c},geometry:ml(segs)});
  // 等時間線は北側（影が伸びる側）に名前を出す
  let best=null;segs.forEach(s=>s.forEach(p=>{if(!best||p[1]>best[1])best=p}));lab.push({ll:r.toLL(best),tx:lv+'時間',c})});
 return{fc:{type:'FeatureCollection',features:fs},lab}}
function hkDraw(){const r=HKS&&HKS.r;hkMarks.forEach(m=>m.remove());hkMarks=[];
 for(const id of['hkImg','hkHrL','hkLine'])if(map.getLayer(id))map.removeLayer(id);for(const id of['hkImg','hkLine'])if(map.getSource(id))map.removeSource(id);
 if(!r||r.err)return;const bb=r.bb,before=map.getLayer('surr')?'surr':undefined;
 if(tq('hkHeat').checked){map.addSource('hkImg',{type:'image',url:hkImage(r),coordinates:[[bb[0],bb[3]],[bb[2],bb[3]],[bb[2],bb[1]],[bb[0],bb[1]]]});
  map.addLayer({id:'hkImg',type:'raster',source:'hkImg',paint:{'raster-opacity':.85,'raster-resampling':'nearest','raster-fade-duration':0}},before)}
 const{fc,lab}=hkGeo(r);map.addSource('hkLine',{type:'geojson',data:fc});
 map.addLayer({id:'hkHrL',type:'line',source:'hkLine',filter:['==',['get','t'],'h'],paint:{'line-color':['get','c'],'line-width':1.4,'line-dasharray':[3,2]}},before);
 map.addLayer({id:'hkLine',type:'line',source:'hkLine',filter:['==',['get','t'],'i'],paint:{'line-color':['get','c'],'line-width':3}},before);
 hkMarks=lab.map(x=>{const el=document.createElement('div');el.className='hklab'+(x.small?' s':'');el.style.borderColor=x.c;el.style.color=x.c;el.textContent=x.tx;return new maplibregl.Marker({element:el}).setLngLat(x.ll).addTo(map)})}
function hkRun(fit){if(!HKS)return;const mh=+tq('hkMh').value,dt=+tq('hkDt').value;tq('hkMsg').textContent='計算しています…';
 setTimeout(()=>{const t0=performance.now();HKS.r=hkCompute(HKS.fs,mh,dt);hkDraw();const r=HKS.r;
  tq('hkMsg').innerHTML=r.err?esc(r.err):`建物の外で日影になる面積：${HK_LV.filter(l=>l[0]>=2).map(([lv],i)=>`${lv}時間以上 約${r.area[i+1].toLocaleString()}㎡`).join('・')}<span style="color:var(--muted)">（計算 ${Math.round(performance.now()-t0)} ms・格子 ${r.g.cell.toFixed(1)} m）</span>`;
  if(fit&&!r.err){const sm=innerWidth<=640;map.fitBounds([[r.bb[0],r.bb[1]],[r.bb[2],r.bb[3]]],{pitch:0,bearing:0,padding:sm?{top:200,bottom:40,left:16,right:16}:{top:150,bottom:40,left:(document.getElementById('panel').getBoundingClientRect().right||0)+20,right:document.getElementById('side').hidden?40:360},duration:800})}},30)}
// 号館（n を渡したとき）または住宅（団地）全体の日影図を出す
function hkOpen(k,g,n){if(TR)tourEnd();
 // xp は「2つの建物で1棟」の2つめ以降の建物。影は落とすので含める
 const fs=ALL.filter(f=>{const p=f.properties;return p.k===k&&(n?p.n===n:p.g===g)});if(!fs.length)return;
 HKS={k,g,n,fs};tq('hkTtl').textContent=(n||g)+(n?'':`（${new Set(fs.map(f=>f.properties.n)).size}棟）`);tq('hkBox').hidden=false;
 if(innerWidth<=640){closeSide();document.getElementById('panel').classList.add('min');document.getElementById('tg').textContent='ひらく'}
 hkRun(true)}
function hkClose(){HKS=null;hkDraw();tq('hkBox').hidden=true}
tq('hkX').onclick=hkClose;
for(const id of['hkMh','hkDt'])tq(id).onchange=()=>hkRun(false);
for(const id of['hkHeat','hkHr','hkIso'])tq(id).onchange=hkDraw;
tq('hkLeg').innerHTML=`<span>時刻別：</span>${HK_HC.map((c,i)=>`<i style="color:${c}">${i+8}</i>`).join('')}<br><span>等時間：</span>${HK_LV.map(([l,c])=>`<i style="color:${c}">${l}h</i>`).join('')}`;
