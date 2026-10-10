// ---- 広告風画像メーカー ----
// 選んだ住宅（団地）を、マンション広告のような1枚の画像にする。
// 地図（航空写真などの3D表示）をそのまま写し、夜っぽい色にして、住宅から白い光が立ち上がるように描き、
// 周りの施設名（地理院地図・OpenStreetMap）・鉄道の線・最寄り駅・キャッチコピー・ロゴを重ねる。
const AD={est:null,b:0,tok:0,img:null,pois:[],rails:[]};
const AD_FONT='"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
const AD_SIZE={wide:[1600,900],sq:[1200,1200],tall:[1080,1350]};
const adQ=id=>document.getElementById(id);
function adStation(e){const r=ktRail(ktOf(e.k,e.g))[0];if(!r)return null;const i=r[0].lastIndexOf(' ');return{line:r[0].slice(0,i),st:r[0].slice(i+1),min:r[1]}}
function adCopy(est){const e=est.properties,s=adStation(e),u=(e.u||0).toLocaleString();
 return s?`${s.st}から徒歩約${s.min}分。この街に、${u}戸の暮らしがある。`:`${e.k}の街に、${u}戸の暮らしがある。`}
function adOpen(est){if(TR)tourEnd();if(typeof HKS!=='undefined'&&HKS)hkClose();
 AD.est=est;AD.b=Math.round(map.getBearing()/15)*15;const e=est.properties;
 adQ('adCopy').value=adCopy(est);adQ('adLogo').value=e.g.replace(/住宅$/,'');adQ('adBox').hidden=false;document.body.classList.add('admode');adShoot()}
function adClose(){AD.tok++;adQ('adBox').hidden=true;document.body.classList.remove('admode');adRestore();AD.est=null}
// 撮影のあいだだけ地図の見た目を変える（敷地の点線・区の塗り・選択の枠を消し、住棟を明るい灰色に）
let AD_SAVE=null;
function adPrepare(){if(AD_SAVE)return;AD_SAVE={vis:{},col:{}};
 for(const id of['ef','el','wf','wl','selLine','selHalo','hkImg','hkHrL','hkLine'])if(map.getLayer(id)){AD_SAVE.vis[id]=map.getLayoutProperty(id,'visibility')||'visible';map.setLayoutProperty(id,'visibility','none')}
 for(const id of['bx','pt'])if(map.getLayer(id)){AD_SAVE.col[id]=map.getPaintProperty(id,'fill-extrusion-color');map.setPaintProperty(id,'fill-extrusion-color','#dfe3e8')}
 AD_SAVE.bm=document.getElementById('bm').value;surrLoad(true);if(map.getLayer('gsibvRail'))map.setLayoutProperty('gsibvRail','visibility','visible')}
function adRestore(){if(!AD_SAVE)return;for(const[id,v]of Object.entries(AD_SAVE.vis))if(map.getLayer(id))map.setLayoutProperty(id,'visibility',v);
 for(const[id,v]of Object.entries(AD_SAVE.col))if(map.getLayer(id))map.setPaintProperty(id,'fill-extrusion-color',v);
 adBase(AD_SAVE.bm);surrLoad(typeof envOn!=='undefined'&&envOn);if(map.getLayer('gsibvRail'))map.setLayoutProperty('gsibvRail','visibility','none');
 if(typeof surrClear==='function')surrClear();AD_SAVE=null}
function adBase(v){const bm=document.getElementById('bm');if(bm.value!==v){bm.value=v;bm.dispatchEvent(new Event('change'))}}
// 写す範囲（地図の画面のうち、出力の縦横比で中央を切り取る）
function adCrop(){const c=map.getCanvas(),[W,H]=AD_SIZE[adQ('adFmt').value],r=W/H;let w=c.width,h=c.height;if(w/h>r)w=h*r;else h=w/r;
 return{x:(c.width-w)/2,y:(c.height-h)/2,w,h,W,H,dpr:c.width/c.clientWidth}}
