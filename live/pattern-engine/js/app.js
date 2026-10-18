/* MONO — generative monochrome pattern engine
   All patterns are continuous scalar fields; morphing blends fields BEFORE
   the black/white threshold, so transitions are liquid, never cuts. */
"use strict";

/* ============================== SHADERS ============================== */

const VERT = `#version 300 es
out vec2 v_uv;
void main(){
  vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
  v_uv = p;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}`;

const SCENE_FRAG = `#version 300 es
precision highp float;
out vec4 O;

uniform vec2  u_res;
uniform float u_time;

uniform float u_wHalftone,u_wVortex,u_wMeander,u_wCubes,u_wTuring,u_wFungus;
uniform float u_growSeeds,u_growSeedR,u_growRadius,u_growScale,u_growFreq,
              u_growWarp,u_growLobes,u_growMerge,u_growMirror,
              u_growTendrils,u_growNucleus,
              u_growUnd,u_growUndFreq,u_growUndSpeed,
              u_growTip,u_growTipSpeed,u_growBulb;
uniform float u_scale,u_rotation,u_drift;
uniform float u_sizeBase,u_sizeField,u_strokeBase,u_strokeField;
uniform float u_fRadial,u_fLinear,u_fNoise,u_fWave;
uniform float u_fieldAngle,u_radialFalloff,u_noiseScale,u_noiseSpeed,u_waveFreq,u_waveSpeed;
uniform float u_tiltX,u_tiltY,u_dispAmt;
uniform float u_spiralArms,u_spiralTwist,u_spiralDensity;
uniform float u_meanderTurns;
uniform float u_cubeRings;
uniform float u_turingScale,u_turingBands,u_turingWarp;
uniform float u_threshold,u_softness,u_aaWidth,u_invert,u_ssaa;
uniform sampler2D u_imgTex;
uniform float u_imgOn,u_imgAspect,u_fImage,u_imgZoom,u_imgContrast,u_imgInvert,u_imgMirror;
uniform float u_imgGamma,u_imgBrightness,u_cellLock;

#define TAU 6.28318530718

mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float hash21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  float a=hash21(i),b=hash21(i+vec2(1,0)),c=hash21(i+vec2(0,1)),d=hash21(i+vec2(1,1));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<4;i++){v+=a*vnoise(p);p=rot(0.7)*p*2.03;a*=0.5;}
  return v;
}

/* hex grid — returns (local xy, cell id zw). cell edge-radius = 0.5 */
vec4 hexCoords(vec2 uv){
  vec2 r=vec2(1.0,1.7320508), h=r*0.5;
  vec2 a=mod(uv,r)-h, b=mod(uv-h,r)-h;
  vec2 gv = dot(a,a)<dot(b,b) ? a : b;
  return vec4(gv, uv-gv);
}
float hexDist(vec2 p){
  p=abs(p);
  return max(dot(p,vec2(0.5,0.8660254)), p.x);
}

/* control field in ~[-1,1] — drives size / stroke everywhere.
   pi = un-rotated screen coords so an imported image stays upright. */
float field(vec2 p, vec2 pi, float t){
  vec2 dir=vec2(cos(u_fieldAngle),sin(u_fieldAngle));
  float f=0.0, w=0.0;
  f += u_fRadial*(1.0-2.0*clamp(length(p)*u_radialFalloff,0.0,1.0));       w+=u_fRadial;
  f += u_fLinear*clamp(dot(p,dir)*1.6,-1.0,1.0);                           w+=u_fLinear;
  f += u_fNoise*clamp((fbm(p*u_noiseScale+t*u_noiseSpeed)*2.0-1.0)*1.8,-1.0,1.0); w+=u_fNoise;
  f += u_fWave*sin(dot(p,dir)*u_waveFreq - t*u_waveSpeed);                 w+=u_fWave;
  /* image luminance as a field source — dark areas grow dots (print halftone) */
  if(u_imgOn>0.5 && u_fImage>0.001){
    /* cover fit: image always fills the full screen width AND height,
       overflow is cropped (like CSS background-size: cover) */
    float ia=max(u_imgAspect,0.01);
    float sa=u_res.x/u_res.y;
    float H=max(1.0, sa/ia);
    vec2 iuv=vec2(pi.x/(H*ia), -pi.y/H)/u_imgZoom + 0.5;
    if(u_imgMirror>0.5) iuv.x=1.0-iuv.x;
    float lum;
    if(iuv.x<0.0||iuv.x>1.0||iuv.y<0.0||iuv.y>1.0) lum=1.0;
    else lum=dot(texture(u_imgTex,iuv).rgb, vec3(0.299,0.587,0.114));
    lum=clamp(lum+u_imgBrightness,0.0,1.0);
    lum=pow(lum,u_imgGamma);
    lum=clamp((lum-0.5)*u_imgContrast+0.5,0.0,1.0);
    if(u_imgInvert>0.5) lum=1.0-lum;
    f += u_fImage*(1.0-2.0*lum); w+=u_fImage;
  }
  return w>0.001 ? f/max(w,1.0) : 0.0;
}

/* -------- pattern fields: ink where value < threshold -------- */

float patHalftone(vec2 q, float size){
  vec4 h=hexCoords(q);
  return hexDist(h.xy)*2.0 - size;
}

float patVortex(vec2 q, float size, float t){
  float r=length(q) + 1e-4;
  float a=atan(q.y,q.x);
  float arms=floor(u_spiralArms+0.5);
  float x=a/TAU*arms + log(r)*u_spiralTwist*arms*0.15;
  float y=log(r)*u_spiralDensity - t*0.08;
  vec2 g=vec2(fract(x)-0.5, fract(y)-0.5);
  float d=(abs(g.x)+abs(g.y));
  float v=(d-size*0.5)*1.4;
  /* clean white eye at the centre (matches ref) + kill infinite density */
  v=max(v,(0.06-r)*20.0);
  return v;
}

float patMeander(vec2 q, float stroke){
  vec4 h=hexCoords(q*0.62);
  vec2 gv=h.xy;
  float chir = hash21(h.zw)>0.5 ? 1.0 : -1.0;
  float a=atan(gv.y,gv.x);
  float r=hexDist(gv)*2.0;
  /* fade the angular term near the cell centre — the wedge singularity
     there made gradients explode and edges shimmer */
  float ph=a*3.0/TAU*chir*smoothstep(0.02,0.3,r) + r*u_meanderTurns;
  float s=abs(fract(ph)-0.5)*2.0;
  return (s-stroke)*0.7;
}

float patCubes(vec2 q, float fld, float stroke){
  vec4 h=hexCoords(q);
  vec2 gv=h.xy;
  float r=hexDist(gv)*2.0;
  float sec=floor(mod(atan(gv.y,gv.x)+TAU+TAU/12.0,TAU)/(TAU/3.0));
  float ring=r*u_cubeRings + sec*0.5;
  float s=abs(fract(ring)-0.5)*2.0;
  float duty=clamp(0.5+0.42*fld+(stroke-0.5)*0.8, 0.04, 0.96);
  return (s-duty)*0.7;
}

float fbm2(vec2 p){return vnoise(p)*0.65+vnoise(rot(0.7)*p*2.03)*0.35;}

float patTuring(vec2 q, float stroke, float t){
  /* domain-warped stripes ≈ reaction-diffusion: constant intrinsic
     wavelength (bands), smooth low-freq warp folds them into a maze */
  vec2 w=q*u_turingScale*0.1;
  vec2 wl=w*0.9;
  vec2 warp=u_turingWarp*1.1*vec2(fbm2(wl+t*0.03)-0.5, fbm2(wl+7.31-t*0.025)-0.5);
  float arg=dot(w+warp, vec2(0.866,0.5))*u_turingBands*0.6;
  float s=abs(fract(arg)-0.5)*2.0;               /* 0 at line centre */
  return (s-stroke)*0.7;
}

float smin(float a,float b,float k){
  if(k<1e-4) return min(a,b);
  float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);
  return mix(b,a,h)-k*h*(1.0-h);
}

/* one colony: nucleates at its own origin, grows an irregular lobed front,
   and fills with hyphae that radiate outward and branch generationally.
   Tendril count is an integer so the ±pi seam stays continuous. */
float colony(vec2 pl, float stroke, float t){
  float r=length(pl)+1e-5;
  vec2 dir=pl/r;
  /* lobed growth front — angular noise makes the mould edge irregular */
  float a=atan(pl.y,pl.x);
  float N=max(floor(u_growTendrils+0.5),1.0);
  float lob=fbm2(dir*u_growLobes+3.7+t*0.02);
  float R=max(u_growRadius,1e-3)*(0.55+0.9*lob);
  /* tip pulse: every filament extends and draws back on its own phase
     (a*N jumps by a whole number of periods at the seam, so it stays
     continuous), so the colony creeps outward like accreting coral */
  if(u_growTip>0.001)
    R*=1.0-u_growTip*0.45*(0.5+0.5*sin(t*u_growTipSpeed+a*N));
  if(r>R*1.02) return 1.0;                    /* outside the colony */
  /* worm-like undulation: a wave travelling outward ALONG each filament */
  float und=0.0;
  if(u_growUnd>0.001)
    und=u_growUnd*0.16*sin(r*u_growUndFreq-t*u_growUndSpeed+a*N);
  /* meander: noise warp in CYCLES (a fraction of one hypha spacing) so the
     filaments wander without dissolving into contour topography */
  float wq=(fbm2(pl*u_growFreq+t*0.04)-0.5)*u_growWarp+und;
  float b=a/TAU;                              /* jumps by 1 at the seam */
  float s1=abs(fract(b*N     +wq     )-0.5)*2.0;
  float s2=abs(fract(b*N*2.0 +wq*1.6 )-0.5)*2.0;   /* 2nd generation */
  float s3=abs(fract(b*N*4.0 +wq*2.4 )-0.5)*2.0;   /* 3rd generation */
  /* filaments taper to nothing exactly at the advancing front, with a
     Haeckel-ish swelling before the tip */
  float life=smoothstep(R,R*0.62,r);
  if(u_growBulb>0.001){
    float bd=(r/R-0.82)/0.09;
    life=clamp(life+u_growBulb*exp(-bd*bd),0.0,2.0);
  }
  /* hold CONSTANT physical thickness: angular width must fall as 1/r,
     and each finer generation needs double the angular threshold */
  float W=(0.0012+0.013*stroke)*life;
  float wr=min(W*2.0*N/(TAU*r), 0.45);      /* clamp keeps the core sane */
  /* later generations fade in with radius — hyphae branching as they grow */
  float g1=smoothstep(0.18,0.5,r/R), g2=smoothstep(0.45,0.85,r/R);
  float v=min(s1-wr, min(s2-2.0*wr*g1, s3-4.0*wr*g2));
  /* dense nucleus, and it kills the angular singularity at the seed */
  return min(v,(r-u_growNucleus)*6.0);
}

/* ---- FUNGUS: symmetry by replicating SEEDS, never by folding space.
   Each instance evaluates a complete colony in its own rotated frame, so
   every tendril stays a whole organism while the composition is n-fold
   dihedral — the mandala logic, applied to the growth instead of the pixels. */
float patFungus(vec2 q, float stroke, float t){
  float v=1.0;
  int n=int(clamp(u_growSeeds,1.0,16.0));
  float seg=TAU/float(n);
  float reach=u_growRadius*1.5+0.05;
  for(int k=0;k<16;k++){
    if(k>=n) break;
    vec2 pr=rot(-float(k)*seg)*q - vec2(u_growSeedR,0.0);
    if(dot(pr,pr)>reach*reach) continue;    /* cull distant colonies */
    v=smin(v, colony(pr,stroke,t), u_growMerge);
    if(u_growMirror>0.5)                    /* union with a mirrored twin:
                                               bilateral, still whole */
      v=smin(v, colony(vec2(pr.x,-pr.y),stroke,t), u_growMerge);
  }
  return v;
}

float shade(vec2 fc){
  vec2 uv=(fc-0.5*u_res)/u_res.y;
  float t=u_time;

  /* pseudo-3D perspective tilt */
  float per=1.0 + u_tiltX*uv.x + u_tiltY*uv.y;
  vec2 pi=uv/max(per,0.12);

  vec2 p=rot(u_rotation + t*u_drift*0.03)*pi;

  float fld=field(p,pi,t);
  float size=clamp(u_sizeBase+u_sizeField*fld, 0.02, 1.35);
  float stroke=clamp(u_strokeBase+u_strokeField*fld, 0.03, 0.97);

  /* wave displacement — fabric-like pseudo-3D ripple */
  vec2 dir=vec2(cos(u_fieldAngle),sin(u_fieldAngle));
  p += u_dispAmt*0.18*sin(dot(p,dir)*u_waveFreq - t*u_waveSpeed)*vec2(-dir.y,dir.x);

  vec2 q=p*u_scale;

  /* organic spatial dissolve: each pattern owns soft drifting regions
     proportional to its weight, so morphs melt region-by-region instead
     of interfering everywhere at once */
  float vs=0.0, ws=0.0, plain=0.0, wp=0.0;
  #define ACC(W,VAL,OFF) { float n=vnoise(p*1.3+OFF+t*0.006)*0.65+vnoise(p*2.7+OFF*1.9)*0.35; float m=(W)*smoothstep(0.12,0.88, n+1.7*((W)-0.5)); vs+=m*(VAL); ws+=m; plain+=(W)*(VAL); wp+=(W); }
  if(u_wHalftone>0.001){
    float sz=size;
    if(u_cellLock>0.5){
      /* sample the field at each hex cell's centre: every dot becomes a
         perfect disc sized by its cell's tone — print-halftone clarity */
      vec2 cc=hexCoords(q).zw/u_scale;
      float fc=field(cc, rot(-(u_rotation+t*u_drift*0.03))*cc, t);
      sz=clamp(u_sizeBase+u_sizeField*fc, 0.02, 1.35);
    }
    float val=patHalftone(q,sz);   ACC(u_wHalftone,val,vec2(1.7,9.2))
  }
  if(u_wVortex >0.001){float val=patVortex(q,size,t);    ACC(u_wVortex,val,vec2(23.1,4.8))}
  if(u_wMeander>0.001){float val=patMeander(q,stroke);   ACC(u_wMeander,val,vec2(11.4,17.9))}
  if(u_wCubes  >0.001){float val=patCubes(q,fld,stroke); ACC(u_wCubes,val,vec2(31.2,8.3))}
  if(u_wTuring >0.001){float val=patTuring(q,stroke,t);  ACC(u_wTuring,val,vec2(5.9,27.4))}
  if(u_wFungus>0.001){float val=patFungus(p*u_growScale,stroke,t); ACC(u_wFungus,val,vec2(19.6,2.4))}
  float v=(vs + plain*0.08)/max(ws + wp*0.08, 1e-4);

  /* true gradient length gives tighter AA on diagonals than fwidth.
     Clamped: at pattern discontinuities (meander cell borders) the
     gradient explodes and would smear grey — SSAA covers those instead */
  float aa=min(length(vec2(dFdx(v),dFdy(v)))*u_aaWidth, 0.15) + u_softness*0.25 + 1e-4;
  float c=smoothstep(u_threshold-aa, u_threshold+aa, v);
  if(u_invert>0.5) c=1.0-c;
  return c;
}

void main(){
  float c;
  if(u_ssaa>0.5){
    /* 4x rotated-grid supersampling for clean edges */
    c = 0.25*( shade(gl_FragCoord.xy+vec2(-0.125,-0.375))
             + shade(gl_FragCoord.xy+vec2( 0.375,-0.125))
             + shade(gl_FragCoord.xy+vec2( 0.125, 0.375))
             + shade(gl_FragCoord.xy+vec2(-0.375, 0.125)) );
  }else{
    c = shade(gl_FragCoord.xy);
  }
  O=vec4(vec3(c),1.0);
}`;

