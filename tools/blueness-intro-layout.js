// Shared by the screen and the on-demand video overlay. No font downloads.
function layoutBluenessIntro(svg,width,height,size,screen={x:0,y:0,w:width,h:height},unit=1){
 const direct=[...svg.children].filter(node=>node.tagName?.toLowerCase()==='path');
 if(!svg.querySelector('[data-intro-text]')&&direct.length>=3){
  const text=document.createElementNS(svg.namespaceURI,'g'),arrow=document.createElementNS(svg.namespaceURI,'g');text.dataset.introText='1';arrow.dataset.introArrow='1';
  svg.insertBefore(text,direct[0]);text.append(direct[0]);svg.insertBefore(arrow,direct[1]);arrow.append(direct[1],direct[2]);
 }
 if(!svg.querySelector('[data-blue-anchor]'))svg.querySelector('rect:last-of-type')?.setAttribute('data-blue-anchor','1');
 const anchor=svg.querySelector('[data-blue-anchor]'),text=svg.querySelector('[data-intro-text]'),arrow=svg.querySelector('[data-intro-arrow]');if(!anchor||!text||!arrow)return;
 const cx=screen.x+screen.w/2,cy=screen.y+screen.h/2,gap=16*unit,margin=Math.max(16*unit,Math.min(48*unit,screen.w*.05));
 const a=anchor.getBBox(),t=text.getBBox(),r=arrow.getBBox();
 const arrowHeight=Math.max(44*unit,Math.min(100*unit,Math.min(screen.w,screen.h)*.12)),arrowScale=arrowHeight/r.height,arrowTop=cy-size/2-gap-arrowHeight;
 const textScale=Math.max(.01,Math.min((screen.w-2*margin)/t.width,(arrowTop-screen.y-margin-gap)/t.height));
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',width);svg.setAttribute('height',height);
 svg.style.cssText=`position:absolute;display:block;left:0;top:0;width:${width}px;height:${height}px;max-width:none;max-height:none;`;
 anchor.setAttribute('transform',`translate(${cx-(a.x+a.width/2)*size/a.width} ${cy-(a.y+a.height/2)*size/a.width}) scale(${size/a.width})`);
 arrow.setAttribute('transform',`translate(${cx-(r.x+r.width/2)*arrowScale} ${arrowTop-r.y*arrowScale}) scale(${arrowScale})`);
 text.setAttribute('transform',`translate(${cx-(t.x+t.width/2)*textScale} ${arrowTop-gap-(t.y+t.height)*textScale}) scale(${textScale})`);
}