const adWait=(ms)=>new Promise(r=>setTimeout(r,ms));
function adIdle(tok){return new Promise(res=>{let done=false;const fin=()=>{if(!done){done=true;res()}};map.once('idle',fin);setTimeout(fin,9000)})}
async function adShoot(){const tok=++AD.tok,est=AD.est;if(!est)return;const e=est.properties;
 adQ('adMsg').textContent='地図を準備しています…';adPrepare();adBase(adQ('adBg').value);
 const b=bboxOf(est.geometry),cr=adCrop(),cw=cr.w/cr.dpr,ch=cr.h/cr.dpr,mw=map.getCanvas().clientWidth,mh=map.getCanvas().clientHeight;
 // 住宅が切り取り範囲の幅の3分の1くらいで、下寄り（上から7割くらい）に入るように
 const px=(mw-cw)/2+cw*.34,py=(mh-ch)/2+ch*.35;
 const cam=map.cameraForBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{left:px,right:px,top:py,bottom:py},bearing:AD.b,pitch:52})||{zoom:16.5};
 map.easeTo({center:[(b[0]+b[2])/2,(b[1]+b[3])/2],zoom:Math.min(16.7,Math.max(15,cam.zoom)),pitch:52,bearing:AD.b,offset:[0,ch*.2],duration:0});
 await adIdle(tok);if(tok!==AD.tok)return;
 surrUpdate(est,350);adQ('adMsg').textContent='周りの施設名を集めています…';
 await adPois(est);if(tok!==AD.tok)return;
 await adIdle(tok);await adWait(150);if(tok!==AD.tok)return;
 AD.rails=adRails();
 // 出力の幅に足りないとき（スマホなど）は、撮影のあいだだけ地図を細かく描く
 const pr0=map.getPixelRatio(),need=AD_SIZE[adQ('adFmt').value][0]/cw;
 if(need>pr0){map.setPixelRatio(Math.min(need,8192/mw,8192/mh));await adWait(60)}
 // 地図の絵は、描き終わった直後（render）にだけ読み出せる
 await new Promise(res=>{map.once('render',()=>{const cr2=adCrop(),c=document.createElement('canvas');c.width=cr2.w;c.height=cr2.h;c.getContext('2d').drawImage(map.getCanvas(),cr2.x,cr2.y,cr2.w,cr2.h,0,0,cr2.w,cr2.h);AD.img=c;AD.cr=cr2;res()});map.triggerRepaint()});
 if(map.getPixelRatio()!==pr0)map.setPixelRatio(pr0);
 if(tok!==AD.tok)return;
 AD.poly=adPoly(est);adQ('adMsg').textContent='';adRender()}
async function adPois(est){const e=est.properties,key=e.k+'|'+e.g,b=bboxOf(est.geometry),c=[(b[0]+b[2])/2,(b[1]+b[3])/2],kx=111320*Math.cos(c[1]*Math.PI/180),R=500;
 let els=POI_CACHE[key+'|'+R];if(!els){try{els=await overpass(osmQ(`(around:${R},${c[1]},${c[0]})`));POI_CACHE[key+'|'+R]=els}catch(err){els=[]}}
 const near=D.e.features.filter(f=>{const q=f.bb||(f.bb=bboxOf(f.geometry));return Math.abs((q[0]+q[2])/2-c[0])*kx<R+300&&Math.abs((q[1]+q[3])/2-c[1])*110950<R+300});
 const rb=[c[0]-R/kx,c[1]-R/110950,c[0]+R/kx,c[1]+R/110950];
 AD.pois=poiMerge([...els.map(osmItem),...gsiItems(rb)],near).filter(x=>x.nm!==e.g);AD.osm=AD.pois.some(x=>x.osm)}
function adRails(){if(!map.getSource('gsibv'))return[];const out=[];
 try{for(const f of map.querySourceFeatures('gsibv',{sourceLayer:'railway'})){const g=f.geometry;if(g.type==='LineString')out.push(g.coordinates);else if(g.type==='MultiLineString')out.push(...g.coordinates)}}catch(e){}
 return out}