const BLUR_FRAG = `#version 300 es
precision highp float;
out vec4 O; in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res, u_dir;
uniform float u_blur,u_blurRadial,u_blurTilt,u_focusPos,u_focusWidth;
void main(){
  /* spatially-varying lens blur: uniform edge soften + radial DOF + tilt-shift */
  vec2 suv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  float radMask=smoothstep(0.12,0.72,length(suv));
  float tm=clamp(abs(suv.y-u_focusPos)/max(u_focusWidth,0.05),0.0,1.0);
  float radius=u_blur + u_blurRadial*radMask + u_blurTilt*tm*tm;
  if(radius<0.05){O=texture(u_tex,v_uv);return;}
  vec3 acc=vec3(0.0); float wsum=0.0;
  for(int i=-6;i<=6;i++){
    float fi=float(i);
    float w=exp(-(fi*fi)/(2.0*9.0)); /* gaussian over 13 taps */
    vec2 off=u_dir*fi*(radius/6.0)/u_res;
    acc+=texture(u_tex, v_uv+off).rgb*w;
    wsum+=w;
  }
  O=vec4(acc/wsum,1.0);
}`;

const POST_FRAG = `#version 300 es
precision highp float;
out vec4 O; in vec2 v_uv;
uniform sampler2D u_tex, u_grainTex;
uniform vec2 u_res, u_grainRes;
uniform float u_grainVideoOn, u_grainStrength, u_grainSize, u_grainSeed, u_grainFilmic, u_grainEdges;
/* integer hash (PCG-style) — true white noise, no repeating structure */
float uhash(uvec2 q){
  uint n=q.x*1597334673u ^ q.y*3812015801u;
  n=(n^(n>>16u))*2246822519u;
  n=(n^(n>>13u))*3266489917u;
  n^=n>>16u;
  return float(n)*(1.0/4294967295.0);
}
void main(){
  vec3 col=texture(u_tex,v_uv).rgb;
  float g;
  if(u_grainVideoOn>0.5){
    vec2 guv=gl_FragCoord.xy/(u_grainRes*max(u_grainSize,0.25));
    g=texture(u_grainTex,fract(guv)).r-0.5;
  }else{
    uvec2 cell=uvec2(ivec2(floor(gl_FragCoord.xy/max(u_grainSize,0.5))));
    uint sd=uint(u_grainSeed);
    float n1=uhash(cell+uvec2(sd*747796405u, sd*2891336453u));
    float n2=uhash(cell+uvec2(77u+sd*196314165u, 907u+sd*3267000013u));
    g=(n1*0.72+n2*0.28)-0.5;
  }
  float lum=clamp(col.r,0.0,1.0);
  float mids=mix(1.0, 4.0*lum*(1.0-lum), u_grainFilmic);
  /* keep grain off the anti-aliased edge greys so edges stay clean */
  float edge=4.0*lum*(1.0-lum);
  float protect=mix(1.0-edge, 1.0, clamp(u_grainEdges,0.0,1.0));
  col+=g*u_grainStrength*0.38*(0.12+0.88*mids)*protect;
  O=vec4(clamp(col,0.0,1.0),1.0);
}`;

