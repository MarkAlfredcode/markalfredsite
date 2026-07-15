/* press-scene.js — endless pixel-art press warehouse
   Shared by printing-press.html (Warehouse) and arcade.html (Games backdrop).
   Roku-City-style: slow eternal right-to-left drift, hashed per-bay variety,
   parallax (view < wall < machines), day/night cycle w/ golden hour, weather
   (every 3rd day rains), big factory windows with a DC skyline view, and a
   pile of small animated vignettes + easter eggs. */
(function(){
var canvas=document.getElementById('press');
if(!canvas) return;
var ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;

// ── core dimensions / timing ─────────────────────────────────────────────────
var SCENE_H=563;
var FLOOR_START=SCENE_H-74;   // 489 — floor line
var SHIFT=SCENE_H-320;        // 243 — machine layer sits on the floor
var W=1000,H=SCENE_H;
var PITCH=360;                // px between press stations
var LOOP=8000;                // machine motions complete integer cycles per LOOP
var SCROLL_SPEED=11;          // px/sec — the eternal drift
var DAY_PERIOD=240000;        // one full day/night every 4 minutes
var scrollX=0;

// ── tiny drawing helpers ─────────────────────────────────────────────────────
function R(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function C(cx,cy,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();}
function poly(pts,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();ctx.fill();}
function line(x1,y1,x2,y2,c,w){ctx.strokeStyle=c;ctx.lineWidth=w||1;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function hx(h){var v=parseInt(h.slice(1),16);return [(v>>16)&255,(v>>8)&255,v&255];}
function mix(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function css(c){return 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')';}

function shadedDisc(cx,cy,r,base,light,dark){
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
  C(cx,cy,r,base);
  C(cx+r*0.38,cy+r*0.38,r*0.8,dark);
  C(cx-r*0.32,cy-r*0.32,r*0.62,light);
  C(cx-r*0.5,cy-r*0.5,r*0.16,'#ffffff');
  ctx.restore();
  ctx.strokeStyle=COL.steelDark;ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
}
function isoBox(x,y,w,h,depth,front,top,side){
  poly([[x,y],[x+w,y],[x+w+depth*0.6,y-depth],[x+depth*0.6,y-depth]],top);
  poly([[x+w,y],[x+w,y+h],[x+w+depth*0.6,y+h-depth],[x+w+depth*0.6,y-depth]],side);
  R(x,y,w,h,front);
}
function roller(cx,cy,r,turns,p,base,lightC,darkC){
  shadedDisc(cx,cy,r,base||COL.steelMid,lightC||COL.steelHi,darkC||COL.steelDark);
  var ang=p*Math.PI*2*turns;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(ang);
  ctx.strokeStyle='rgba(15,17,20,0.5)';ctx.lineWidth=1.2;
  for(var i=0;i<6;i++){var a=i/6*Math.PI*2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*r*0.85,Math.sin(a)*r*0.85);ctx.stroke();}
  ctx.restore();
  shadedDisc(cx,cy,Math.max(2,r*0.22),COL.brass,COL.brassHi,COL.brassLo);
}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// deterministic per-world-index choice in [0,n)
function pick(i,salt,n){var f=mulberry32((((i+1)*2654435761)^(salt*40503))>>>0);f();return Math.floor(f()*n);}
// light cone with a soft faded bottom edge
function fadePoly(pts,yTop,yBot,rgb,aTop){
  var g=ctx.createLinearGradient(0,yTop,0,yBot);
  g.addColorStop(0,'rgba('+rgb+','+aTop.toFixed(3)+')');
  g.addColorStop(1,'rgba('+rgb+',0)');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.closePath();ctx.fill();
}
// visit every world-tile of a given pitch that touches the viewport
function eachTile(pitch,base,off,cb){
  var first=Math.floor((off-base)/pitch)-1;
  var last=Math.floor((off-base+W)/pitch)+1;
  for(var i=first;i<=last;i++){cb(base+i*pitch-off,i);}
}

// ── palette ──────────────────────────────────────────────────────────────────
var COL={
  paper:'#f5f2ea', paper2:'#efece2', ink:'#16130c', inkSoft:'#33302a',
  ruleSoft:'#cbc5b6', red:'#b3271b', redDark:'#8f1d13',
  wall:'#c9ccc9', wallHi:'#dcdfdb', wallLo:'#b2b6b3',
  truss:'#5a6168', trussDark:'#3e444a', roofDark:'#2f343a',
  teal:'#2e6273', tealHi:'#4b8ba0', tealLo:'#1d4450', tealDeep:'#142f38',
  floorFar:'#83878b', floorNear:'#4d5054', floorLine:'#3d4043',
  steelDark:'#23262b', steelMid:'#4a4e55', steelLight:'#7c8189', steelHi:'#aeb3ba',
  brass:'#a8813a', brassHi:'#e0b962', brassLo:'#6b4f22',
  tube:'#eef4e6',
  webPaper:'#e9e4d6', webShade:'#c9c3b2',
  green:'#59b26a'
};

// ── 3x5 pixel font ───────────────────────────────────────────────────────────
var FONT={
  M:['101','111','111','101','101'],A:['010','101','111','101','101'],R:['110','101','110','101','101'],
  K:['101','101','110','101','101'],L:['100','100','100','100','111'],F:['111','100','110','100','100'],
  E:['111','100','110','100','111'],D:['110','101','101','101','110'],
  B:['110','101','110','101','110'],C:['111','100','100','100','111'],G:['111','100','101','101','111'],
  H:['101','101','111','101','101'],I:['111','010','010','010','111'],N:['111','101','101','101','101'],
  O:['111','101','101','101','111'],P:['111','101','111','100','100'],S:['111','100','111','001','111'],
  T:['111','010','010','010','010'],U:['101','101','101','101','111'],V:['101','101','101','101','010'],
  W:['101','101','111','111','101'],X:['101','101','010','101','101'],Y:['101','101','010','010','010'],
  Z:['111','001','010','100','111'],
  '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['111','001','111','100','111'],
  '3':['111','001','111','001','111'],'4':['101','101','111','001','001'],
  ':':['000','010','000','010','000'],' ':['000','000','000','000','000']
};
function drawText(x,y,str,c){var cx=x;for(var i=0;i<str.length;i++){var g=FONT[str[i]];if(g){for(var r2=0;r2<5;r2++)for(var c2=0;c2<3;c2++)if(g[r2][c2]==='1')R(cx+c2,y+r2,1,1,c);}cx+=4;}return cx;}

// ── mini front page (red kicker, masthead, columns) ─────────────────────────
function frontPage(x,y,w,h,seed,thickness){
  if(thickness){
    poly([[x+w,y],[x+w+thickness,y+thickness],[x+w+thickness,y+h+thickness],[x+w,y+h]],COL.ruleSoft);
    poly([[x,y+h],[x+thickness,y+h+thickness],[x+w+thickness,y+h+thickness],[x+w,y+h]],'#b9b2a0');
  }
  R(x,y,w,h,COL.paper);
  R(x,y,w,Math.max(2,h/6),COL.red);
  R(x+1,y+h/6+1,w-2,Math.max(1,h*0.07),COL.ink);
  var rnd=mulberry32(seed);
  if(w<16){
    for(var j=0;j<4;j++) R(x+1,y+h*0.45+j*2,w-2-rnd()*2,1,COL.inkSoft);
    ctx.strokeStyle=COL.inkSoft;ctx.lineWidth=0.5;ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
    return;
  }
  var bodyTop=y+h*0.36, colW=(w-4)/3;
  R(x+2,bodyTop,colW-1,h*0.26,COL.ruleSoft);
  var lines=Math.max(2,Math.floor(h*0.11));
  for(var li=0;li<lines;li++) R(x+2,bodyTop+h*0.30+li*2,Math.max(0.4,colW-2-rnd()*3),1,COL.inkSoft);
  for(var c=1;c<3;c++){var l2=Math.max(3,Math.floor(h*0.17));for(var k=0;k<l2;k++)R(x+2+colW*c+1,bodyTop+k*2,Math.max(0.4,colW-2-rnd()*3),1,COL.inkSoft);}
  ctx.strokeStyle=COL.inkSoft;ctx.lineWidth=0.5;ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
}

// ── path helpers (used by the output stream) ────────────────────────────────
function pathPoint(path,s){
  for(var i=0;i<path.length-1;i++){
    var dx=path[i+1][0]-path[i][0], dy=path[i+1][1]-path[i][1];
    var len=Math.sqrt(dx*dx+dy*dy);
    if(s<=len) return {x:path[i][0]+dx*s/len, y:path[i][1]+dy*s/len, ang:Math.atan2(dy,dx)};
    s-=len;
  }
  var n=path.length-1, dx2=path[n][0]-path[n-1][0], dy2=path[n][1]-path[n-1][1];
  return {x:path[n][0], y:path[n][1], ang:Math.atan2(dy2,dx2)};
}
function pathLen(path){var L=0;for(var i=0;i<path.length-1;i++){var dx=path[i+1][0]-path[i][0],dy=path[i+1][1]-path[i][1];L+=Math.sqrt(dx*dx+dy*dy);}return L;}

/* ════════════════════════════════ THE VIEW ═══════════════════════════════
   Big factory windows look out on a DC skyline (Capitol dome, Washington
   Monument, radio masts). Deepest parallax layer; sun/moon/stars/clouds/
   birds/rain live out there. */

function windowPath(x,shape){
  ctx.beginPath();
  if(shape===0){ // arched
    ctx.moveTo(x-84,170); ctx.lineTo(x-84,100);
    ctx.ellipse(x,100,84,32,0,Math.PI,Math.PI*2);
    ctx.lineTo(x+84,170); ctx.closePath();
  } else {       // wide flat
    ctx.rect(x-84,78,168,92);
  }
}

function drawCapitol(cx,hz,env){
  var c=env.silCss;
  R(cx-52,hz-10,22,10,c); R(cx+30,hz-10,22,10,c);       // wings
  R(cx-30,hz-16,60,16,c);                               // main block
  R(cx-10,hz-24,20,8,c);                                // drum
  ctx.fillStyle=c;ctx.beginPath();ctx.arc(cx,hz-24,10,Math.PI,Math.PI*2);ctx.fill(); // dome
  R(cx-2,hz-39,4,6,c); R(cx-1,hz-42,2,3,c);             // cupola + statue
}
function drawMonument(cx,hz,env){
  var c=env.silCss;
  poly([[cx-5,hz],[cx-3,hz-46],[cx+3,hz-46],[cx+5,hz]],c);
  poly([[cx-3,hz-46],[cx,hz-55],[cx+3,hz-46]],c);
}
function drawTower(cx,hz,env){
  var c=env.silCss;
  R(cx-1,hz-40,2,40,c);
  line(cx-8,hz,cx,hz-30,c,1); line(cx+8,hz,cx,hz-30,c,1);
  R(cx-4,hz-14,8,1,c); R(cx-3,hz-26,6,1,c);
}

// glow=true → only emissive bits (stars, moon halo, lit windows, blinks)
function drawViewContent(x,env,glow){
  var vx=x-84, vy=62, vw=168, vh=110;
  var hz=vy+82; // skyline horizon
  if(!glow){
    // pixel-band sky
    var bandH=(hz-vy)/5;
    for(var b=0;b<5;b++) R(vx,vy+b*bandH,vw,bandH+1,css(mix(env.skyTopC,env.skyBotC,b/4)));
    if(env.dusk>0.02&&!env.rainy){
      ctx.globalAlpha=env.dusk*0.30; R(vx,hz-16,vw,16,'#f09a4e');
      ctx.globalAlpha=env.dusk*0.16; R(vx,hz-30,vw,14,'#e8b06a');
      ctx.globalAlpha=1;
    }
    // sun — screen-fixed (at infinity): only the window it lines up with shows it
    if(!env.rainy){
      var s=((env.dph+0.25)%1)*2;
      if(s<=1.03){
        var sx=20+s*(W-40), sy=hz-4-Math.sin(Math.PI*Math.min(1,s))*66;
        ctx.globalAlpha=Math.max(0,1-env.night*1.6);
        C(sx,sy,7,'#ffd98a'); C(sx-1,sy-1,4.5,'#fff3c9');
        ctx.globalAlpha=Math.max(0,0.25-env.night*0.4); C(sx,sy,12,'#ffe9b0');
        ctx.globalAlpha=1;
      }
    }
  }
  // moon — screen-fixed like the sun (disc in main pass, halo in glow pass)
  if(!env.rainy){
    var m=((env.dph+0.75)%1)*2;
    if(m<=1.03&&env.night>0.25){
      var mx=20+m*(W-40), my=hz-4-Math.sin(Math.PI*Math.min(1,m))*66;
      if(glow){
        ctx.globalAlpha=0.20*env.night; C(mx,my,11,'#cfe0ff');
        ctx.globalAlpha=0.10*env.night; C(mx,my,17,'#cfe0ff'); ctx.globalAlpha=1;
      } else {
        ctx.globalAlpha=Math.min(1,(env.night-0.25)*2);
        C(mx,my,5.5,'#e9edf4');
        R(mx-2,my-1,2,2,'#c8cfda'); R(mx+1,my+2,1.5,1.5,'#c8cfda'); R(mx+2,my-3,1,1,'#c8cfda');
        ctx.globalAlpha=1;
      }
    }
  }
  // stars
  if(!env.rainy&&env.night>0.4){
    eachTile(480,0,env.bgV,function(tx,ti){
      var rnd=mulberry32((((ti%89)+89)%89)*97+5);
      for(var k=0;k<14;k++){
        var sx2=tx+rnd()*480, sy2=vy+3+rnd()*(hz-vy-16);
        var tw=0.5+0.5*Math.sin(env.t*1.7+k*2.4+ti);
        ctx.globalAlpha=(env.night-0.4)/0.6*(glow?(0.45+0.5*tw):(0.22+0.3*tw));
        R(sx2,sy2,1.2,1.2,'#e8f0ff');
      }
    });
    ctx.globalAlpha=1;
  }
  // clouds
  if(!glow&&!env.rainy){
    eachTile(480,40,env.bgV+env.t*2.5,function(tx,ti){
      var rnd=mulberry32((((ti%83)+83)%83)*61+9);
      for(var k3=0;k3<2;k3++){
        var cxx=tx+rnd()*360, cyy=vy+6+rnd()*32;
        ctx.globalAlpha=0.72-env.night*0.35;
        R(cxx,cyy,26,6,env.cloudCss); R(cxx+5,cyy-4,16,5,env.cloudCss); R(cxx+10,cyy+4,17,4,env.cloudCss);
      }
    });
    ctx.globalAlpha=1;
  }
  // ground strip
  if(!glow) R(vx,hz,vw,(vy+vh)-hz+4,env.sil2Css);
  // skyline (buildings precomputed so main/glow rnd streams stay in sync)
  eachTile(480,0,env.bgV,function(tx,ti){
    var tiN=((ti%3)+3)%3;
    var rnd=mulberry32((((ti%79)+79)%79)*151+3);
    var blds=[],bx=tx+6;
    for(var b2=0;b2<6;b2++){
      var bw=22+rnd()*26, bh=14+rnd()*40;
      blds.push([bx,bw,bh]); bx+=bw+8+rnd()*16;
    }
    if(!glow){
      for(var b3=0;b3<6;b3++) R(blds[b3][0],hz-blds[b3][2],blds[b3][1],blds[b3][2],env.silCss);
      if(tiN===0) drawCapitol(tx+240,hz,env);
      if(tiN===1) drawMonument(tx+150,hz,env);
      if(tiN===2) drawTower(tx+300,hz,env);
    } else {
      if(env.night>0.35){
        var rnd2=mulberry32((((ti%79)+79)%79)*151+77);
        ctx.globalAlpha=Math.min(1,(env.night-0.35)*1.4);
        for(var b4=0;b4<6;b4++){
          var bb=blds[b4];
          for(var wy2=hz-bb[2]+4; wy2<hz-4; wy2+=6)
            for(var wx2=bb[0]+3; wx2<bb[0]+bb[1]-3; wx2+=5)
              if(rnd2()<0.22) R(wx2,wy2,1.6,2,'#e8b45a');
        }
        ctx.globalAlpha=1;
      }
      if(tiN===1&&Math.sin(env.t*2.6+ti)>0.3){
        ctx.globalAlpha=0.9; R(tx+149,hz-56,2,2,'#ff4a3a');
        ctx.globalAlpha=0.25; C(tx+150,hz-55,4,'#ff4a3a'); ctx.globalAlpha=1;
      }
      if(tiN===2&&Math.sin(env.t*3.4+ti*2)>0){
        ctx.globalAlpha=0.9; R(tx+299,hz-42,2,2,'#ff4a3a');
        ctx.globalAlpha=0.25; C(tx+300,hz-41,4,'#ff4a3a'); ctx.globalAlpha=1;
      }
    }
  });
  // metro train sliding along the horizon (screen-fixed, like the sun)
  var mtq=env.t%26;
  if(mtq<7){
    var mtp=mtq/7, mdir=(Math.floor(env.t/26)%2)?-1:1;
    var mx0=mdir>0? -80+mtp*(W+160) : W+80-mtp*(W+160);
    if(!glow){
      var mcar=css(mix(hx('#3d4a55'),hx('#141c26'),env.night));
      for(var mc=0;mc<5;mc++){
        var mcx=mx0+mc*13*mdir;
        R(mcx,hz-6,11,5,mcar);
        for(var mw=0;mw<3;mw++) R(mcx+2+mw*3,hz-5,2,2,env.night>0.3?'#ffd98a':'#dce8ee');
      }
    } else if(env.night>0.35){
      ctx.globalAlpha=0.35*env.night;
      for(var mc2=0;mc2<5;mc2++){
        var mcx2=mx0+mc2*13*mdir;
        for(var mw2=0;mw2<3;mw2++) R(mcx2+2+mw2*3,hz-5,2,2,'#ffd98a');
      }
      ctx.globalAlpha=1;
    }
  }
  // blimp cruising past (screen-fixed, very slow)
  if(!env.rainy){
    var bq=(env.t-20)%97;
    if(bq>=0&&bq<45){
      var bp=bq/45, bdir=(Math.floor((env.t-20)/97)%2)?-1:1;
      var bx=bdir>0? -60+bp*(W+120) : W+60-bp*(W+120);
      var by=vy+58+Math.sin(bp*Math.PI*3)*3; // below the hang-line papers, above the skyline
      if(!glow){
        ctx.save();ctx.translate(bx,by);ctx.scale(bdir,1);
        ctx.fillStyle='#d8dde4';ctx.beginPath();ctx.ellipse(0,0,17,6,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#9aa4b0';ctx.beginPath();ctx.ellipse(0,2,16,4,0,0,Math.PI);ctx.fill();
        ctx.strokeStyle='#4a5560';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.ellipse(0,0,17,6,0,0,Math.PI*2);ctx.stroke();
        R(-2,-8,10,2,'#8d97a3');
        poly([[-15,0],[-23,-6],[-23,5]],'#6b7581');
        R(-4,5,8,4,'#3f4650'); R(-2,6,4,2,'#ffd98a');
        ctx.restore();
        drawText(bx-8,by-3,'NEWS','#2c3947'); // unmirrored livery
      } else if(env.night>0.3&&Math.sin(env.t*5)>0){
        ctx.globalAlpha=0.8; R(bx+bdir*16-1,by-1,2,2,'#ff4a3a'); ctx.globalAlpha=1;
      }
    }
  }
  // fireworks over the city (clear nights)
  if(glow&&!env.rainy&&env.night>0.35){
    var fq=(env.t-3)%21;
    if(fq<1.6){
      var fseed=Math.floor((env.t-3)/21);
      var fx=W*0.1+pick(fseed,13,80)/100*W*0.8;
      var fy3=vy+10+pick(fseed,15,30);
      var fc=['#ff6a58','#ffd257','#7fd9a0','#8ec6ff','#e8a0ff'][pick(fseed,21,5)];
      if(fq<0.45){
        var rp=fq/0.45, ry2=hz-rp*(hz-fy3);
        ctx.globalAlpha=0.7; line(fx,ry2,fx,ry2+6,'#ffe9b0',1); ctx.globalAlpha=1;
      } else {
        var pr=(fq-0.45)/1.15;
        ctx.globalAlpha=(1-pr);
        for(var fr2=0;fr2<14;fr2++){
          var fa=fr2/14*Math.PI*2, frr=pr*27;
          R(fx+Math.cos(fa)*frr,fy3+Math.sin(fa)*frr*0.8+pr*pr*8,1.8,1.8,fc);
          if(pr>0.3) R(fx+Math.cos(fa)*frr*0.55,fy3+Math.sin(fa)*frr*0.44+pr*pr*8,1.3,1.3,'#fff3c9');
        }
        ctx.globalAlpha=1;
      }
    }
  }
  // birds (day only)
  if(!glow&&!env.rainy&&env.night<0.3){
    eachTile(480,120,env.bgV+env.t*10,function(tx,ti){
      var rnd=mulberry32((((ti%71)+71)%71)*43+1);
      if(rnd()<0.55){
        var by=vy+14+rnd()*30, bx3=tx+rnd()*300;
        for(var f2=0;f2<3;f2++){
          var fx=bx3+f2*7, fy2=by+((f2%2)*2), fl=Math.sin(env.t*9+f2)>0?0:1;
          line(fx-2,fy2+fl,fx,fy2-1,'#2c3947',1); line(fx,fy2-1,fx+2,fy2+fl,'#2c3947',1);
        }
      }
    });
  }
  // rain on the glass
  if(env.rainy&&!glow){
    ctx.globalAlpha=0.30;
    for(var r3=0;r3<22;r3++){
      var rxx=vx+((r3*37+env.t*140)%vw);
      var ryy=vy+((r3*61+env.t*300)%vh);
      line(rxx,ryy,rxx-2.5,ryy+9,'#c2d6e4',1);
    }
    ctx.globalAlpha=1;
  }
  // shooting star (rare, clear nights)
  if(glow&&!env.rainy&&env.night>0.55){
    var qq=env.t%47;
    if(qq<0.9){
      var pr=qq/0.9, seed=Math.floor(env.t/47);
      var sxx=vx+20+pick(seed,9,120), syy=vy+8+pick(seed,11,26);
      ctx.globalAlpha=(1-pr)*0.9;
      line(sxx+pr*54,syy+pr*20,sxx+pr*54-10,syy+pr*20-4,'#eaf2ff',1.5);
      ctx.globalAlpha=1;
    }
  }
}

function drawWindows(env){
  eachTile(PITCH,0,env.bgF,function(x,i){
    var shape=pick(i,53,2);
    ctx.save(); windowPath(x,shape); ctx.clip();
    drawViewContent(x,env,false);
    // glass tint + sheen
    ctx.globalAlpha=0.08; R(x-84,62,168,110,'#cfe4ee');
    ctx.globalAlpha=0.06; poly([[x-60,62],[x-20,62],[x-58,172],[x-84,172]],'#ffffff');
    ctx.globalAlpha=1;
    // muntins
    for(var mv=-60;mv<=60;mv+=24) R(x+mv-1,62,2,110,'#2c3a44');
    R(x-84,121,168,2,'#2c3a44'); R(x-84,145,168,2,'#2c3a44');
    R(x-84,98,168,2,'#2c3a44');
    if(shape===0){ line(x,100,x-52,76,'#2c3a44',2); line(x,100,x,66,'#2c3a44',2); line(x,100,x+52,76,'#2c3a44',2); }
    ctx.restore();
    // frame
    ctx.strokeStyle='#37444d'; ctx.lineWidth=5; windowPath(x,shape); ctx.stroke();
    ctx.strokeStyle='#232c33'; ctx.lineWidth=1; windowPath(x,shape); ctx.stroke();
    // sill
    R(x-92,170,184,5,'#57626a'); R(x-92,174,184,2,'#333c42'); R(x-92,176,184,1,'rgba(0,0,0,0.25)');
  });
}

/* ═══════════════════════════ WALL FEATURES ═══════════════════════════════ */

function typoSign(cx,env){
  line(cx-24,206,cx-28,177,'#5a5f66',1); line(cx+24,206,cx+28,177,'#5a5f66',1);
  R(cx-34,204,68,44,'#efece2');
  ctx.strokeStyle='#8f1d13';ctx.lineWidth=2;ctx.strokeRect(cx-32,206,64,40);
  drawText(cx-20,212,'DAYS SINCE','#33302a');
  drawText(cx-20,220,'LAST TYPO:','#33302a');
  ctx.save();ctx.translate(cx-4,229);ctx.scale(2.6,2.6);drawText(0,0,'0','#b3271b');ctx.restore();
}

function drawNeonText(cx,y,c1,c2,halo){
  function run(str,tx,ty,sc,col){
    ctx.save();ctx.translate(tx,ty);ctx.scale(sc,sc);
    if(halo){drawText(-0.5,0,str,col);drawText(0.5,0,str,col);drawText(0,-0.5,str,col);drawText(0,0.5,str,col);}
    else drawText(0,0,str,col);
    ctx.restore();
  }
  run('MARK ALFRED',cx-44,y+2,2,c1);
  run('DOT NEWS',cx-32,y+16,2,c2);
}
function neonSign(cx,env,glow){
  var y=206;
  var on=pick(Math.floor(env.t*1.6)+((cx|0)&1023),3,12)!==0;
  var c1=on?'#ff6a58':'#5f2620', c2=on?'#ffb84a':'#5f4620';
  if(glow){
    if(!on) return;
    ctx.globalAlpha=0.35*Math.max(0.25,env.night);
    drawNeonText(cx,y,c1,c2,true); ctx.globalAlpha=1; return;
  }
  R(cx-52,y-6,104,42,'#171b20');
  ctx.strokeStyle='#0e1116';ctx.lineWidth=2;ctx.strokeRect(cx-52,y-6,104,42);
  R(cx-50,y-4,2,2,'#5a5f66');R(cx+48,y-4,2,2,'#5a5f66');R(cx-50,y+32,2,2,'#5a5f66');R(cx+48,y+32,2,2,'#5a5f66');
  drawNeonText(cx,y,c1,c2,false);
}

function officeCabin(cx,env,glow){
  var top=254, deck=308;
  if(glow){
    ctx.globalAlpha=0.40*env.night; R(cx-26,top+12,44,26,'#f2d49a');
    ctx.globalAlpha=0.70*env.night; C(cx+17,top+23,3,'#ffe9a8');
    ctx.globalAlpha=1; return;
  }
  R(cx-40,top-6,80,6,'#23272c');                 // roof
  R(cx-36,top,72,deck-top,'#3b4046'); R(cx-36,top,72,2,'#4a5058');
  R(cx-26,top+12,44,26,'#f0d09a'); R(cx-26,top+12,44,3,'#f7e3bd'); // lit window
  R(cx-22,top+30,36,3,'#41464d');                // desk
  R(cx-6,top+22,9,7,'#41464d'); R(cx-5,top+23,7,5,'#bcd9e6');      // monitor
  var bob=Math.sin(env.p*Math.PI*4)*1;
  R(cx-16,top+24+bob,6,8,'#41464d'); R(cx-15,top+20+bob,4,4,'#41464d'); // editor
  line(cx+14,top+30,cx+17,top+24,'#41464d',1.5); C(cx+17,top+23,1.6,'#ffe9a8'); // lamp
  R(cx+4,top+27,7,3,'#e8e4d8');                  // papers
  ctx.strokeStyle='#23272c';ctx.lineWidth=2;ctx.strokeRect(cx-26,top+12,44,26);
  R(cx-2,top+12,2,26,'#23272c');
  R(cx+24,top+16,11,38,'#2c3036'); R(cx+26,top+34,2,2,'#8a8f96');   // door
  R(cx-14,top+2,28,8,'#10141a'); drawText(cx-12,top+3,'EDITOR','#e8e4d8');
}

function drawTicker(cx,env,glow){
  var y=214,w=92,h=15;
  var msg='MARK ALFRED DOT NEWS  ';
  var tw=msg.length*4*1.6;
  var off=(env.t*26)%tw;
  if(!glow){
    R(cx-w/2-3,y-3,w+6,h+6,'#14171c');
    ctx.strokeStyle='#2c3138';ctx.lineWidth=1;ctx.strokeRect(cx-w/2-2.5,y-2.5,w+5,h+5);
    R(cx-w/2,y,w,h,'#1d0f0f');
  }
  ctx.save(); ctx.beginPath(); ctx.rect(cx-w/2,y,w,h); ctx.clip();
  ctx.translate(cx-w/2-off,y+3); ctx.scale(1.6,1.6);
  if(glow) ctx.globalAlpha=0.5*Math.max(0.3,env.night);
  drawText(0,0,msg+msg,glow?'#ff5a3a':'#e03a22');
  ctx.restore(); ctx.globalAlpha=1;
}

// v: 0 stencil / 1 clock / 2 bulletin / 3 fans / 4 typo sign / 5 neon / 6 office / 7 ticker
function drawWallFeature(cx,v,env,glow){
  if(glow){
    if(v===5) neonSign(cx,env,true);
    else if(v===6) officeCabin(cx,env,true);
    else if(v===7) drawTicker(cx,env,true);
    return;
  }
  var p=env.p;
  if(v===0){
    ctx.save();ctx.globalAlpha=0.07;ctx.translate(cx-97,212);ctx.scale(4.4,4.4);
    drawText(0,0,'MARK ALFRED',COL.ink);ctx.restore();ctx.globalAlpha=1;
  } else if(v===1){
    var cy=224;
    C(cx,cy,16,'#e8e6dc');
    ctx.strokeStyle='#2b3036';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,16,0,Math.PI*2);ctx.stroke();
    for(var h=0;h<12;h++){var a=h/12*Math.PI*2;R(cx+Math.cos(a)*13-0.5,cy+Math.sin(a)*13-0.5,1,1,'#2b3036');}
    var mm=p*Math.PI*2, hh=p*Math.PI*2/6;
    line(cx,cy,cx+Math.cos(mm-Math.PI/2)*12,cy+Math.sin(mm-Math.PI/2)*12,'#2b3036',1.5);
    line(cx,cy,cx+Math.cos(hh-Math.PI/2)*7,cy+Math.sin(hh-Math.PI/2)*7,COL.red,2);
    C(cx,cy,1.5,'#2b3036');
  } else if(v===2){
    var bx=cx-42, by=204;
    R(bx,by,84,46,'#6b5a3f'); R(bx+3,by+3,78,40,'#947c55');
    var rnd=mulberry32(97*11), cols=['#e7e2d4','#cdb79c','#b3271b','#7fa6b2','#d9b23a'];
    for(var i=0;i<9;i++){var nx=bx+7+rnd()*66,ny=by+6+rnd()*30;R(nx,ny,12,9,cols[i%5]);R(nx,ny,12,1,'rgba(0,0,0,0.18)');R(nx+5,ny-1,2,2,'#8a8a8a');}
    ctx.strokeStyle='#4a3f2a';ctx.lineWidth=1;ctx.strokeRect(bx,by,84,46);
  } else if(v===3){
    [-40,40].forEach(function(dx,fi2){
      var fx=cx+dx, fy=228, dir=(fi2?1:-1);
      R(fx-16,fy-16,32,32,'#41474d'); R(fx-16,fy-16,32,2,'#565d64');
      C(fx,fy,13,'#20252b');
      ctx.save();ctx.translate(fx,fy);ctx.rotate(p*Math.PI*2*7*dir);
      for(var b=0;b<4;b++){ctx.rotate(Math.PI/2);poly([[0,0],[12,-4],[13,3]],'#5b636b');}
      ctx.restore();
      C(fx,fy,2.6,'#868d93');
      ctx.strokeStyle='#2b3036';ctx.lineWidth=1;ctx.strokeRect(fx-16,fy-16,32,32);
    });
  } else if(v===4){ typoSign(cx,env); }
  else if(v===5){ neonSign(cx,env,false); }
  else if(v===6){ officeCabin(cx,env,false); }
  else { drawTicker(cx,env,false); }
}

/* ═══════════════════════════ WAREHOUSE SHELL ═════════════════════════════ */

function drawWarehouse(env){
  var F=FLOOR_START, bg=env.bgF, p=env.p;
  // corrugated wall
  R(0,0,W,F,COL.wall);
  eachTile(8,0,bg,function(x){R(x,30,1,F-30,COL.wallHi);R(x+4,30,1,F-30,COL.wallLo);});

  // roof + skylights + trusses
  R(0,0,W,30,COL.roofDark);
  eachTile(6,0,bg,function(x){R(x,0,3,30,'#343940');});
  eachTile(132,64,bg,function(x){
    R(x,5,40,18,'#1d2126'); R(x+2,7,36,14,env.skyTopCss); R(x+19,7,2,14,'#1d2126');
    ctx.globalAlpha=0.18; R(x+4,8,10,12,'#ffffff'); ctx.globalAlpha=1;
  });
  line(0,32,W,32,COL.trussDark,2);
  eachTile(32,0,bg,function(x){line(x,32,x+16,10,COL.truss,1.5);line(x+32,32,x+16,10,COL.truss,1.5);line(x+16,10,x+16,32,COL.trussDark,1);});
  line(0,10,W,10,COL.truss,2);
  R(0,16,W,3,COL.steelMid); R(0,22,W,2,COL.steelDark);
  eachTile(40,12,bg,function(x){R(x,14,2,10,COL.steelDark);});
  // ceiling duct
  R(0,25,W,5,'#464c54'); R(0,25,W,1,'#5c636c'); R(0,29,W,1,'#2c3138');
  eachTile(22,6,bg,function(x){R(x,25,2,5,'#30353c');});

  // steel columns + sconces + beacons
  eachTile(PITCH,PITCH*0.5,bg,function(cx0,i){
    R(cx0-4,32,8,F-32,'#b7bab7'); R(cx0-4,32,2,F-32,'#cdd0cd'); R(cx0+2,32,2,F-32,'#9a9e9b');
    R(cx0-8,F-6,16,6,COL.steelMid); R(cx0-8,F-6,16,1,COL.steelLight);
    for(var by=80;by<F-24;by+=54) R(cx0-4,by,8,3,'#8f938f');
    if(pick(i,19,2)===0){ // downlight sconce
      R(cx0-5,332,10,4,'#39424a'); R(cx0-3,336,6,2,'#20242a');
      fadePoly([[cx0-14,338],[cx0+14,338],[cx0+26,436],[cx0-26,436]],338,436,'255,233,184',0.06);
    }
    if(pick(i,43,4)===0){ // amber beacon
      R(cx0-5,210,10,3,'#39424a');
      C(cx0,208,3,Math.sin(env.t*2.2+i)>0?'#e8a020':'#8a6414');
    }
  });

  // the big windows with the view
  drawWindows(env);

  // pennant banners
  ctx.strokeStyle=COL.steelDark;ctx.lineWidth=1;ctx.beginPath();
  for(var sx=0;sx<=W;sx+=6){var yy=188+Math.sin((sx+bg)*0.03)*4;if(sx===0)ctx.moveTo(sx,yy);else ctx.lineTo(sx,yy);}
  ctx.stroke();
  var BCOLS=['#b3271b','#d9b23a','#2f6273','#356b52','#e7e2d4'];
  eachTile(22,0,bg,function(x,i){
    var yy=188+Math.sin((x+bg)*0.03)*4;
    poly([[x-6,yy],[x+6,yy],[x,yy+11]],BCOLS[((i%5)+5)%5]);
    R(x-6,yy-1,12,1,'rgba(0,0,0,0.2)');
  });

  // gantry cranes every 3 bays, riding the ceiling rail
  eachTile(PITCH*3,PITCH*1.5,bg,function(x,i){drawGantry(x,p,i,env);});

  // varied wall feature per bay (under the windows)
  eachTile(PITCH,0,bg,function(x,i){drawWallFeature(x,pick(i,7,8),env,false);});

  // second conduit run
  R(0,268,W,3,COL.steelLight); R(0,271,W,2,COL.steelDark);
  eachTile(72,24,bg,function(x){R(x,266,3,8,COL.steelMid);});

  // fluorescent fixtures
  eachTile(100,34,bg,function(x,i){
    line(x+6,32,x+6,43,COL.steelDark,1);
    line(x+38,32,x+38,43,COL.steelDark,1);
    R(x,43,44,3,COL.steelDark);
    var flick=((((i%3)+3)%3)===1)?0.72+0.28*Math.abs(Math.sin(Math.PI*p*26+i)):1;
    ctx.globalAlpha=flick; R(x+1,46,42,3,COL.tube);
    ctx.globalAlpha=1;
    fadePoly([[x+1,49],[x+43,49],[x+64,196],[x-20,196]],49,196,'238,244,230',0.09*flick);
  });

  // EXIT doors — up on the mezzanine level so the presses never occlude them
  eachTile(PITCH,70,bg,function(x,i){
    if(pick(i,41,5)!==0) return;
    var dy=308; // opens onto the catwalk deck
    R(x-13,dy-46,26,46,'#333940');
    ctx.strokeStyle='#22272c';ctx.lineWidth=2;ctx.strokeRect(x-11,dy-44,22,44);
    R(x-8,dy-38,16,14,'#3d444b'); R(x-8,dy-20,16,14,'#3d444b');
    R(x+6,dy-24,2,4,'#8a8f96'); R(x-11,dy-8,22,4,'#4a5057');
    R(x-14,dy-58,28,10,'#0d1f12');
    drawText(x-8,dy-56,'EXIT','#67e28a');
  });

  // electrical/control boxes
  eachTile(PITCH,110,bg,function(x){
    var ey=F-84;
    R(x-11,ey,22,28,'#3c4a3f'); R(x-11,ey,22,2,'#54644f');
    R(x-8,ey+4,16,12,'#8fae7e'); R(x-7,ey+19,5,5,COL.red); R(x+2,ey+19,5,5,'#d9b23a');
    R(x-11,ey,1,28,'#2a332b'); R(x+10,ey,1,28,'#2a332b');
  });

  // mouse hole + peeking mouse
  eachTile(PITCH,40,bg,function(x,i){
    if(pick(i,29,9)!==0) return;
    ctx.fillStyle='#14161a';ctx.beginPath();ctx.arc(x,F,4.5,Math.PI,0);ctx.fill();
    var q=((env.p+((((i%9)+9)%9)*0.11))%1);
    if(q<0.28){
      var o=Math.sin(Math.PI*q/0.28)*7;
      var mx2=x+o;
      line(x,F-1,mx2-2,F-1,'#8d9298',1);          // tail
      R(mx2-2,F-4,5,3,'#8d9298'); R(mx2+2,F-5,3,3,'#9aa0a5'); // body+head
      R(mx2+3,F-6,1.5,1.5,'#9aa0a5');              // ear
      R(mx2+4,F-4,1,1,'#16130c');                  // eye
      if(Math.sin(env.t*20)>0.3) R(mx2+5.5,F-3,1,1,'#d98a8a'); // nose twitch
    }
  });

  // floor
  var fg=ctx.createLinearGradient(0,F,0,H);
  fg.addColorStop(0,COL.floorFar); fg.addColorStop(1,COL.floorNear);
  ctx.fillStyle=fg; ctx.fillRect(0,F,W,H-F);
  R(0,F,W,2,COL.steelDark);
  var py=F+6,gap=5;
  while(py<H){ctx.globalAlpha=0.35;R(0,py,W,1,COL.floorLine);ctx.globalAlpha=1;gap+=2.4;py+=gap;}
  // pools of light under the fixtures
  eachTile(100,56,bg,function(x){
    ctx.save();ctx.translate(x,506);ctx.scale(1,0.24);
    ctx.globalAlpha=0.045; C(0,0,46,'#fff3cf');
    ctx.restore();
  });
  ctx.globalAlpha=1;

  // dust motes
  var motes=Math.ceil(W/24);
  for(var i2=0;i2<motes;i2++){
    var ph=(p*2+i2*0.37)%1;
    var mx=(i2*53)%W+5*Math.sin(Math.PI*2*(p*3+i2*0.21));
    var my=(F-12)-ph*220;
    ctx.globalAlpha=Math.max(0,0.4*(1-ph));
    R(mx,my,1,1,'#e8e4d8');
  }
  ctx.globalAlpha=1;
}

function drawGantry(cx,p,i,env){
  R(cx-70,32,3,156,COL.steelDark); R(cx+67,32,3,156,COL.steelDark);
  R(cx-72,186,144,10,COL.steelMid); R(cx-72,186,144,2,COL.steelHi); R(cx-72,194,144,2,COL.steelDark);
  var tx=cx+Math.sin(Math.PI*2*p+i)*48;
  R(tx-9,186,18,8,COL.steelDark); R(tx-9,186,18,2,COL.steelLight);
  var hang=48+Math.sin(Math.PI*2*p*0.5+i)*8;
  line(tx-4,194,tx-4,194+hang,COL.steelDark,1); line(tx+4,194,tx+4,194+hang,COL.steelDark,1);
  R(tx-3,194+hang,6,4,COL.steelDark);
  var ry=194+hang+18;
  shadedDisc(tx,ry,15,COL.paper2,'#fffdf8',COL.ruleSoft);
  for(var rr=12;rr>3;rr-=3){ctx.strokeStyle='rgba(120,112,92,0.3)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(tx,ry,rr,0,Math.PI*2);ctx.stroke();}
  C(tx,ry,3,'#8a836f');
}

// ── mezzanine catwalk + patrol + pigeons ─────────────────────────────────────
function drawPigeon(x,y,env,i){
  var bob=Math.sin(env.t*4+(i||0))*0.6;
  R(x-3,y-4+bob*0.3,6,4,'#6b6f73'); R(x-3,y-4+bob*0.3,6,1,'#84898d');
  R(x+2,y-4+bob,3,3,'#3a3d40'); R(x+5,y-3+bob,1,1,COL.red);
  R(x-2,y,1,1,'#c9432f'); R(x+1,y,1,1,'#c9432f');
}
function drawPatrol(env){
  var span=W+80;
  var x=W+40-((env.t*17)%span);
  var y=308, st=Math.sin(env.t*7);
  ctx.save();ctx.translate(x,y);
  R(-3+st*1.5,-9,2,9,'#25303a'); R(1-st*1.5,-9,2,9,'#25303a');
  R(-4,-20,8,12,'#6b4f3a'); R(-4,-20,8,2,'#7d5f47');
  R(-3,-27,6,7,'#caa27a'); R(-4,-28,8,3,'#e8e4d8');
  R(3,-18,9,6,COL.paper2); R(3,-18,9,1.4,COL.red);
  line(2,-17,3,-13,'#6b4f3a',2);
  ctx.restore();
}
function drawCatwalk(env){
  var bg=env.bgF, cy=308, F=FLOOR_START;
  eachTile(PITCH*0.5,PITCH*0.25,bg,function(x){
    R(x,cy+5,3,F-(cy+5),COL.steelMid); R(x,cy+5,1,F-(cy+5),COL.steelHi);
  });
  R(0,cy,W,4,COL.steelLight); R(0,cy+4,W,2,COL.steelMid); R(0,cy+6,W,1,COL.steelDark);
  eachTile(10,4,bg,function(x){R(x,cy+1,1,3,COL.steelMid);});
  line(0,cy-11,W,cy-11,COL.steelLight,1.5);
  line(0,cy-6,W,cy-6,COL.steelMid,1);
  eachTile(20,8,bg,function(x){line(x,cy-11,x,cy,COL.steelMid,1);});
  eachTile(PITCH,0,bg,function(x,i){
    var pv=pick(i,11,6);
    if(pv===0) drawPigeon(x+34,cy-11,env,i);
    if(pv===3){ drawPigeon(x-60,cy-11,env,i); drawPigeon(x-49,cy-11,env,i+5); }
  });
  drawPatrol(env);
}

// ── overhead hanging conveyor ────────────────────────────────────────────────
var HANG_SPACING=26, HANG_ADV=8;
var HANG_ADV_PX=HANG_SPACING*HANG_ADV;
function hangY(worldX){return 80+Math.sin(worldX*0.011)*12;}
function drawHangLine(p){
  ctx.strokeStyle=COL.steelDark;ctx.lineWidth=3;ctx.beginPath();
  for(var sx=0;sx<=W;sx+=6){var yy=hangY(sx+scrollX);if(sx===0)ctx.moveTo(sx,yy);else ctx.lineTo(sx,yy);}
  ctx.stroke();
  var conv=p*HANG_ADV_PX;
  eachTile(HANG_SPACING,0,scrollX+conv,function(x,i){
    var yy=hangY(x+scrollX);
    var m=((i%8)+8)%8;
    var sway=Math.sin(Math.PI*2*(p*3)+m)*2.5;
    line(x,yy,x+sway*0.4,yy+7,COL.steelDark,1);
    R(x+sway*0.4-1.5,yy+6,3,3,COL.steelMid);
    ctx.save();ctx.translate(x+sway*0.4,yy+9);ctx.rotate(sway*0.03);
    frontPage(-6,0,12,16,m*991+7,0);
    ctx.restore();
  });
}

/* ═══════════════════════════ THE PRESS LINE ══════════════════════════════ */

var ROLL={x:56,y:226,r:26};
var IDL1={x:96,y:132,r:5}, IDL2={x:146,y:124,r:5};
var DRUM_L={x:136,y:172,r:14}, DRUM_R={x:168,y:172,r:14};
var NIPX=152, FOLD={x:152,y:214};
var WEB_PTS=[[ROLL.x+8,ROLL.y-ROLL.r+2],[IDL1.x,IDL1.y-6],[IDL2.x,IDL2.y-6],[NIPX,DRUM_L.y],[FOLD.x,FOLD.y-4]];
function strokePath(pts){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();}

function drawPaperRollUnit(p){
  ctx.save();ctx.translate(ROLL.x,ROLL.y+ROLL.r*0.6);ctx.scale(1,0.3);ctx.globalAlpha=0.45;C(0,0,ROLL.r*1.1,'#000');ctx.restore();ctx.globalAlpha=1;
  R(ROLL.x-3,ROLL.y+ROLL.r-4,5,28,COL.steelDark);
  R(ROLL.x-14,ROLL.y+ROLL.r+22,30,4,COL.steelDark);
  shadedDisc(ROLL.x,ROLL.y,ROLL.r,COL.paper2,'#fffdf8',COL.ruleSoft);
  for(var rr=ROLL.r-3;rr>4;rr-=3){ctx.strokeStyle='rgba(120,112,92,0.3)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(ROLL.x,ROLL.y,rr,0,Math.PI*2);ctx.stroke();}
  roller(ROLL.x,ROLL.y,6,-4,p);
}

var PRESS_PALS=[
  {body:COL.teal,  hi:COL.tealHi, lo:COL.tealLo, deep:COL.tealDeep},
  {body:'#3a4653', hi:'#5f7183',  lo:'#28313b',  deep:'#171d24'},
  {body:'#356b52', hi:'#57937a',  lo:'#214736',  deep:'#122b20'},
  {body:'#7a4a3a', hi:'#a56b52',  lo:'#53301f',  deep:'#301a10'}
];
function pressBody(p,pal){
  pal=pal||PRESS_PALS[0];
  ctx.save();ctx.translate(150,250);ctx.scale(1,0.26);ctx.globalAlpha=0.4;C(0,0,66,'#000');ctx.restore();ctx.globalAlpha=1;
  isoBox(104,140,96,106,16,pal.body,pal.hi,pal.lo);
  isoBox(112,112,74,28,12,pal.body,pal.hi,pal.lo);
  for(var s=0;s<3;s++) R(112+s*30,196,1,44,'rgba(10,30,36,0.35)');
  for(var rv=0;rv<5;rv++){R(110+rv*20,143,2,2,COL.brass);R(110+rv*20,240,2,2,COL.brass);}
  for(var v=0;v<3;v++) R(126+v*22,198,14,3,pal.deep);
  shadedDisc(122,126,6,'#e8e6dc','#ffffff','#b8b4a6');
  var ga=Math.PI*0.75+0.5*Math.sin(Math.PI*2*p*5);
  line(122,126,122+Math.cos(ga)*4.5,126+Math.sin(ga)*4.5,COL.redDark,1);
  shadedDisc(138,126,6,'#e8e6dc','#ffffff','#b8b4a6');
  line(138,126,138+Math.cos(Math.PI*1.2)*4.5,126+Math.sin(Math.PI*1.2)*4.5,COL.inkSoft,1);
  var bl=0.5+0.5*Math.sin(Math.PI*2*p*6);
  ctx.globalAlpha=0.5+0.5*bl; shadedDisc(178,120,2.6,COL.red,'#ff9b8e',COL.redDark); ctx.globalAlpha=1;
  shadedDisc(178,128,2.6,COL.green,'#a9e2b2','#2e6b3c');
  R(114,228,52,9,pal.deep);
  drawText(117,230,'MARK ALFRED','#e8e4d8');
  R(122,158,60,32,pal.deep);
  ctx.strokeStyle=pal.lo;ctx.lineWidth=1;ctx.strokeRect(122.5,158.5,59,31);
}

function drawWeb(p){
  ctx.lineCap='round';
  ctx.strokeStyle=COL.webShade; ctx.lineWidth=7; strokePath(WEB_PTS);
  ctx.strokeStyle=COL.webPaper; ctx.lineWidth=5; strokePath(WEB_PTS);
  ctx.strokeStyle='rgba(120,110,88,0.5)'; ctx.lineWidth=5;
  ctx.setLineDash([2,14]); ctx.lineDashOffset=-(p*160);
  strokePath(WEB_PTS); ctx.setLineDash([]);
  ctx.strokeStyle=COL.red; ctx.lineWidth=5;
  ctx.setLineDash([2,14]); ctx.lineDashOffset=-(p*160);
  strokePath([[NIPX,DRUM_L.y+10],[FOLD.x,FOLD.y-4]]);
  ctx.setLineDash([]);
}

var steamPhases=[0,0.17,0.34,0.5,0.67,0.84];
function pressMech(p){
  roller(DRUM_L.x,DRUM_L.y,DRUM_L.r,6,p,'#3d4750','#707a85','#1c2126');
  roller(DRUM_R.x,DRUM_R.y,DRUM_R.r,-6,p,'#3d4750','#707a85','#1c2126');
  line(IDL1.x,IDL1.y,112,124,COL.steelMid,2);
  roller(IDL1.x,IDL1.y,IDL1.r,12,p);
  roller(IDL2.x,IDL2.y,IDL2.r,-12,p);
  poly([[138,206],[166,206],[152,222]],COL.steelMid);
  poly([[138,206],[152,222],[150,222],[138,208]],COL.steelHi);
  R(168,102,6,12,COL.steelMid); R(168,102,2,12,COL.steelHi);
  steamPhases.forEach(function(sp,i){
    var age=((p-sp)%1+1)%1, lifeFrac=0.16;
    if(age<lifeFrac){var a2=age/lifeFrac;
      ctx.globalAlpha=(1-a2)*0.32;
      C(171-a2*8+(i%2?2:-2),100-a2*26,2+a2*5,'#e4e0d4');
      ctx.globalAlpha=1;}
  });
}

function drawBelt(p){
  R(160,258,4,34,COL.steelDark); R(310,258,4,34,COL.steelDark);
  isoBox(150,250,176,12,6,'#2b2e33','#4a4e55','#1b1e22');
  ctx.setLineDash([5,5]); ctx.lineDashOffset=-(p*160);
  line(150,251,326,251,COL.steelLight,1.5);
  ctx.setLineDash([]);
  roller(154,256,5,10,p); roller(320,256,5,10,p);
}

var STREAM_PATH=[[152,216],[196,248],[330,248]];
var STREAM_LEN=pathLen(STREAM_PATH);
var ST_SPACING=9, ST_ADV=16;
function drawStream(p,seedOff){
  seedOff=seedOff||0;
  var offset=p*ST_SPACING*ST_ADV;
  var count=Math.ceil(STREAM_LEN/ST_SPACING)+1;
  var items=[];
  for(var a=0;a<count;a++) items.push({s:(a*ST_SPACING+offset)%STREAM_LEN, seed:((a%8)*577+3)^(seedOff*131)});
  items.sort(function(m,n){return n.s-m.s;});
  items.forEach(function(it){
    var pt=pathPoint(STREAM_PATH,it.s);
    ctx.save();ctx.translate(pt.x,pt.y);ctx.rotate(pt.ang*0.55);
    frontPage(-10,-24,20,26,it.seed,1);
    ctx.restore();
  });
}

function drawBundles(seed){
  var rnd=mulberry32((seed||0)*29+7);
  ctx.save();ctx.translate(282,302);ctx.scale(1,0.32);ctx.globalAlpha=0.4;C(0,0,42,'#000');ctx.restore();ctx.globalAlpha=1;
  function bundle(bx,by,w2,layers){
    for(var i=0;i<layers;i++){
      var yy=by-i*3;
      R(bx,yy-3,w2,3,i%2?COL.paper2:'#e6e2d4');
      R(bx,yy-3,w2,1,'rgba(120,112,92,0.35)');
    }
    R(bx,by-layers*3-4,w2,4,COL.paper);
    R(bx,by-layers*3-4,w2,1.5,COL.red);
    R(bx+w2*0.45,by-layers*3-4,2,layers*3+4,'#8f8a3a');
    ctx.strokeStyle=COL.inkSoft;ctx.lineWidth=0.5;ctx.strokeRect(bx+0.5,by-layers*3-3.5,w2-1,layers*3+3);
  }
  bundle(256,300,34,5+Math.floor(rnd()*5));
  bundle(294,304,34,6+Math.floor(rnd()*5));
  bundle(274,312,36,4+Math.floor(rnd()*4));
}

function drawBackPress(p,pal){
  pal=pal||PRESS_PALS[0];
  R(206,96,7,150,COL.steelMid); R(206,96,2,150,COL.steelHi);
  for(var i=0;i<5;i++) R(206,226+i*4,7,2,i%2?'#d9b23a':'#23262b');
  isoBox(216,150,86,72,10,pal.lo,pal.body,pal.deep);
  R(222,158,74,4,pal.body);
  R(230,176,58,26,pal.deep);
  roller(244,189,10,8,p,'#3d4750','#6b7680','#20262c');
  roller(272,189,10,-8,p,'#3d4750','#6b7680','#20262c');
  R(230,187,58,4,COL.webShade);
  for(var v=0;v<3;v++) R(226+v*24,208,16,3,'#12262d');
  var bl=0.5+0.5*Math.sin(Math.PI*2*p*4);
  ctx.globalAlpha=0.4+0.6*bl; C(294,158,2.4,COL.green); ctx.globalAlpha=1;
}

// per-press variety: ladder / operator at the panel / number plate
function drawPressExtras(i,pk,env){
  var v=pick(i,13,3);
  if(v===0){
    R(203,152,2,92,'#39424a'); R(211,152,2,92,'#39424a');
    for(var y2=158;y2<242;y2+=9) R(203,y2,10,2,'#4c565f');
  } else if(v===1){
    var ox=96,oy=248;
    ctx.save();ctx.translate(ox,oy);ctx.scale(1,0.3);ctx.globalAlpha=0.3;C(0,0,7,'#000');ctx.restore();ctx.globalAlpha=1;
    R(ox-3,oy-9,2,9,'#25303a'); R(ox+1,oy-9,2,9,'#25303a');
    R(ox-4,oy-20,8,12,'#7a4a3a'); R(ox-3,oy-27,6,7,'#caa27a');
    R(ox-4,oy-28,8,3,'#3d7d90');
    line(ox+3,oy-18,ox+10,oy-21+Math.sin(env.t*5+i)*1.5,'#7a4a3a',2);
  } else {
    R(168,148,22,11,'#0d232c');
    ctx.strokeStyle='#39555f';ctx.lineWidth=1;ctx.strokeRect(168.5,148.5,21,10);
    drawText(173,151,'P'+(pick(i,17,4)+1),'#e8e4d8');
  }
}

// ── maintenance welder (sparks fly) ─────────────────────────────────────────
function drawWelder(env,i,glow){
  var on=Math.sin(env.t*3.1+i)>0.15 && Math.sin(env.t*17+i*2.7)>-0.55;
  var x=298,y=246;
  if(glow){
    if(on){
      ctx.globalAlpha=0.45; C(x-8,y-22,7,'#bfe0ff');
      ctx.globalAlpha=0.20; C(x-8,y-22,15,'#8ec6ff'); ctx.globalAlpha=1;
    }
    return;
  }
  ctx.save();ctx.translate(x,y);ctx.scale(1,0.3);ctx.globalAlpha=0.3;C(0,0,8,'#000');ctx.restore();ctx.globalAlpha=1;
  R(x-6,y-5,5,5,'#25303a'); R(x+3,y-5,5,5,'#25303a');
  R(x-4,y-14,9,9,'#5a5f66');
  R(x-2,y-20,7,7,'#3a3f45'); R(x+3,y-19,3,4,'#20343f');
  line(x-3,y-12,x-9,y-19,'#5a5f66',2);
  line(x-9,y-19,x-8,y-22,'#8a8f96',1.5);
  if(on){
    C(x-8,y-22,2.2,'#eaf6ff'); C(x-8,y-22,1,'#ffffff');
    for(var s2=0;s2<6;s2++){
      var q2=((env.t*2.6)+s2*0.17+i*0.05)%1;
      var sdir=(s2%2?1:-1)*(0.4+s2*0.12);
      ctx.globalAlpha=(1-q2);
      R(x-8+sdir*q2*16,y-22+q2*q2*26,1.4,1.4,s2%3?'#ffd257':'#ff9a3d');
    }
    ctx.globalAlpha=1;
  }
}

/* ═══════════════════════════ FLOOR PROPS ═════════════════════════════════ */

function spareReel(cx,floorY){
  ctx.save();ctx.translate(cx,floorY);ctx.scale(1,0.3);ctx.globalAlpha=0.35;C(0,0,15,'#000');ctx.restore();ctx.globalAlpha=1;
  R(cx-13,floorY-46,26,46,COL.paper2);
  R(cx-13,floorY-46,4,46,'#fffdf8');
  R(cx+8,floorY-46,5,46,COL.ruleSoft);
  ctx.save();ctx.translate(cx,floorY-46);ctx.scale(1,0.34);C(0,0,13,'#efece2');
  ctx.strokeStyle=COL.ruleSoft;ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.stroke();
  C(0,0,3.5,'#8a836f');ctx.restore();
  ctx.strokeStyle='rgba(120,112,92,0.3)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(cx-13,floorY-24);ctx.lineTo(cx+13,floorY-24);ctx.stroke();
}
function inkBarrel(cx,floorY,body,rim){
  ctx.save();ctx.translate(cx,floorY);ctx.scale(1,0.3);ctx.globalAlpha=0.35;C(0,0,9,'#000');ctx.restore();ctx.globalAlpha=1;
  R(cx-8,floorY-24,16,24,body);
  R(cx-8,floorY-24,3,24,'rgba(255,255,255,0.22)');
  R(cx+5,floorY-24,3,24,'rgba(0,0,0,0.3)');
  R(cx-8,floorY-20,16,2,'rgba(0,0,0,0.32)');
  R(cx-8,floorY-8,16,2,'rgba(0,0,0,0.32)');
  ctx.save();ctx.translate(cx,floorY-24);ctx.scale(1,0.34);C(0,0,8,rim);ctx.restore();
}
function crateStack(cx,fy){
  ctx.save();ctx.translate(cx,fy);ctx.scale(1,0.3);ctx.globalAlpha=0.34;C(0,0,26,'#000');ctx.restore();ctx.globalAlpha=1;
  function crate(x,y,w,h){
    R(x,y,w,h,'#7a5a34'); R(x,y,w,2,'#8f6d42'); R(x,y,2,h,'#8f6d42');
    R(x+w-2,y,2,h,'#5f4526'); R(x,y+h-2,w,2,'#5f4526');
    R(x+2,y+h*0.5,w-4,1,'#5f4526'); R(x+w*0.5-0.5,y+2,1,h-4,'#5f4526');
    ctx.strokeStyle='#4a3720';ctx.lineWidth=0.5;ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  }
  crate(cx-24,fy-20,24,20); crate(cx+1,fy-22,24,22); crate(cx-13,fy-40,26,20);
}
function paperPallet(cx,fy){
  ctx.save();ctx.translate(cx,fy);ctx.scale(1,0.3);ctx.globalAlpha=0.34;C(0,0,32,'#000');ctx.restore();ctx.globalAlpha=1;
  R(cx-30,fy-6,60,6,'#6b4f2c'); for(var i=0;i<4;i++) R(cx-30+i*18,fy-6,3,6,'#4a3720');
  R(cx-30,fy-8,60,2,'#7a5a34');
  function stack(x,layers){
    for(var j=0;j<layers;j++){var yy=fy-8-j*4;R(x,yy-4,26,4,j%2?COL.paper2:'#e6e2d4');R(x,yy-4,26,1,'rgba(120,112,92,0.4)');}
    R(x,fy-8-layers*4,26,1.5,COL.red);
  }
  stack(cx-28,6); stack(cx+2,7);
}
function handTruck(cx,fy){
  ctx.save();ctx.translate(cx,fy);ctx.scale(1,0.3);ctx.globalAlpha=0.3;C(2,0,16,'#000');ctx.restore();ctx.globalAlpha=1;
  ctx.save();ctx.translate(cx,fy);ctx.rotate(-0.12);
  R(-2,-44,3,44,COL.steelMid); R(9,-44,3,44,COL.steelMid);
  R(-4,-2,18,3,COL.steelDark);
  for(var i=0;i<7;i++){R(-2,-40+i*4,22,4,i%2?COL.paper:COL.paper2);R(-2,-40+i*4,22,1,'rgba(120,112,92,0.35)');}
  R(-2,-40,22,2,COL.red);
  C(-2,-1,4,'#20252b'); C(-2,-1,1.4,'#5a6068');
  ctx.restore();
}
function worker(cx,fy,p,seed){
  var t=Math.PI*2*p*2+seed;
  var bob=Math.abs(Math.sin(t))*1.4;
  var arm=Math.sin(t)*2.2;
  ctx.save();ctx.translate(cx,fy);ctx.scale(1,0.3);ctx.globalAlpha=0.3;C(0,0,7,'#000');ctx.restore();ctx.globalAlpha=1;
  var y=fy-bob;
  R(cx-3,y-9,2,9,'#25303a'); R(cx+1,y-9,2,9,'#25303a');
  R(cx-4,y-2,3,2,'#161616'); R(cx+1,y-2,3,2,'#161616');
  R(cx-4,y-20,8,12,'#2f6273'); R(cx-4,y-20,8,2,'#3d7d90');
  R(cx-6,y-19+arm,2,8,'#2f6273'); R(cx+4,y-19-arm,2,8,'#2f6273');
  R(cx-3,y-27,6,7,'#caa27a');
  R(cx-4,y-28,8,3,COL.red); R(cx-4,y-25,8,1,'#8f1d13');
}
function drawCat(cx,fy){
  R(cx-5,fy-6,9,5,'#3a332a'); R(cx-5,fy-6,9,1,'#4a4033');
  R(cx+2,fy-10,4,5,'#3a332a'); R(cx+2,fy-10,2,2,'#2a241d'); R(cx+5,fy-10,2,2,'#2a241d');
  R(cx-8,fy-3,4,2,'#3a332a');
  R(cx+4,fy-8,1,1,'#e8c34a');
}
function vendingCorner(env){
  var fy=248;
  ctx.save();ctx.translate(352,fy+1);ctx.scale(1,0.3);ctx.globalAlpha=0.32;C(0,0,16,'#000');ctx.restore();ctx.globalAlpha=1;
  R(340,fy-46,26,46,'#8c2f2a'); R(340,fy-46,26,2,'#a94a42'); R(363,fy-46,3,46,'#5f1f1b');
  R(343,fy-45,20,7,'#5f1f1b'); drawText(345,fy-44,'SNAX','#f2dcae');
  R(344,fy-36,13,22,'#f2dcae');
  var rnd=mulberry32(77);
  for(var r2=0;r2<3;r2++)for(var c2=0;c2<3;c2++)
    R(346+c2*4,fy-34+r2*7,2.5,4,['#b3271b','#2f6273','#d9b23a','#4a6b4d'][Math.floor(rnd()*4)]);
  R(344,fy-10,13,5,'#2b1512');
  R(359,fy-34,4,8,'#3a1815'); R(360,fy-32,2,2,'#d9d4c4');
  // water cooler
  R(371,fy-20,12,20,'#e8e6dc'); R(371,fy-20,12,2,'#f6f4ee');
  R(374,fy-31,9,11,'#bcd9e6'); R(374,fy-31,3,11,'#dcecf4');
  R(376,fy-8,3,3,'#2f6273');
}
function breakArea(env){
  var fy=248;
  R(336,fy-19,32,3,'#7a5a34'); R(338,fy-16,2,16,'#5f4526'); R(364,fy-16,2,16,'#5f4526');
  // coffee pot + steam
  R(342,fy-27,8,8,'#3a3f45'); R(343,fy-23,6,3,'#4a2f1d'); R(341,fy-19,10,1.5,'#20242a');
  line(350,fy-26,352,fy-23,'#3a3f45',1.5);
  for(var k=0;k<2;k++){
    var q=((env.p*2)+k*0.5)%1;
    ctx.globalAlpha=(1-q)*0.3;
    C(346+Math.sin(q*6+k)*2,fy-29-q*10,1.5+q*2,'#e4e0d4');
  }
  ctx.globalAlpha=1;
  R(354,fy-22,13,3,'#d9c48f'); R(354,fy-22,13,1,'#b9a26a'); // pizza box
  // boombox + notes
  R(370,fy-11,17,11,'#23262b');
  C(374,fy-5,3,'#3a3f45'); C(383,fy-5,3,'#3a3f45');
  C(374,fy-5,1.2,'#6b7178'); C(383,fy-5,1.2,'#6b7178');
  R(376,fy-10,5,3,'#8fae7e');
  for(var j=0;j<3;j++){
    var q2=((env.p*2)+j*0.33)%1;
    var nx=381+Math.sin(q2*5+j)*4, ny=fy-13-q2*22;
    ctx.globalAlpha=(1-q2)*0.8;
    R(nx,ny,2,2,'#16130c'); R(nx+2,ny-4,1,5,'#16130c'); R(nx+2,ny-5,3,1.5,'#16130c');
  }
  ctx.globalAlpha=1;
}
function janitor(env,i){
  var fy=248;
  worker(346,fy,env.p,i);
  var sway=Math.sin(env.p*Math.PI*2)*3;
  line(349,fy-16,356+sway,fy-1,'#8a6d4a',2);
  R(353+sway,fy-2,7,3,'#c9c3b2');
  R(362,fy-8,9,8,'#3a6b8c'); R(362,fy-8,9,2,'#4d84ab'); R(364,fy-7,5,2,'#7fb3d9');
  poly([[374,fy],[382,fy],[378,fy-12]],'#e8a020');
  R(375,fy-4,6,2,'#f4e6c4'); R(372,fy,12,2,'#c9861b');
}
function sleepingDog(env){
  var fy=248, x=352;
  ctx.save();ctx.translate(x,fy);ctx.scale(1,0.3);ctx.globalAlpha=0.3;C(0,0,13,'#000');ctx.restore();ctx.globalAlpha=1;
  var br=Math.sin(env.t*1.6)*0.7; // slow breathing
  R(x-11,fy-7-br,20,7+br,'#b98a5a'); R(x-11,fy-7-br,20,2,'#caa06e');
  R(x-14,fy-9,8,6,'#b98a5a');
  R(x-15,fy-11,4,4,'#a67a4c');
  R(x-13,fy-6,2,1,'#3a2f22');
  R(x-16,fy-4,3,2,'#3a2f22');
  line(x+9,fy-3,x+14,fy-7,'#a67a4c',2);
  for(var z=0;z<3;z++){
    var q=((env.t*0.5)+z*0.33)%1;
    ctx.globalAlpha=(1-q)*0.6;
    ctx.save();ctx.translate(x-10+q*8+z*2,fy-14-q*16-z*3);
    var sc=0.8+z*0.25+q*0.3; ctx.scale(sc,sc);
    drawText(0,0,'Z','#5a5f66');
    ctx.restore();
  }
  ctx.globalAlpha=1;
  R(x+16,fy-3,10,3,'#8f4a3a'); R(x+18,fy-3,6,1,'#7fb3d9'); // water bowl
}
// v: 0 reels+barrels / 1 pallet+worker / 2 crates+worker / 3 handtruck+reel /
//    4 vending+cooler / 5 break area / 6 janitor / 7 sleeping dog
function drawFloorProps(v,env,i){
  var fy=248;
  if(v===0){ spareReel(358,fy); inkBarrel(334,fy+2,'#2f5a68','#4b8ba0'); inkBarrel(382,fy+2,COL.redDark,COL.red); }
  else if(v===1){ paperPallet(356,fy); worker(388,fy,env.p,i); }
  else if(v===2){ crateStack(356,fy); worker(332,fy,env.p,i+2); }
  else if(v===3){ handTruck(344,fy); spareReel(384,fy); }
  else if(v===4){ vendingCorner(env); }
  else if(v===5){ breakArea(env); }
  else if(v===6){ janitor(env,i); }
  else { sleepingDog(env); }
  if(pick(i,19,7)===0) drawCat(365,fy);
}

/* ═══════════════════════ FOREGROUND EVENTS ═══════════════════════════════ */

function drawForklift(env,glow){
  var PER=27, TRAV=11.5;
  var n=Math.floor(env.t/PER), q=(env.t-n*PER)/TRAV;
  if(q>1) return;
  var dir=(n%2===0)?1:-1;
  var x=dir>0 ? -150+q*(W+300) : W+150-q*(W+300);
  var y=530+Math.sin(env.t*9)*0.8;
  var cargo=pick(n,5,2);
  ctx.save(); ctx.translate(x,y); ctx.scale(dir,1);
  if(glow){
    if(env.night>0.05){
      ctx.globalAlpha=0.16*env.night; poly([[32,-12],[95,-26],[95,0]],'#ffe9b0');
      ctx.globalAlpha=0.5*env.night; C(32,-12,2.5,'#fff3cf'); C(-30,-9,2,'#ff5a4a');
      ctx.globalAlpha=1;
    }
    ctx.restore(); return;
  }
  ctx.save();ctx.scale(1,0.3);ctx.globalAlpha=0.35;C(0,8,34,'#000');ctx.restore();ctx.globalAlpha=1;
  R(-30,-16,44,16,'#d98f2b'); R(-30,-16,44,3,'#f0b055'); R(-30,-4,44,4,'#8f5c17');
  R(-30,-22,12,8,'#c47f22');
  line(-16,-16,-16,-36,'#2b2f36',2); line(8,-16,8,-36,'#2b2f36',2); line(-18,-36,10,-36,'#2b2f36',3);
  R(-8,-30,7,10,'#2f6273'); R(-7,-36,6,6,'#caa27a'); R(-8,-38,8,3,'#e8c832');
  line(-2,-26,6,-22,'#2f6273',2);
  line(4,-24,10,-20,'#20242a',1.5);
  R(16,-40,3,40,'#3a3f45'); R(21,-40,3,40,'#3a3f45');
  R(16,-2,20,3,'#20242a');
  if(cargo===0){
    R(20,-26,16,24,COL.paper2); R(20,-26,3,24,'#fffdf8');
    ctx.save();ctx.translate(28,-26);ctx.scale(1,0.35);C(0,0,8,'#efece2');ctx.restore();
  } else {
    for(var b=0;b<3;b++){R(19,-9-b*7,18,6,b%2?COL.paper2:'#e6e2d4');R(19,-9-b*7,18,1.5,COL.red);}
  }
  roller(-20,0,7,10,env.p); roller(12,0,6,10,env.p);
  line(-4,-36,-4,-41,'#2b2f36',2);
  C(-4,-42,2.5,Math.sin(env.t*7)>0?'#ffb020':'#7a5a14');
  for(var e2=0;e2<3;e2++){
    var eq=((env.t*1.4)+e2*0.33)%1;
    ctx.globalAlpha=(1-eq)*0.25;
    C(-34-eq*10,-18-eq*14,2+eq*3,'#9aa0a6');
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

function drawAirplane(env){
  var PER=17, TRAV=6.5, off=6;
  var tt=env.t-off; if(tt<0) return;
  var n=Math.floor(tt/PER), q=(tt-n*PER)/TRAV;
  if(q<0||q>1) return;
  var dir=(n%2)?-1:1;
  var x0=dir>0?W*0.15:W*0.85;
  var x=x0+dir*q*(W*0.7);
  var y=300+q*150+Math.sin(q*Math.PI*5)*10;
  var rot=(Math.sin(q*Math.PI*5)*0.18+0.12)*dir;
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(dir,1);
  poly([[-6,-2],[8,0],[-6,3]],'#f6f3ea');
  poly([[-6,-2],[8,0],[-2,1]],'#d9d4c4');
  line(-6,-2,8,0,'#b9b2a0',0.6);
  ctx.restore();
}

// ── the delivery truck: MARK ALFRED DOT NEWS on the side ────────────────────
function drawTruck(env,glow){
  var PER=73, TRAV=13, off=40;
  var tt=env.t-off; if(tt<0) return;
  var n=Math.floor(tt/PER), q=(tt-n*PER)/TRAV;
  if(q>1) return;
  var dir=(n%2)?1:-1;
  var x=dir>0? -110+q*(W+220) : W+110-q*(W+220);
  var y=538+Math.sin(env.t*11)*0.6;
  if(glow){
    if(env.night>0.05){
      ctx.save();ctx.translate(x,y);ctx.scale(dir,1);
      ctx.globalAlpha=0.16*env.night; poly([[50,-10],[112,-22],[112,2]],'#ffe9b0');
      ctx.globalAlpha=0.55*env.night; C(49,-10,2.5,'#fff3cf'); C(-40,-8,2,'#ff5a4a');
      ctx.globalAlpha=1; ctx.restore();
    }
    return;
  }
  ctx.save();ctx.translate(x,y);ctx.scale(dir,1);
  ctx.save();ctx.scale(1,0.3);ctx.globalAlpha=0.35;C(4,4,46,'#000');ctx.restore();ctx.globalAlpha=1;
  // cargo box
  R(-40,-38,66,32,'#efece2'); R(-40,-38,66,3,'#f8f6f0'); R(-40,-10,66,4,'#b9b2a0');
  R(-40,-31,66,3,COL.red);
  // cab
  R(26,-28,24,22,'#b3271b'); R(26,-28,24,3,'#d0473a');
  R(30,-25,14,9,'#bcd9e6'); R(30,-25,14,2,'#dcecf4');
  R(48,-20,3,6,'#8f1d13'); R(26,-8,24,4,'#8f1d13');
  R(33,-22,5,6,'#33302a'); R(33,-25,4,3,'#caa27a'); // driver
  // wheels + lights
  roller(-24,0,7,10,env.p); roller(34,0,7,10,env.p);
  R(48,-12,3,3,'#ffe9b0'); R(-41,-10,2,4,'#8f1d13');
  // exhaust
  for(var e=0;e<3;e++){
    var eq=((env.t*1.2)+e*0.33)%1;
    ctx.globalAlpha=(1-eq)*0.22;
    C(-44-eq*12,-6-eq*10,2+eq*3,'#9aa0a6');
  }
  ctx.globalAlpha=1;
  ctx.restore();
  // livery, unmirrored regardless of direction
  var lc=x+dir*(-7);
  ctx.save();ctx.translate(lc-26,y-26);ctx.scale(1.2,1.2);drawText(0,0,'MARK ALFRED',COL.ink);ctx.restore();
  drawText(lc-16,y-18,'DOT NEWS',COL.redDark);
}

// ── paperboy on a bike, tossing the morning edition ─────────────────────────
function drawPaperboy(env){
  var PER=39, TRAV=9, off=15;
  var tt=env.t-off; if(tt<0) return;
  var n=Math.floor(tt/PER), q=(tt-n*PER)/TRAV;
  if(q>1) return;
  var dir=(n%2)?-1:1;
  function riderX(qq){return dir>0? -60+qq*(W+120) : W+60-qq*(W+120);}
  var x=riderX(q), y=524+Math.sin(env.t*6)*0.5;
  // tossed papers arc off behind the rider
  [0.22,0.5,0.78].forEach(function(q0,k){
    if(q>q0&&q<q0+0.13){
      var tp=(q-q0)/0.13;
      var px=riderX(q0)-dir*tp*34;
      var py=y-26-Math.sin(Math.PI*Math.min(1,tp))*34+tp*tp*26;
      ctx.save();ctx.translate(px,py);ctx.rotate(tp*7*dir);
      R(-3,-2,7,5,COL.paper); R(-3,-2,7,1.4,COL.red);
      ctx.restore();
    }
  });
  ctx.save();ctx.translate(x,y);ctx.scale(dir,1);
  ctx.save();ctx.scale(1,0.3);ctx.globalAlpha=0.3;C(0,4,18,'#000');ctx.restore();ctx.globalAlpha=1;
  roller(-9,0,6,14,env.p); roller(10,0,6,14,env.p);
  // frame + seat + handlebars
  line(-9,0,-2,-9,'#8f1d13',2); line(-2,-9,10,0,'#8f1d13',2);
  line(-2,-9,2,-1,'#8f1d13',2); line(8,-12,10,0,'#8f1d13',2);
  R(-5,-11,6,2,'#20242a'); line(6,-12,11,-13,'#20242a',1.5);
  // pedaling legs
  var pa=env.t*9;
  var p1x=2+Math.cos(pa)*4, p1y=-1+Math.sin(pa)*4;
  var p2x=2-Math.cos(pa)*4, p2y=-1-Math.sin(pa)*4;
  line(-2,-10,p1x,p1y,'#25303a',2); line(-2,-10,p2x,p2y,'#2c3844',2);
  R(p1x-1,p1y-1,3,2,'#161616'); R(p2x-1,p2y-1,3,2,'#161616');
  // torso, arm, head, cap
  R(-5,-22,7,12,'#356b52'); R(-5,-22,7,2,'#4a8266');
  line(0,-19,9,-13,'#356b52',2);
  R(-4,-28,6,6,'#caa27a');
  R(-5,-30,8,3,'#7a4a3a'); R(2,-29,3,1.5,'#7a4a3a');
  // basket of papers up front
  R(12,-16,10,8,'#7a5a34'); R(12,-16,10,1.5,'#8f6d42');
  R(13,-19,8,3,COL.paper); R(13,-19,8,1,COL.red);
  ctx.restore();
}

// ── an escaped balloon drifting up to the rafters ───────────────────────────
function drawBalloon(env){
  var PER=53, TRAV=22, off=8;
  var tt=env.t-off; if(tt<0) return;
  var n=Math.floor(tt/PER), q=(tt-n*PER)/TRAV;
  if(q>1) return;
  var x=W*(0.2+pick(n,7,60)/100)+Math.sin(q*Math.PI*4+n)*14-q*30;
  var y=480-q*430;
  ctx.globalAlpha=q>0.9?(1-q)*10:1;
  C(x,y,5,'#c93a2c'); C(x-1.5,y-1.5,1.5,'#e8776a');
  poly([[x-1,y+5],[x+1,y+5],[x,y+7]],'#8f1d13');
  ctx.strokeStyle='#8a8478';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x,y+7);
  ctx.quadraticCurveTo(x+3,y+12,x-1,y+18);
  ctx.stroke();
  ctx.globalAlpha=1;
}

/* ═══════════════════════════ GLOW PASS ═══════════════════════════════════ */

function glowPass(env){
  ctx.save(); ctx.globalCompositeOperation='lighter';
  // fluorescents re-light
  eachTile(100,34,env.bgF,function(x){
    ctx.globalAlpha=0.35*env.night; R(x+1,46,42,3,'#e8e4c8');
    ctx.globalAlpha=1;
    fadePoly([[x+1,49],[x+43,49],[x+64,196],[x-20,196]],49,196,'232,228,200',0.07*env.night);
  });
  ctx.globalAlpha=1;
  // window night sky punches through the dim
  eachTile(PITCH,0,env.bgF,function(x,i){
    var shape=pick(i,53,2);
    ctx.save(); windowPath(x,shape); ctx.clip();
    ctx.globalAlpha=0.05*env.night; R(x-84,62,168,110,'#9fb6e8'); ctx.globalAlpha=1;
    drawViewContent(x,env,true);
    ctx.restore();
  });
  // emissive wall features
  eachTile(PITCH,0,env.bgF,function(x,i){drawWallFeature(x,pick(i,7,8),env,true);});
  // EXIT signs (mezzanine level — never behind the machines)
  eachTile(PITCH,70,env.bgF,function(x,i){
    if(pick(i,41,5)!==0) return;
    ctx.globalAlpha=0.15+0.5*env.night; R(x-12,251,24,8,'#67e28a');
    ctx.globalAlpha=0.16*env.night; C(x,255,14,'#67e28a');
    ctx.globalAlpha=1;
  });
  // sconce cones + rotating beacons
  eachTile(PITCH,PITCH*0.5,env.bgF,function(x,i){
    if(pick(i,19,2)===0){
      fadePoly([[x-14,338],[x+14,338],[x+26,436],[x-26,436]],338,436,'255,233,184',0.09*env.night);
    }
    if(pick(i,43,4)===0){
      ctx.globalAlpha=0.1+0.5*env.night; C(x,208,3.2,'#ffb020');
      ctx.globalAlpha=0.07*env.night;
      ctx.save();ctx.translate(x,208);ctx.rotate(env.t*2.2+i);
      poly([[0,0],[52,-6],[52,6]],'#ffb020');
      ctx.rotate(Math.PI);
      poly([[0,0],[52,-6],[52,6]],'#ffb020');
      ctx.restore();
    }
    ctx.globalAlpha=1;
  });
  // machine-layer emissives
  ctx.save(); ctx.translate(0,SHIFT);
  eachTile(PITCH,0,scrollX,function(x,i){
    ctx.save();ctx.translate(x,0);
    var pk=(((env.p+i*0.11)%1)+1)%1;
    var bl=0.5+0.5*Math.sin(Math.PI*2*pk*6);
    ctx.globalAlpha=(0.3+0.4*bl)*env.night; C(178,120,3.4,'#ff8a7a');
    ctx.globalAlpha=0.45*env.night; C(178,128,3,'#a9e2b2');
    ctx.globalAlpha=1;
    if(pick(i,31,8)===0) drawWelder(env,i,true);
    if(pick(i,5,8)===4){ctx.globalAlpha=0.35*env.night;R(344,212,13,22,'#ffe6b3');ctx.globalAlpha=1;}
    ctx.restore();
  });
  ctx.restore();
  // vehicle lights
  drawForklift(env,true);
  drawTruck(env,true);
  // floor pools warm up
  eachTile(100,56,env.bgF,function(x){
    ctx.save();ctx.translate(x,506);ctx.scale(1,0.24);
    ctx.globalAlpha=0.07*env.night; C(0,0,46,'#ffe9b8');
    ctx.restore();
  });
  ctx.globalAlpha=1;
  ctx.restore();
}

/* ═══════════════════════════ FRAME LOOP ══════════════════════════════════ */

function renderFrame(t){
  var p=(t%LOOP)/LOOP;
  var tS=t/1000;
  var dph=(t%DAY_PERIOD)/DAY_PERIOD;
  var night=(1-Math.cos(dph*Math.PI*2))/2;
  var dayIdx=Math.floor(t/DAY_PERIOD);
  var rainy=(dayIdx%3)===2;
  var dusk=Math.max(0,1-Math.abs(night-0.42)/0.24);
  scrollX=tS*SCROLL_SPEED;

  var dayTop=rainy?'#94a2ac':'#8fc3e8', dayBot=rainy?'#c6cfd4':'#dceef7';
  var niTop=rainy?'#0c1220':'#0b1128', niBot=rainy?'#1b2734':'#22375a';
  var env={
    p:p, t:tS, dph:dph, night:night, rainy:rainy, dusk:dusk,
    bgF:scrollX*0.55, bgV:scrollX*0.22,
    skyTopC:mix(hx(dayTop),hx(niTop),night),
    skyBotC:mix(hx(dayBot),hx(niBot),night)
  };
  env.skyTopCss=css(env.skyTopC);
  env.silCss=css(mix(hx(rainy?'#7f8f9b':'#9db8cc'),hx('#0e1626'),night));
  env.sil2Css=css(mix(hx(rainy?'#6d7d88':'#8aa6ba'),hx('#0a1120'),night));
  env.cloudCss=css(mix(hx('#ffffff'),hx('#39445f'),night));
  var lf=0;
  if(rainy){var q=tS%19; if(q<0.09)lf=1; else if(q<0.16)lf=0.35; else if(q>0.32&&q<0.42)lf=0.7;}
  env.lf=lf;

  ctx.clearRect(0,0,W,H);
  drawWarehouse(env);
  drawCatwalk(env);
  drawHangLine(p);

  // the machine floor
  ctx.save(); ctx.translate(0,SHIFT);
  eachTile(PITCH,0,scrollX,function(x,i){
    var bpal=PRESS_PALS[pick(i,3,PRESS_PALS.length)];
    ctx.save();ctx.translate(x,0);
    drawBackPress(p,bpal);
    if(pick(i,31,8)===0) drawWelder(env,i,false);
    ctx.restore();
  });
  eachTile(PITCH,0,scrollX,function(x,i){
    ctx.save();ctx.translate(x,0);
    drawFloorProps(pick(i,5,8),env,i);
    ctx.restore();
  });
  eachTile(PITCH,0,scrollX,function(x,i){
    var pk=(((p+i*0.11)%1)+1)%1;
    var pal=PRESS_PALS[pick(i,3,PRESS_PALS.length)];
    ctx.save();ctx.translate(x,0);
    drawPaperRollUnit(pk);
    pressBody(pk,pal);
    drawWeb(pk);
    pressMech(pk);
    drawBelt(pk);
    drawStream(pk,i+1000);
    drawBundles(i+1000);
    drawPressExtras(i,pk,env);
    ctx.restore();
  });
  ctx.restore();

  drawPaperboy(env);
  drawForklift(env,false);
  drawTruck(env,false);
  drawBalloon(env);
  drawAirplane(env);

  // golden hour
  if(dusk>0.02&&!rainy){
    ctx.fillStyle='rgba(255,150,70,'+(0.10*dusk).toFixed(3)+')';
    ctx.fillRect(0,0,W,H);
  }
  if(rainy){ ctx.fillStyle='rgba(30,40,55,0.10)'; ctx.fillRect(0,0,W,H); }

  // night dim + everything that glows
  if(night>0.02){
    ctx.fillStyle='rgba(8,12,24,'+(0.58*night).toFixed(3)+')';
    ctx.fillRect(0,0,W,H);
    glowPass(env);
  }

  // lightning (works day or night)
  if(lf>0){
    ctx.save(); ctx.globalCompositeOperation='lighter';
    eachTile(PITCH,0,env.bgF,function(x,i){
      var sh=pick(i,53,2);
      ctx.save(); windowPath(x,sh); ctx.clip();
      ctx.globalAlpha=0.55*lf; R(x-84,62,168,112,'#dfe9ff');
      ctx.restore();
    });
    ctx.globalAlpha=0.07*lf; R(0,0,W,H,'#cfe0ff');
    ctx.globalAlpha=1; ctx.restore();
  }
}

function resize(){
  var host=canvas.parentNode;
  var cw=host.clientWidth||window.innerWidth||960;
  var ch=host.clientHeight||window.innerHeight||750;
  H=SCENE_H;
  W=Math.max(320,Math.round(SCENE_H*cw/ch));
  canvas.width=W; canvas.height=H;
  ctx.imageSmoothingEnabled=false;
}
window.addEventListener('resize',resize);
resize();

// #t=<ms> freezes the scene at a moment (preview/debug aid)
var start=performance.now();
var DBG=(function(){var m=/[#&]t=(\d+)/.exec(location.hash||'');return m?+m[1]:null;})();
var loop=function(now){ renderFrame(DBG!=null?DBG:(now-start)); requestAnimationFrame(loop); };
requestAnimationFrame(loop);
})();