function adPoly(est){const g=est.geometry;return(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p[0])}
// 画面（切り取った画像）の座標へ
function adPt(ll){const p=map.project(ll),cr=AD.cr;return[(p.x*cr.dpr-cr.x)*(cr.W/cr.w),(p.y*cr.dpr-cr.y)*(cr.W/cr.w)]}
function adFit(ctx,t,max,size,weight){let s=size;do{ctx.font=`${weight} ${s}px ${AD_FONT}`;if(ctx.measureText(t).width<=max)break;s-=1}while(s>8);return s}
function adRender(){if(!AD.img||!AD.est)return;const e=AD.est.properties,[W,H]=[AD.cr.W,AD.cr.H],S=W/1600,night=adQ('adTone').value==='night';
 const cv=adQ('adCv');cv.width=W;cv.height=H;const x=cv.getContext('2d');
 // 1. 地図（夜は暗く青く）
 x.filter=night?'brightness(.55) contrast(1.2) saturate(1.25)':'contrast(1.05) saturate(1.1)';x.drawImage(AD.img,0,0,W,H);x.filter='none';
 if(night){x.globalCompositeOperation='multiply';x.fillStyle='#3d5fb8';x.fillRect(0,0,W,H);x.globalCompositeOperation='source-over';
  const vg=x.createRadialGradient(W/2,H*.55,H*.2,W/2,H*.55,H*.95);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,8,30,.55)');x.fillStyle=vg;x.fillRect(0,0,W,H)}
 // 2. 鉄道の線を光らせる
 if(adQ('adRail').checked&&AD.rails.length){x.save();x.lineCap='round';x.lineJoin='round';
  const path=()=>{x.beginPath();AD.rails.forEach(l=>l.forEach((c,i)=>{const p=adPt(c);i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])}))};
  x.globalCompositeOperation='lighter';x.shadowColor='rgba(255,170,40,1)';x.shadowBlur=30*S;x.strokeStyle='rgba(255,170,50,.55)';x.lineWidth=16*S;path();x.stroke();
  x.shadowBlur=10*S;x.strokeStyle='rgba(255,215,120,.9)';x.lineWidth=5*S;path();x.stroke();x.shadowBlur=0;x.strokeStyle='rgba(255,250,230,.95)';x.lineWidth=1.6*S;path();x.stroke();x.restore()}
 // 3. 住宅の敷地から立ち上がる白い光
 const polys=AD.poly.map(r=>r.map(adPt));let top=Infinity,bot=-Infinity,cxs=0,n=0;polys.forEach(P=>P.forEach(p=>{top=Math.min(top,p[1]);bot=Math.max(bot,p[1]);cxs+=p[0];n++}));
 const cx=cxs/n,colH=Math.max(H*.42,(bot-top)*2),fillP=(P,dy)=>{x.beginPath();P.forEach((p,i)=>i?x.lineTo(p[0],p[1]-dy):x.moveTo(p[0],p[1]-dy));x.closePath();x.fill()};
 x.save();x.globalCompositeOperation='lighter';
 // 縞にならないよう、2pxずつ上にずらして薄く重ねる
 const steps=Math.max(60,Math.round(colH/(2*S))),a0=(night?6:3)/steps;for(let i=0;i<=steps;i++){const t=i/steps;x.fillStyle=`rgba(${night?'190,225,255':'255,255,255'},${(a0*(1-t)*(1-t)).toFixed(4)})`;polys.forEach(P=>fillP(P,colH*t))}
 x.shadowColor='#fff';x.shadowBlur=40*S;x.fillStyle=`rgba(255,255,255,${night?.85:.5})`;polys.forEach(P=>fillP(P,0));
 // 光の筋（毎回同じ位置になるよう、決まった乱数で）
 x.shadowBlur=0;let sd=7;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
 const allP=polys.flat();for(let i=0;i<18;i++){const a=allP[Math.floor(rnd()*allP.length)],hh=colH*(.4+.6*rnd());
  const gr=x.createLinearGradient(0,a[1],0,a[1]-hh);gr.addColorStop(0,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(a[0]-1.2*S,a[1]-hh,2.4*S,hh)}
 x.restore();
 // 4. ロゴ（住宅の上）
 const lw=260*S,lh=290*S;let lx=Math.min(W-lw-20*S,Math.max(20*S,cx-lw/2)),ly=Math.max(110*S,top-colH*.45-lh);ly=Math.min(ly,H-lh-150*S);
 const boxes=[[lx,ly,lw,lh]];
 x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=24*S;const lg=x.createLinearGradient(lx,ly,lx+lw,ly+lh);lg.addColorStop(0,'#c9a466');lg.addColorStop(.5,'#a8834a');lg.addColorStop(1,'#7d5e2c');
 x.fillStyle=lg;x.fillRect(lx,ly,lw,lh);x.restore();x.strokeStyle='rgba(255,236,190,.7)';x.lineWidth=2*S;x.strokeRect(lx+8*S,ly+8*S,lw-16*S,lh-16*S);
 x.strokeStyle='#2a1d0b';x.fillStyle='#2a1d0b';x.lineWidth=3*S;const ix=lx+lw/2,iy=ly+56*S;// 家のしるし
 x.beginPath();x.moveTo(ix-34*S,iy+6*S);x.lineTo(ix,iy-24*S);x.lineTo(ix+34*S,iy+6*S);x.stroke();x.fillRect(ix-22*S,iy+2*S,44*S,3*S);x.fillRect(ix-4*S,iy-8*S,8*S,12*S);
 const logo=adQ('adLogo').value||e.g;x.textAlign='center';x.textBaseline='middle';x.fillStyle='#1f160a';
 const lines=logo.length>6?[logo.slice(0,Math.ceil(logo.length/2)),logo.slice(Math.ceil(logo.length/2))]:[logo];
 lines.forEach((t,i)=>{adFit(x,t,lw-40*S,(lines.length>1?46:58)*S,900);x.fillText(t,ix,ly+(lines.length>1?128+i*54:150)*S)});
 x.font=`700 ${13*S}px ${AD_FONT}`;x.fillText('O S A K A   C I T Y',ix,ly+lh-64*S);adFit(x,`大阪市${e.k}・市営住宅`,lw-40*S,17*S,600);x.fillText(`大阪市${e.k}・市営住宅`,ix,ly+lh-38*S);
 // 5. 周りの施設名（四角い黒の札）
 const st=adStation(e),stName=st&&st.st.replace(/駅$/,'');
 // 最寄り駅は「○○駅」の名前のものだけ（「扇町公園」などは別）
 const isStn=p=>stName&&(p.nm===stName+'駅'||p.nm.startsWith(stName+'駅'));
 const cand=AD.pois.map(p=>({...p,pt:adPt(p.ll)})).filter(p=>p.pt[0]>30*S&&p.pt[0]<W-30*S&&p.pt[1]>140*S&&p.pt[1]<H-150*S);
 cand.forEach(p=>{p.sc=p.cat[1]*10+(isStn(p)?100:0)-Math.hypot(p.pt[0]-cx,p.pt[1]-(top+bot)/2)/W});cand.sort((a,b)=>b.sc-a.sc);
 const hit=(a,b)=>a[0]<b[0]+b[2]&&b[0]<a[0]+a[2]&&a[1]<b[1]+b[3]&&b[1]<a[1]+a[3];let cnt=0;
 for(const p of cand){if(cnt>=+adQ('adN').value)break;const isSt=isStn(p);const t=isSt&&st.line?`${st.line} ${p.nm}`:p.nm;
  const fs=(isSt?21:17)*S;x.font=`700 ${fs}px ${AD_FONT}`;const tw=Math.min(x.measureText(t).width,360*S),bw=tw+20*S,bh=fs+14*S,bx=Math.min(W-bw-10*S,Math.max(10*S,p.pt[0]-bw/2)),by=p.pt[1]-bh-22*S,r=[bx,by,bw,bh];
  if(boxes.some(q=>hit(r,q)))continue;boxes.push(r);cnt++;
  x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=1.5*S;x.beginPath();x.moveTo(p.pt[0],by+bh);x.lineTo(p.pt[0],p.pt[1]);x.stroke();
  x.fillStyle='rgba(255,255,255,.9)';x.beginPath();x.arc(p.pt[0],p.pt[1],3*S,0,Math.PI*2);x.fill();
  x.fillStyle=isSt?'rgba(120,85,20,.92)':'rgba(20,24,30,.86)';x.fillRect(bx,by,bw,bh);x.strokeStyle=isSt?'#f2d48a':'rgba(255,255,255,.35)';x.lineWidth=1*S;x.strokeRect(bx+.5,by+.5,bw-1,bh-1);
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.fillText(t,bx+bw/2,by+bh/2,tw)}
 // 6. キャッチコピー
 const cp=adQ('adCopy').value;x.textAlign='left';x.textBaseline='alphabetic';const cs=adFit(x,cp,W-120*S,46*S,800);
 x.save();x.shadowColor='rgba(0,0,0,.7)';x.shadowBlur=14*S;x.fillStyle='#fff';x.fillText(cp,56*S,86*S);x.restore();
 // 7. 下の帯（住宅の情報と注意書き）
 const bg=x.createLinearGradient(0,H-170*S,0,H);bg.addColorStop(0,'rgba(5,10,25,0)');bg.addColorStop(.45,'rgba(5,10,25,.78)');bg.addColorStop(1,'rgba(5,10,25,.92)');x.fillStyle=bg;x.fillRect(0,H-170*S,W,170*S);
 const yr=e.y0?(e.y0===e.y1?`${e.y0}年度`:`${e.y0}〜${e.y1}年度`):'';
 const info=[`大阪市営 ${e.g}`,`${e.k}`,`${e.nb}棟・${(e.u||0).toLocaleString()}戸`,yr&&`建設 ${yr}`,st&&`${st.line} ${st.st} 徒歩約${st.min}分`].filter(Boolean).join('　|　');
 x.fillStyle='#fff';adFit(x,info,W-100*S,24*S,700);x.fillText(info,50*S,H-62*S);
 x.fillStyle='rgba(255,255,255,.72)';adFit(x,'',W,13*S,500);
 const note=`※公開データ（PLATEAU・地理院タイル${AD.osm?'・OpenStreetMap':''}・大阪市「市営住宅一覧」）から自動で作ったイメージ画像です。実在の広告・入居募集とは関係ありません。 地図：地理院タイル${AD.osm?'／© OpenStreetMap contributors':''}／PLATEAU（国土交通省）`;
 adFit(x,note,W-100*S,13*S,500);x.fillText(note,50*S,H-28*S)}
function adSave(){const cv=adQ('adCv'),e=AD.est&&AD.est.properties;if(!e)return;
 try{const a=document.createElement('a');a.download=`広告風_${e.g}.png`;a.href=cv.toDataURL('image/png');document.body.appendChild(a);a.click();a.remove()}
 catch(err){adQ('adMsg').textContent='画像を保存できませんでした（地図の画像の読み込み元が保存を許可していない可能性があります）'}}
adQ('adX').onclick=adClose;adQ('adSave').onclick=adSave;adQ('adRe').onclick=adShoot;
adQ('adL').onclick=()=>{AD.b-=45;adShoot()};adQ('adR').onclick=()=>{AD.b+=45;adShoot()};
for(const id of['adFmt','adBg'])adQ(id).onchange=adShoot;
for(const id of['adTone','adRail','adN'])adQ(id).onchange=adRender;
for(const id of['adCopy','adLogo'])adQ(id).oninput=adRender;
addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!adQ('adBox').hidden)adClose()});