/* ============================== PARAMS ============================== */

const SECTIONS = [
  {id:"mix", title:"PATTERN MIX", params:[
    {k:"wHalftone", l:"halftone",  min:0,max:1,step:.01,def:1},
    {k:"wVortex",   l:"vortex",    min:0,max:1,step:.01,def:0},
    {k:"wMeander",  l:"meander",   min:0,max:1,step:.01,def:0},
    {k:"wCubes",    l:"cubes",     min:0,max:1,step:.01,def:0},
    {k:"wTuring",   l:"turing",    min:0,max:1,step:.01,def:0},
    {k:"wFungus",   l:"fungus",    min:0,max:1,step:.01,def:0},
  ]},
  {id:"grow", title:"FUNGUS · symmetric growth", params:[
    {k:"growRadius", l:"growth",     min:.02,max:1,step:.005,def:.3},
    {k:"growSeeds",  l:"nuclei",     min:1,max:16,step:1,def:6},
    {k:"growSeedR",  l:"nucleus ring",min:0,max:.6,step:.005,def:.22},
    {k:"growScale",  l:"spread",     min:.3,max:4,step:.01,def:1},
    {k:"growTendrils",l:"tendrils",   min:1,max:24,step:1,def:7},
    {k:"growNucleus", l:"nucleus",    min:0,max:.4,step:.005,def:.05},
    {k:"growFreq",   l:"meander fine",min:1,max:24,step:.1,def:5},
    {k:"growWarp",   l:"tendril curl",min:0,max:1.5,step:.005,def:.35},
    {k:"growLobes",  l:"edge lobes", min:1,max:10,step:.1,def:3},
    {k:"growMerge",  l:"colony merge",min:0,max:.5,step:.005,def:.12},
    {k:"growMirror", l:"bilateral",  type:"toggle", def:1},
  ]},
  {id:"life", title:"LIFE · worm motion + coral growth", params:[
    {k:"growUnd",      l:"undulate",     min:0,max:1,step:.01,def:.35},
    {k:"growUndFreq",  l:"undulate wave",min:2,max:60,step:.5,def:18},
    {k:"growUndSpeed", l:"undulate rate",min:0,max:4,step:.01,def:1.2},
    {k:"growTip",      l:"tip reach",    min:0,max:1,step:.01,def:.3},
    {k:"growTipSpeed", l:"tip rate",     min:0,max:2,step:.01,def:.35},
    {k:"growBulb",     l:"tip swell",    min:0,max:1,step:.01,def:.25},
  ]},
  {id:"geo", title:"GEOMETRY", params:[
    {k:"scale",    l:"scale",     min:2,max:60,step:.1,def:14},
    {k:"rotation", l:"rotation",  min:-3.15,max:3.15,step:.01,def:0},
    {k:"drift",    l:"drift",     min:-1,max:1,step:.01,def:.06},
  ]},
  {id:"field", title:"FIELD · drives size + stroke", params:[
    {k:"fRadial",       l:"radial",       min:0,max:1,step:.01,def:1},
    {k:"fLinear",       l:"linear",       min:0,max:1,step:.01,def:0},
    {k:"fNoise",        l:"noise",        min:0,max:1,step:.01,def:0},
    {k:"fWave",         l:"wave",         min:0,max:1,step:.01,def:0},
    {k:"fieldAngle",    l:"angle",        min:-3.15,max:3.15,step:.01,def:-1.57},
    {k:"radialFalloff", l:"falloff",      min:.2,max:3,step:.01,def:.9},
    {k:"noiseScale",    l:"noise scale",  min:.3,max:6,step:.01,def:1.5},
    {k:"noiseSpeed",    l:"noise speed",  min:0,max:1,step:.01,def:.1},
    {k:"waveFreq",      l:"wave freq",    min:1,max:30,step:.1,def:8},
    {k:"waveSpeed",     l:"wave speed",   min:0,max:3,step:.01,def:.6},
  ]},
  {id:"shape", title:"SHAPE", params:[
    {k:"sizeBase",    l:"size",         min:0,max:1.3,step:.01,def:.55},
    {k:"sizeField",   l:"size ← field", min:-1,max:1,step:.01,def:.45},
    {k:"strokeBase",  l:"stroke",       min:.05,max:.95,step:.01,def:.5},
    {k:"strokeField", l:"stroke ← field",min:-1,max:1,step:.01,def:0},
    {k:"cellLock",    l:"dot lock (cells)", type:"toggle", def:1},
  ]},
  {id:"p3d", title:"PSEUDO 3D", params:[
    {k:"tiltX",   l:"tilt x",   min:-1.5,max:1.5,step:.01,def:0},
    {k:"tiltY",   l:"tilt y",   min:-1.5,max:1.5,step:.01,def:0},
    {k:"dispAmt", l:"wave warp",min:0,max:1,step:.01,def:0},
  ]},
  {id:"detail", title:"PATTERN DETAIL", params:[
    {k:"spiralArms",    l:"vortex arms",   min:3,max:32,step:1,def:14},
    {k:"spiralTwist",   l:"vortex twist",  min:-3,max:3,step:.01,def:.8},
    {k:"spiralDensity", l:"vortex rings",  min:1,max:12,step:.1,def:4},
    {k:"meanderTurns",  l:"meander turns", min:.5,max:6,step:.1,def:2},
    {k:"cubeRings",     l:"cube rings",    min:1,max:8,step:1,def:3},
    {k:"turingScale",   l:"turing scale",  min:.5,max:8,step:.01,def:3.5},
    {k:"turingBands",   l:"turing bands",  min:1,max:12,step:.1,def:6},
    {k:"turingWarp",    l:"turing warp",   min:0,max:3,step:.01,def:1.6},
  ]},
  {id:"motion", title:"MOTION", params:[
    {k:"speed",     l:"speed",      min:0,max:3,step:.01,def:1},
    {k:"morphTime", l:"morph time", min:2,max:20,step:.5,def:8},
    {k:"wander",    l:"wander",     min:0,max:1,step:.01,def:.15},
    {k:"lfoTarget", l:"lfo target", type:"select", def:"0",
      options:[["0","size"]]}, /* rebuilt below to cover every attribute */
    {k:"lfoRate",   l:"lfo rate",   min:.02,max:2,step:.01,def:.25},
    {k:"lfoDepth",  l:"lfo depth",  min:0,max:1,step:.01,def:0},
    {k:"cycleOn",   l:"auto cycle", type:"toggle", def:0},
    {k:"cycleTime", l:"cycle secs", min:10,max:300,step:5,def:60},
  ]},
  {id:"out", title:"OUTPUT", params:[
    {k:"threshold",     l:"threshold",  min:-.5,max:.5,step:.005,def:0},
    {k:"aaWidth",       l:"aa width",   min:.2,max:3,step:.01,def:.9},
    {k:"softness",      l:"softness",   min:0,max:1,step:.01,def:0},
    {k:"blur",          l:"edge blur",  min:0,max:6,step:.05,def:0},
    {k:"blurRadial",    l:"radial blur",min:0,max:18,step:.1,def:0},
    {k:"blurTilt",      l:"tilt shift", min:0,max:18,step:.1,def:0},
    {k:"focusPos",      l:"focus pos",  min:-.6,max:.6,step:.01,def:0},
    {k:"focusWidth",    l:"focus width",min:.05,max:1,step:.01,def:.35},
    {k:"invert",        l:"invert",     type:"toggle", def:0},
    {k:"grainStrength", l:"grain",      min:0,max:1,step:.01,def:.15},
    {k:"grainSize",     l:"grain size", min:.5,max:6,step:.1,def:1.6},
    {k:"grainFps",      l:"grain fps",  min:6,max:60,step:1,def:24},
    {k:"grainEdges",    l:"grain on edges", min:0,max:1,step:.01,def:.1},
    {k:"grainFilmic",   l:"grain filmic",type:"toggle", def:0},
  ]},
  {id:"img", title:"IMAGE · halftones a photo", params:[
    {k:"fImage",      l:"image drive",   min:0,max:1,step:.01,def:0},
    {k:"imgZoom",     l:"image zoom",    min:.3,max:3,step:.01,def:1},
    {k:"imgContrast", l:"image contrast",min:.3,max:3,step:.01,def:1},
    {k:"imgGamma",    l:"image gamma",   min:.3,max:3,step:.01,def:1},
    {k:"imgBrightness",l:"image bright", min:-1,max:1,step:.01,def:0},
    {k:"imgInvert",   l:"image invert",  type:"toggle", def:0},
    {k:"imgMirror",   l:"mirror",        type:"toggle", def:0},
  ]},
  {id:"sys", title:"SYSTEM", params:[
    {k:"renderScale", l:"render res", type:"select", def:"1",
      options:[["0.5","50%"],["0.75","75%"],["1","100%"],["1.5","150%"],["2","200%"]]},
    {k:"ssaa", l:"edge quality", type:"select", def:"1", options:[["1","ultra 4×"],["0","standard"]]},
    {k:"fpsCap", l:"fps cap", type:"select", def:"0", options:[["0","display"],["60","60"],["30","30"]]},
  ]},
];

const PATTERN_KEYS=["wHalftone","wVortex","wMeander","wCubes","wTuring","wFungus"];
const PATTERN_NAMES=["HALFTONE","VORTEX","MEANDER","CUBES","TURING","FUNGUS"];
const STORE_KEY="monoPatternEngine.v2";

/* runtime state (numbers only — selects/toggles live here too as numbers) */
const state={};
const defs={};
SECTIONS.forEach(s=>s.params.forEach(p=>{
  defs[p.k]=p;
  state[p.k]=(p.type==="select")?parseFloat(p.def):(p.def??0);
}));

/* LFO can target ANY numeric attribute — sizeBase first so factory
   presets with lfoTarget:0 keep meaning "size" */
const LFO_ALL=["sizeBase",...Object.keys(defs).filter(k=>
  !defs[k].type && k!=="sizeBase" &&
  !["speed","morphTime","cycleTime","wander","lfoRate","lfoDepth"].includes(k))];
defs.lfoTarget.options=LFO_ALL.map((k,i)=>[String(i),defs[k].l]);

/* ============================== TWEENS ============================== */

const tweens={};
let now_s=0;
const smootherstep=t=>t*t*t*(t*(t*6-15)+10);

/* angles morph by SHORTEST path — a transition never spins more than 180° */
const PERIODIC=new Set(["rotation","fieldAngle"]);
function tweenTo(partial, dur){
  for(const k in partial){
    if(typeof partial[k]!=="number"||!isFinite(partial[k])) continue;
    let to=partial[k];
    if(PERIODIC.has(k)){
      const d=((to-state[k])%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI;
      to=state[k]+d;
    }
    tweens[k]={from:state[k],to,start:now_s,dur:Math.max(dur,0.01)};
  }
}
function stepTweens(){
  let active=false;
  for(const k in tweens){
    const tw=tweens[k];
    let t=(now_s-tw.start)/tw.dur;
    if(t>=1){state[k]=tw.to;delete tweens[k];}
    else{state[k]=tw.from+(tw.to-tw.from)*smootherstep(Math.max(t,0));active=true;}
  }
  return active;
}

/* ============================== GL SETUP ============================== */

const canvas=document.getElementById("c");
const gl=canvas.getContext("webgl2",{antialias:false,preserveDrawingBuffer:true});
const errBox=document.getElementById("glError");
if(!gl){errBox.style.display="block";errBox.textContent="WebGL2 not available";throw new Error("no webgl2");}

function compile(type,src){
  const sh=gl.createShader(type);
  gl.shaderSource(sh,src);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){
    const log=gl.getShaderInfoLog(sh);
    errBox.style.display="block";errBox.textContent="SHADER ERROR\n"+log;
    throw new Error(log);
  }
  return sh;
}
function program(fs){
  const p=gl.createProgram();
  gl.attachShader(p,compile(gl.VERTEX_SHADER,VERT));
  gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const uni={};
  const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){const info=gl.getActiveUniform(p,i);uni[info.name]=gl.getUniformLocation(p,info.name);}
  return {prog:p,uni};
}

const scenePr=program(SCENE_FRAG);
const blurPr=program(BLUR_FRAG);
const postPr=program(POST_FRAG);

function makeTarget(w,h){
  const tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const fbo=gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  return {tex,fbo,w,h};
}
let rtA=null,rtB=null;

function resize(force){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const rs=state.renderScale||1;
  const w=Math.max(2,Math.round(canvas.clientWidth*dpr*rs));
  const h=Math.max(2,Math.round(canvas.clientHeight*dpr*rs));
  if(!force&&canvas.width===w&&canvas.height===h) return;
  canvas.width=w;canvas.height=h;
  rtA=makeTarget(w,h);rtB=makeTarget(w,h);
}
window.addEventListener("resize",()=>resize());

/* grain video texture */
const grainVideo=document.createElement("video");
grainVideo.loop=true;grainVideo.muted=true;grainVideo.playsInline=true;
let grainTex=gl.createTexture(),grainVideoOn=false,grainRes=[64,64];
gl.bindTexture(gl.TEXTURE_2D,grainTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,128,255]));
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);

/* imported image texture (halftone source) */
let imgTex=gl.createTexture(),imgOn=false,imgAspect=1;
gl.bindTexture(gl.TEXTURE_2D,imgTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

/* webcam — live video into the same image-field pipeline */
let camStream=null;
const camVideo=document.createElement("video");
camVideo.muted=true;camVideo.playsInline=true;
function stopWebcam(){
  if(!camStream)return;
  camStream.getTracks().forEach(tr=>tr.stop());
  camStream=null;imgOn=false;
  document.getElementById("camBtn").classList.remove("active");
  document.getElementById("imgInfo").textContent="no image — patterns run free";
}
document.getElementById("camBtn").addEventListener("click",async()=>{
  if(camStream){stopWebcam();toast("WEBCAM OFF");return;}
  try{
    camStream=await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720}});
    camVideo.srcObject=camStream;
    await camVideo.play();
    imgOn=true;state.imgMirror=1;
    if(state.fImage<0.05)tweenTo({fImage:1},2);
    syncUI(["fImage","imgMirror"]);
    document.getElementById("camBtn").classList.add("active");
    document.getElementById("imgInfo").textContent="webcam live";
    toast("WEBCAM ON");
  }catch(err){
    camStream=null;
    toast("WEBCAM: "+(err.name==="NotAllowedError"?"PERMISSION DENIED"
      :err.name==="NotFoundError"?"NO CAMERA FOUND":"UNAVAILABLE"));
  }
});

document.getElementById("imgFile").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  const img=new Image();
  img.onload=()=>{
    stopWebcam();
    gl.bindTexture(gl.TEXTURE_2D,imgTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,img);
    imgAspect=img.width/img.height;
    imgOn=true;state.imgMirror=0;
    URL.revokeObjectURL(img.src);
    document.getElementById("imgInfo").textContent=f.name;
    if(state.fImage<0.05)tweenTo({fImage:1},2);
    syncUI(["fImage","imgMirror"]);
    toast("IMAGE LOADED — driving the field");
  };
  img.src=URL.createObjectURL(f);
});

document.getElementById("grainFile").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  grainVideo.src=URL.createObjectURL(f);
  grainVideo.play().then(()=>{
    grainVideoOn=true;
    document.getElementById("grainInfo").textContent=f.name;
    toast("GRAIN VIDEO LOADED");
  }).catch(()=>toast("could not play video"));
});

/* ============================== RENDER ============================== */

/* wander — quasi-periodic drift on key params. Two sines at irrational
   frequency ratios per param: the motion never exactly repeats. Applied at
   uniform-set time so sliders/autosave keep the user's base values. */
const WANDER={
  fieldAngle:[0.50,0.0113,0.0041], noiseScale:[0.35,0.0071,0.0029],
  waveFreq:[1.20,0.0089,0.0037],   sizeBase:[0.07,0.0097,0.0043],
  strokeBase:[0.05,0.0083,0.0031], rotation:[0.06,0.0059,0.0023],
  turingWarp:[0.18,0.0103,0.0047], spiralTwist:[0.15,0.0067,0.0027],
  scale:[0.05,0.0061,0.0025], /* relative */
};
const WPHASE={};
Object.keys(WANDER).forEach(k=>WPHASE[k]=[Math.random()*6.283,Math.random()*6.283]);
const wanderOff={};
/* auto-LFO: one smooth sine routed to ANY numeric attribute */
function computeWander(t){
  for(const k in wanderOff) wanderOff[k]=0;
  const amt=state.wander||0;
  if(amt>0.001)for(const k in WANDER){
    const [amp,f1,f2]=WANDER[k], [p1,p2]=WPHASE[k];
    const a=(k==="scale")?amp*state.scale:amp;
    wanderOff[k]=(wanderOff[k]||0)+amt*a*(0.6*Math.sin(t*f1*6.283+p1)+0.4*Math.sin(t*f2*6.283+p2));
  }
  const depth=state.lfoDepth||0;
  if(depth>0.001){
    const i=Math.min(LFO_ALL.length-1,Math.max(0,Math.round(state.lfoTarget||0)));
    const k=LFO_ALL[i], d=defs[k];
    const a=(d.max-d.min)*0.35;
    wanderOff[k]=(wanderOff[k]||0)+depth*a*Math.sin(6.28318*state.lfoRate*t);
  }
}
function setUniforms(pr,w,h,time){
  gl.uniform2f(pr.uni["u_res"],w,h);
  gl.uniform1f(pr.uni["u_time"],time);
  for(const k in state){
    const loc=pr.uni["u_"+k];
    if(!loc) continue;
    let v=state[k]+(wanderOff[k]||0);
    const d=defs[k];
    if(d&&d.min!==undefined&&!PERIODIC.has(k)) v=Math.min(d.max,Math.max(d.min,v));
    gl.uniform1f(loc,v);
  }
}
function drawFS(){gl.drawArrays(gl.TRIANGLES,0,3);}

let simTime=0,grainSeed=0;

function render(w,h,targetNull){
  /* scene -> rtA */
  gl.bindFramebuffer(gl.FRAMEBUFFER,rtA.fbo);
  gl.viewport(0,0,w,h);
  gl.useProgram(scenePr.prog);
  setUniforms(scenePr,w,h,simTime);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,imgTex);
  gl.uniform1i(scenePr.uni["u_imgTex"],2);
  gl.uniform1f(scenePr.uni["u_imgOn"],imgOn?1:0);
  gl.uniform1f(scenePr.uni["u_imgAspect"],imgAspect);
  drawFS();

  let src=rtA,dst=rtB;
  /* spatially-varying blur (separable, 2 pass) */
  if(state.blur+state.blurRadial+state.blurTilt>0.05){
    gl.useProgram(blurPr.prog);
    setUniforms(blurPr,w,h,simTime);
    /* H */
    gl.bindFramebuffer(gl.FRAMEBUFFER,dst.fbo);
    gl.uniform2f(blurPr.uni["u_dir"],1,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,src.tex);
    gl.uniform1i(blurPr.uni["u_tex"],0);
    drawFS();
    [src,dst]=[dst,src];
    /* V */
    gl.bindFramebuffer(gl.FRAMEBUFFER,dst.fbo);
    gl.uniform2f(blurPr.uni["u_dir"],0,1);
    gl.bindTexture(gl.TEXTURE_2D,src.tex);
    drawFS();
    [src,dst]=[dst,src];
  }
  /* post (grain) -> screen */
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.viewport(0,0,w,h);
  gl.useProgram(postPr.prog);
  gl.uniform2f(postPr.uni["u_res"],w,h);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,src.tex);
  gl.uniform1i(postPr.uni["u_tex"],0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,grainTex);
  gl.uniform1i(postPr.uni["u_grainTex"],1);
  gl.uniform2f(postPr.uni["u_grainRes"],grainRes[0],grainRes[1]);
  gl.uniform1f(postPr.uni["u_grainVideoOn"],grainVideoOn?1:0);
  gl.uniform1f(postPr.uni["u_grainStrength"],state.grainStrength);
  gl.uniform1f(postPr.uni["u_grainSize"],state.grainSize);
  gl.uniform1f(postPr.uni["u_grainSeed"],grainSeed);
  gl.uniform1f(postPr.uni["u_grainFilmic"],state.grainFilmic);
  gl.uniform1f(postPr.uni["u_grainEdges"],state.grainEdges);
  drawFS();
}

/* ============================== MAIN LOOP ============================== */

let lastT=performance.now()/1000, fpsAcc=0, fpsN=0, fpsT=0;
let nextCycleAt=0, uiSyncT=0;

function loop(){
  requestAnimationFrame(loop);
  const t=performance.now()/1000;
  const dt=Math.min(t-lastT,0.1);

  if(state.fpsCap>=29){                            /* capped: skip frames */
    if(t-lastT < 1/state.fpsCap - 0.002) return;
    lastT=Math.max(lastT + 1/state.fpsCap, t - 0.05);
  }else{
    lastT=t;                                       /* display rate: smoothest pacing */
  }
  now_s=t;

  const hadTweens=stepTweens();
  simTime+=dt*state.speed;
  grainSeed=Math.floor(t*state.grainFps)%1000;
  computeWander(simTime);

  /* auto cycle — randomised interval so the rhythm never repeats */
  if(state.cycleOn>0.5){
    if(t>nextCycleAt){nextCycleAt=t+state.cycleTime*rr(0.55,1.5);autoCycle();}
  }else nextCycleAt=t+3;   /* first cycle fires 3s after enabling */

  /* grain video upload */
  if(grainVideoOn && grainVideo.readyState>=2){
    gl.bindTexture(gl.TEXTURE_2D,grainTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,grainVideo);
    grainRes=[grainVideo.videoWidth||64,grainVideo.videoHeight||64];
  }
  /* webcam frame upload */
  if(camStream && camVideo.readyState>=2){
    gl.bindTexture(gl.TEXTURE_2D,imgTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,camVideo);
    imgAspect=(camVideo.videoWidth||16)/(camVideo.videoHeight||9);
  }

  resize();
  render(canvas.width,canvas.height);

  /* fps meter */
  fpsAcc+=dt;fpsN++;
  if(t-fpsT>0.5){
    document.getElementById("fps").textContent=Math.round(fpsN/fpsAcc)+" fps";
    fpsAcc=0;fpsN=0;fpsT=t;
  }
  /* sync sliders during morphs (throttled) */
  if(hadTweens && t-uiSyncT>0.15){uiSyncT=t;syncUI();}
}

/* ============================== RANDOM ============================== */

const rr=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];

function morphDur(){return state.morphTime*rr(0.8,1.2);}

function randomPatternMix(){
  const t={};PATTERN_KEYS.forEach(k=>t[k]=0);
  /* never land on the pattern that currently dominates */
  const cur=PATTERN_KEYS.reduce((a,b)=>state[a]>=state[b]?a:b);
  const main=pick(PATTERN_KEYS.filter(k=>k!==cur));
  t[main]=1;
  if(Math.random()<0.35){const b=pick(PATTERN_KEYS.filter(k=>k!==main));t[b]=rr(0.25,0.6);}
  return t;
}
function randomFields(){
  const t={fRadial:0,fLinear:0,fNoise:0,fWave:0};
  const keys=["fRadial","fLinear","fNoise","fWave"];
  const n=1+(Math.random()<0.4?1:0);
  for(let i=0;i<n;i++)t[pick(keys)]=rr(0.5,1);
  t.fieldAngle=rr(-Math.PI,Math.PI);
  t.radialFalloff=rr(0.5,1.8);
  t.noiseScale=rr(0.6,3.5);
  t.waveFreq=rr(3,16);
  t.waveSpeed=rr(0.1,1.2);
  return t;
}
function randomShape(){
  return {sizeBase:rr(0.3,0.95),sizeField:rr(-0.85,0.85),
          strokeBase:rr(0.25,0.7),strokeField:rr(-0.6,0.6)};
}
function random3D(){
  const flat=Math.random()<0.45;
  return {tiltX:flat?0:rr(-0.9,0.9),tiltY:flat?0:rr(-0.9,0.9),
          dispAmt:Math.random()<0.5?0:rr(0.1,0.6),
          blurRadial:Math.random()<0.55?0:rr(2,9),
          blurTilt:Math.random()<0.65?0:rr(2,9),
          focusPos:rr(-0.25,0.25)};
}
function randomDetail(){
  return {scale:rr(6,34),rotation:rr(-Math.PI,Math.PI),
          spiralArms:Math.round(rr(6,24)),spiralTwist:rr(-1.8,1.8),spiralDensity:rr(2,8),
          meanderTurns:rr(1,4),cubeRings:Math.round(rr(2,6)),
          turingScale:rr(1,5),turingBands:rr(2,8),turingWarp:rr(0.4,2),
          growSeeds:Math.round(rr(1,10)),growSeedR:Math.random()<0.3?0:rr(0.12,0.42),
          growRadius:rr(0.14,0.5),growScale:rr(0.7,1.6),growTendrils:Math.round(rr(4,14)),
          growNucleus:rr(0.01,0.07),growFreq:rr(3,10),growWarp:rr(0.15,0.7),
          growLobes:rr(1.5,6),growMerge:rr(0,0.25)};
}
function randomSubtle(){
  const skip=new Set(["morphTime","speed","cycleTime","fImage","imgZoom","imgContrast","imgGamma","imgBrightness","aaWidth","lfoRate","lfoDepth"]);
  const numeric=Object.keys(defs).filter(k=>!defs[k].type&&!skip.has(k));
  const t={};
  for(let i=0;i<6;i++){
    const k=pick(numeric),d=defs[k];
    const range=(d.max-d.min)*0.12;
    t[k]=Math.min(d.max,Math.max(d.min,state[k]+rr(-range,range)));
  }
  return t;
}
function randomAll(){
  return {...randomPatternMix(),...randomFields(),...randomShape(),...random3D(),...randomDetail()};
}
const RANDOMS=[
  ["PATTERN",()=>randomPatternMix()],
  ["FIELDS",()=>randomFields()],
  ["SHAPE",()=>randomShape()],
  ["3D/WAVE",()=>random3D()],
  ["SUBTLE",()=>randomSubtle()],
  ["ALL",()=>randomAll()],
];
let lastPreset=null;
/* small random offsets so a revisited preset is never identical twice */
function mutateSnapshot(s){
  const m={...s};
  Object.keys(m).forEach(k=>{
    const d=defs[k];
    if(d&&!d.type&&Math.random()<0.4){
      const r=(d.max-d.min)*0.08;
      m[k]=Math.min(d.max,Math.max(d.min,m[k]+rr(-r,r)));
    }
  });
  return m;
}
function autoCycle(){
  const presets=loadPresets();
  const names=Object.keys(presets).filter(n=>n!==lastPreset);
  if(names.length && Math.random()<0.35){
    const n=pick(names);lastPreset=n;
    recall(mutateSnapshot(presets[n]));
    toast("CYCLE · "+n+" ±");
  }else{
    lastPreset=null;
    tweenTo(randomAll(),morphDur());
    toast("CYCLE · new form");
  }
}

function resetDefaults(){
  const t={};
  SECTIONS.forEach(s=>s.params.forEach(p=>{
    if(p.type==="select"){state[p.k]=parseFloat(p.def);}
    else if(p.type==="toggle"){state[p.k]=p.def;}
    else t[p.k]=p.def;
  }));
  tweenTo(t,3);
  syncUI();
  toast("DEFAULTS");
}

/* ============================== UI ============================== */

const $=id=>document.getElementById(id);
const inputs={};

function buildUI(){
  /* pattern solo buttons */
  const pb=$("patternBtns");
  PATTERN_NAMES.forEach((name,i)=>{
    const b=document.createElement("button");
    b.textContent=name;
    b.onclick=()=>{
      const t={};PATTERN_KEYS.forEach((k,j)=>t[k]=j===i?1:0);
      tweenTo(t,morphDur());
      toast(name);
    };
    pb.appendChild(b);
  });
  /* random buttons */
  const rb=$("randomBtns");
  RANDOMS.forEach(([name,fn])=>{
    const b=document.createElement("button");
    b.textContent=name;
    b.onclick=()=>{tweenTo(fn(),morphDur());toast("RANDOM · "+name);};
    rb.appendChild(b);
  });
  /* sections */
  const host=$("controls");
  SECTIONS.forEach(sec=>{
    const div=document.createElement("div");
    div.className="section";
    if(["field","detail","p3d","sys"].includes(sec.id))div.classList.add("collapsed");
    const title=document.createElement("div");
    title.className="secTitle collapsible";
    title.textContent=sec.title;
    title.onclick=()=>div.classList.toggle("collapsed");
    div.appendChild(title);
    const body=document.createElement("div");
    body.className="secBody";
    sec.params.forEach(p=>{
      const row=document.createElement("div");row.className="ctl";
      const lab=document.createElement("label");lab.textContent=p.l;row.appendChild(lab);
      if(p.type==="select"){
        const sel=document.createElement("select");
        p.options.forEach(([v,txt])=>{
          const o=document.createElement("option");o.value=v;o.textContent=txt;sel.appendChild(o);
        });
        sel.value=p.def;
        sel.onchange=()=>{
          const v=parseFloat(sel.value);
          state[p.k]=v;
          if(p.k==="renderScale")resize(true);
          saveState();
        };
        row.appendChild(sel);inputs[p.k]=sel;
      }else if(p.type==="toggle"){
        const cb=document.createElement("input");cb.type="checkbox";cb.checked=!!p.def;
        cb.onchange=()=>{state[p.k]=cb.checked?1:0;saveState();};
        row.appendChild(cb);inputs[p.k]=cb;
      }else{
        const sl=document.createElement("input");
        sl.type="range";sl.min=p.min;sl.max=p.max;sl.step=p.step;sl.value=state[p.k];
        const val=document.createElement("span");val.className="val";val.textContent=fmt(state[p.k]);
        sl.oninput=()=>{delete tweens[p.k];state[p.k]=parseFloat(sl.value);val.textContent=fmt(state[p.k]);};
        sl.onchange=()=>saveState();
        row.appendChild(sl);row.appendChild(val);
        inputs[p.k]={sl,val};
      }
      body.appendChild(row);
    });
    div.appendChild(body);
    host.appendChild(div);
  });
}
function fmt(v){return(Math.abs(v)<10?v.toFixed(2):v.toFixed(1)).replace(/\.?0+$/,"")||"0";}

function syncUI(keys){
  const ks=keys||Object.keys(defs);
  ks.forEach(k=>{
    const p=defs[k],el=inputs[k];
    if(!p||!el)return;
    if(p.type==="select")el.value=String(state[k]);
    else if(p.type==="toggle")el.checked=state[k]>0.5;
    else{el.sl.value=state[k];el.val.textContent=fmt(state[k]);}
  });
}

/* toast */
let toastT=null;
function toast(msg){
  const el=$("toast");el.textContent=msg;el.classList.add("show");
  clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("show"),1600);
}

/* panel show / hide + autohide */
const panel=$("panel");
let hideT=null;
function schedHide(){
  clearTimeout(hideT);
  hideT=setTimeout(()=>panel.classList.add("hidden"),5000);
}
window.addEventListener("mousemove",()=>{panel.classList.remove("hidden");schedHide();});
$("hideBtn").onclick=e=>{e.stopPropagation();panel.classList.add("hidden");clearTimeout(hideT);};
$("resetBtn").onclick=()=>resetDefaults();
schedHide();

/* keys */
window.addEventListener("keydown",e=>{
  if(e.target.tagName==="INPUT"&&e.target.type==="text")return;
  const k=e.key.toLowerCase();
  if(k==="h"){panel.classList.toggle("hidden");clearTimeout(hideT);}
  if(k==="f"){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();}
  if(k==="r"){tweenTo(randomAll(),morphDur());toast("RANDOM · ALL");}
  if(k==="s"){exportPNG();}
});

/* ============================== PRESETS ============================== */

/* presets capture the LOOK — never system or motion-engine settings.
   (cycleOn in a preset used to switch auto-cycle off when recalled) */
const PRESET_SKIP=new Set(["renderScale","fpsCap","ssaa","cycleOn","cycleTime","morphTime"]);
function snapshot(){
  const s={};
  Object.keys(defs).forEach(k=>{if(!PRESET_SKIP.has(k))s[k]=state[k];});
  return s;
}
function recall(s){
  const t={};
  Object.keys(s).forEach(k=>{
    if(PRESET_SKIP.has(k))return;
    if(defs[k]&&!defs[k].type)t[k]=s[k];
    else if(defs[k])state[k]=s[k];
  });
  tweenTo(t,morphDur());
  syncUI();
}
function defaultSnapshot(){
  const s={};
  SECTIONS.forEach(sec=>sec.params.forEach(p=>{
    s[p.k]=p.type==="select"?parseFloat(p.def):(p.def??0);
  }));
  return s;
}
/* factory presets — one per reference study */
const FACTORY=[
  ["HEX BLOOM",   {}],
  ["VORTEX FALL", {wHalftone:0,wVortex:1,tiltY:.55,sizeBase:.7,sizeField:.3,fieldAngle:0}],
  ["MEANDER",     {wHalftone:0,wMeander:1,scale:9,fRadial:0}],
  ["ISO RINGS",   {wHalftone:0,wCubes:1,scale:8,fRadial:0,fLinear:1,fieldAngle:-2.35}],
  ["CORAL MAZE",  {wHalftone:0,wTuring:1,fRadial:0}],
  ["MANDALA",     {wHalftone:0,wVortex:1,scale:22,spiralArms:12,spiralTwist:.3,spiralDensity:6,sizeBase:.75,sizeField:.25}],
  ["BREATHE",     {wHalftone:1,fRadial:.55,fWave:1,fieldAngle:-1.57,waveFreq:5,waveSpeed:.5,
                   scale:16,sizeBase:.62,sizeField:.7,dispAmt:.3,drift:.08,
                   lfoTarget:0,lfoRate:.12,lfoDepth:.5,wander:.3,blurRadial:3}],
  ["TILT SHIFT",  {wHalftone:0,wVortex:1,tiltY:.5,sizeBase:.7,sizeField:.3,fieldAngle:0,blurTilt:7,focusPos:-.1,focusWidth:.3}],
  /* growth studies — mandala logic applied to living structure */
  ["MYCELIUM",    {wHalftone:0,wFungus:1,fRadial:0,strokeBase:.5,
                   growSeeds:1,growSeedR:0,growRadius:.45,growScale:1,
                   growTendrils:9,growNucleus:.04,growFreq:5,growWarp:.35,
                   growLobes:3,growMirror:0,drift:.03}],
  ["RADIOLARIAN", {wHalftone:0,wFungus:1,fRadial:0,strokeBase:.42,
                   growSeeds:1,growSeedR:0,growRadius:.44,growScale:1,
                   growTendrils:13,growNucleus:.05,growFreq:5,growWarp:.35,
                   growLobes:2.5,growMirror:0,growUnd:.5,growUndFreq:26,
                   growUndSpeed:1.2,growTip:.3,growTipSpeed:.35,growBulb:.7,
                   drift:.02}],
  ["CORAL RING",  {wHalftone:0,wFungus:1,fRadial:0,strokeBase:.2,
                   growSeeds:6,growSeedR:.26,growRadius:.22,growScale:1,
                   growTendrils:8,growNucleus:.015,growFreq:5,growWarp:.35,
                   growLobes:3,growMirror:1,growMerge:.14,growUnd:.45,
                   growUndFreq:24,growUndSpeed:1.2,growTip:.35,
                   growTipSpeed:.35,growBulb:.5}],
  ["SPORE RING",  {wHalftone:0,wFungus:1,fRadial:0,strokeBase:.18,
                   growSeeds:6,growSeedR:.26,growRadius:.22,growScale:1,
                   growTendrils:7,growNucleus:.015,growFreq:5,growWarp:.4,
                   growLobes:3.5,growMirror:1,growMerge:.14}],
  ["BLOOM MANDALA",{wHalftone:0,wFungus:1,fRadial:.6,strokeField:-.25,
                   strokeBase:.3,growSeeds:8,growSeedR:.24,growRadius:.17,
                   growScale:1,growTendrils:6,growNucleus:.02,growFreq:5,
                   growWarp:.35,growLobes:3,growMirror:1,growMerge:.12,
                   /* slow LFO on growth = the colony breathing outward */
                   lfoTarget:LFO_ALL.indexOf("growRadius"),lfoRate:.04,lfoDepth:.3,
                   wander:.12}],
];
function installFactoryPresets(){
  /* refresh factory entries each boot (they evolve with the app);
     user-named presets are kept untouched */
  const p=loadPresets();
  FACTORY.forEach(([name,over])=>p[name]={...defaultSnapshot(),...over});
  savePresets(p);
}

function loadPresets(){try{return JSON.parse(localStorage.getItem(STORE_KEY+".presets"))||{};}catch{return{};}}
function savePresets(p){localStorage.setItem(STORE_KEY+".presets",JSON.stringify(p));}
function renderPresetList(){
  const host=$("presetList");host.innerHTML="";
  const presets=loadPresets();
  Object.keys(presets).forEach(name=>{
    const row=document.createElement("div");row.className="presetItem";
    const load=document.createElement("button");load.className="load";load.textContent=name;
    load.onclick=()=>{recall(presets[name]);toast("PRESET · "+name);};
    const del=document.createElement("button");del.className="del";del.textContent="×";
    del.onclick=()=>{const p=loadPresets();delete p[name];savePresets(p);renderPresetList();};
    row.appendChild(load);row.appendChild(del);host.appendChild(row);
  });
}
$("savePreset").onclick=()=>{
  const name=$("presetName").value.trim()||"preset "+new Date().toLocaleTimeString();
  const p=loadPresets();p[name]=snapshot();savePresets(p);
  $("presetName").value="";renderPresetList();toast("SAVED · "+name);
};

/* autosave / restore last state */
let saveT=null;
function saveState(){
  clearTimeout(saveT);
  saveT=setTimeout(()=>localStorage.setItem(STORE_KEY+".last",JSON.stringify(snapshot())),400);
}
function restoreState(){
  try{
    const s=JSON.parse(localStorage.getItem(STORE_KEY+".last"));
    if(!s)return;
    Object.keys(s).forEach(k=>{
      if(defs[k])state[k]=s[k];
    });
  }catch{}
}

/* ============================== EXPORT ============================== */

function exportPNG(){
  const mult=parseFloat($("exportScale").value);
  const maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const ow=canvas.width,oh=canvas.height;
  let w=Math.round(ow*mult),h=Math.round(oh*mult);
  if(w>maxTex||h>maxTex){const f=maxTex/Math.max(w,h);w=Math.floor(w*f);h=Math.floor(h*f);}
  canvas.width=w;canvas.height=h;
  rtA=makeTarget(w,h);rtB=makeTarget(w,h);
  render(w,h);
  canvas.toBlob(blob=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="mono_"+Date.now()+".png";
    a.click();
    canvas.width=ow;canvas.height=oh;
    rtA=makeTarget(ow,oh);rtB=makeTarget(ow,oh);
    toast("PNG "+w+"×"+h);
  },"image/png");
}
$("exportPng").onclick=exportPNG;

/* recording */
let recorder=null,chunks=[];
$("recBtn").onclick=()=>{
  const btn=$("recBtn");
  if(recorder){recorder.stop();return;}
  const stream=canvas.captureStream(60);
  const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm";
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:80_000_000});
  chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=()=>{
    const blob=new Blob(chunks,{type:"video/webm"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="mono_"+Date.now()+".webm";
    a.click();
    recorder=null;btn.textContent="● REC";btn.classList.remove("rec");
    toast("RECORDING SAVED");
  };
  recorder.start();
  btn.textContent="■ STOP";btn.classList.add("rec");
  toast("RECORDING…");
};

/* ============================== BOOT ============================== */

/* auto-load the bundled grain loop if present (assets/grain.mp4 —
   replace that file with any stock grain loop you prefer). play() can be
   rejected while the tab is hidden, so retry on visibility/interaction. */
function tryPlayGrain(){
  if(grainVideoOn||!grainVideo.src)return;
  grainVideo.play().then(()=>{
    grainVideoOn=true;
    document.getElementById("grainInfo").textContent="bundled grain loop (assets/grain.mp4)";
  }).catch(()=>{});
}
fetch("assets/grain.mp4",{method:"HEAD"}).then(r=>{
  if(!r.ok||grainVideoOn)return;
  grainVideo.src="assets/grain.mp4";
  grainVideo.addEventListener("canplaythrough",tryPlayGrain,{once:true});
  document.addEventListener("visibilitychange",tryPlayGrain);
  window.addEventListener("pointerdown",tryPlayGrain);
  tryPlayGrain();
}).catch(()=>{});

installFactoryPresets();
restoreState();
buildUI();
syncUI();
renderPresetList();
resize(true);
requestAnimationFrame(loop);
